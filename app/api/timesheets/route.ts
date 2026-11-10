import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { requireApiSession, apiErrorResponse } from '@/lib/session';
import { exec, one, audit, nowSql } from '@/lib/db';
import {
  assertMemberInTenant,
  assertSiteInTenant,
  assertEngagementInTenant,
} from '@/lib/acl';

export async function POST(req: Request) {
  try {
    const s = await requireApiSession(req);
    const body = await req.json();
    const action = body.action;

    if (action === 'create_expense') {
      if (!s.permissions.has('team:inspections.execute') && !s.permissions.has('team:timesheets.approve')) {
        return NextResponse.json({ error: 'Permission denied to log field expenses.' }, { status: 403 });
      }
      if (body.member_id) await assertMemberInTenant(s.tenantId, body.member_id);
      if (body.engagement_id) await assertEngagementInTenant(s.tenantId, body.engagement_id);

      const id = 'exp-' + randomBytes(4).toString('hex');
      const amount = Math.max(0, Number(body.amount || 0));
      await exec(
        `INSERT INTO expenses
          (id, tenant_id, user_id, engagement_id, job_id, member_id, expense_date, merchant, category, amount, miles, billable, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?)`,
        [
          id,
          s.tenantId,
          s.user.id,
          body.engagement_id || null,
          body.job_id || null,
          body.member_id || null,
          body.expense_date || new Date().toISOString().slice(0, 10),
          String(body.merchant || 'Field Expense').slice(0, 190),
          ['lodging', 'meals', 'mileage', 'airfare', 'supplies', 'other'].includes(body.category) ? body.category : 'other',
          amount,
          body.miles ? Number(body.miles) : null,
          body.billable ? 1 : 0,
          body.notes ? String(body.notes).slice(0, 500) : null,
        ]
      );
      return NextResponse.json({ ok: true, id });
    }

    if (action === 'submit_timesheet') {
      if (!s.permissions.has('team:inspections.execute') && !s.permissions.has('team:timesheets.approve')) {
        return NextResponse.json({ error: 'Permission denied to submit timesheets.' }, { status: 403 });
      }
      const id = 'ts-' + randomBytes(4).toString('hex');
      const entries = Array.isArray(body.entries) ? body.entries : [];
      for (const e of entries) {
        await assertMemberInTenant(s.tenantId, e.member_id);
        if (e.site_id) await assertSiteInTenant(s.tenantId, e.site_id);
      }

      const totalHours = entries.reduce(
        (sum: number, e: any) =>
          sum +
          Math.max(0, Number(e.mon_hrs || 0)) +
          Math.max(0, Number(e.tue_hrs || 0)) +
          Math.max(0, Number(e.wed_hrs || 0)) +
          Math.max(0, Number(e.thu_hrs || 0)) +
          Math.max(0, Number(e.fri_hrs || 0)) +
          Math.max(0, Number(e.sat_hrs || 0)) +
          Math.max(0, Number(e.sun_hrs || 0)),
        0
      );
      const overtime = Math.max(0, totalHours - 40);
      const now = nowSql();

      await exec(
        `INSERT INTO timesheets
          (id, tenant_id, user_id, week_start, status, total_hours, overtime_hours,
           employee_signature_data, employee_signed_at,
           policyholder_signed_by, policyholder_signed_at, policyholder_signature_method)
         VALUES (?, ?, ?, ?, 'waiting', ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          s.tenantId,
          s.user.id,
          body.week_start || new Date().toISOString().slice(0, 10),
          totalHours,
          overtime,
          body.employee_signature_data || `Signed electronically: ${s.user.name}`,
          now,
          body.policyholder_signed_by || null,
          body.policyholder_signed_by ? now : null,
          body.policyholder_signature_method || 'On-glass mobile sign-off',
        ]
      );

      for (const e of entries) {
        const rowTotal =
          Math.max(0, Number(e.mon_hrs || 0)) +
          Math.max(0, Number(e.tue_hrs || 0)) +
          Math.max(0, Number(e.wed_hrs || 0)) +
          Math.max(0, Number(e.thu_hrs || 0)) +
          Math.max(0, Number(e.fri_hrs || 0)) +
          Math.max(0, Number(e.sat_hrs || 0)) +
          Math.max(0, Number(e.sun_hrs || 0));
        await exec(
          `INSERT INTO timesheet_entries
            (id, timesheet_id, job_id, member_id, site_id, mon_hrs, tue_hrs, wed_hrs, thu_hrs, fri_hrs, sat_hrs, sun_hrs, client_sheet_hours)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'tse-' + randomBytes(4).toString('hex'),
            id,
            e.job_id || null,
            e.member_id,
            e.site_id || null,
            Math.max(0, Number(e.mon_hrs || 0)),
            Math.max(0, Number(e.tue_hrs || 0)),
            Math.max(0, Number(e.wed_hrs || 0)),
            Math.max(0, Number(e.thu_hrs || 0)),
            Math.max(0, Number(e.fri_hrs || 0)),
            Math.max(0, Number(e.sat_hrs || 0)),
            Math.max(0, Number(e.sun_hrs || 0)),
            e.client_sheet_hours !== undefined ? Math.max(0, Number(e.client_sheet_hours)) : rowTotal,
          ]
        );
      }

      return NextResponse.json({ ok: true, id });
    }

    if (action === 'update_timesheet_status') {
      if (!s.permissions.has('team:timesheets.approve')) {
        return NextResponse.json({ error: 'Missing team:timesheets.approve permission.' }, { status: 403 });
      }
      const ids: string[] = Array.isArray(body.ids) ? body.ids : [body.id];
      const nextStatus = ['waiting', 'approved', 'sent_back'].includes(body.status) ? String(body.status) : 'waiting';
      for (const id of ids) {
        const ts = await one<any>('SELECT user_id FROM timesheets WHERE id=? AND tenant_id=?', [id, s.tenantId]);
        if (!ts) continue;
        if (nextStatus === 'approved' && ts.user_id === s.user.id && s.role !== 'owner') {
          return NextResponse.json({ error: 'Self-approval of your own timesheet is prohibited. Ask a Supervisor or Owner.' }, { status: 403 });
        }
        await exec('UPDATE timesheets SET status=?, reviewer_notes=? WHERE id=? AND tenant_id=?', [
          nextStatus,
          body.reviewer_notes ? String(body.reviewer_notes).slice(0, 500) : null,
          id,
          s.tenantId,
        ]);
        await audit(s.tenantId, s.user.id, `timesheet.${nextStatus}`, 'timesheet', id, undefined, s.impersonation?.platformUserId);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'update_expense_status') {
      if (!s.permissions.has('team:timesheets.approve')) {
        return NextResponse.json({ error: 'Missing team:timesheets.approve permission.' }, { status: 403 });
      }
      const nextStatus = ['waiting', 'approved', 'sent_back'].includes(body.status) ? String(body.status) : 'waiting';
      const ex = await one<any>('SELECT user_id FROM expenses WHERE id=? AND tenant_id=?', [body.id, s.tenantId]);
      if (!ex) return NextResponse.json({ error: 'Expense not found.' }, { status: 404 });
      if (nextStatus === 'approved' && ex.user_id === s.user.id && s.role !== 'owner') {
        return NextResponse.json({ error: 'Self-approval of your own expense is prohibited.' }, { status: 403 });
      }
      await exec('UPDATE expenses SET status=? WHERE id=? AND tenant_id=?', [nextStatus, body.id, s.tenantId]);
      await audit(s.tenantId, s.user.id, `expense.${nextStatus}`, 'expense', String(body.id), undefined, s.impersonation?.platformUserId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
