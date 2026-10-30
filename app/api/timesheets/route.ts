import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getSession } from '@/lib/session';
import { exec } from '@/lib/db';

export async function POST(req: Request) {
  const s = await getSession();
  const body = await req.json();
  const action = body.action;

  if (action === 'create_expense') {
    const id = 'exp-' + randomBytes(4).toString('hex');
    const amount = Number(body.amount || 0);
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
        body.merchant || 'Field Expense',
        body.category || 'other',
        amount,
        body.miles ? Number(body.miles) : null,
        body.billable ? 1 : 0,
        body.notes || null,
      ]
    );
    return NextResponse.json({ ok: true, id });
  }

  if (action === 'submit_timesheet') {
    const id = 'ts-' + randomBytes(4).toString('hex');
    const entries = Array.isArray(body.entries) ? body.entries : [];
    const totalHours = entries.reduce(
      (sum: number, e: any) =>
        sum +
        Number(e.mon_hrs || 0) +
        Number(e.tue_hrs || 0) +
        Number(e.wed_hrs || 0) +
        Number(e.thu_hrs || 0) +
        Number(e.fri_hrs || 0) +
        Number(e.sat_hrs || 0) +
        Number(e.sun_hrs || 0),
      0
    );
    const overtime = Math.max(0, totalHours - 40);

    await exec(
      `INSERT INTO timesheets
        (id, tenant_id, user_id, week_start, status, total_hours, overtime_hours,
         employee_signature_data, employee_signed_at,
         policyholder_signed_by, policyholder_signed_at, policyholder_signature_method)
       VALUES (?, ?, ?, ?, 'waiting', ?, ?, ?, NOW(), ?, IF(? IS NOT NULL AND ? <> '', NOW(), NULL), ?)`,
      [
        id,
        s.tenantId,
        s.user.id,
        body.week_start || new Date().toISOString().slice(0, 10),
        totalHours,
        overtime,
        body.employee_signature_data || `Signed electronically: ${s.user.name}`,
        body.policyholder_signed_by || null,
        body.policyholder_signed_by || null,
        body.policyholder_signed_by || null,
        body.policyholder_signature_method || 'On-glass mobile sign-off',
      ]
    );

    for (const e of entries) {
      const rowTotal =
        Number(e.mon_hrs || 0) +
        Number(e.tue_hrs || 0) +
        Number(e.wed_hrs || 0) +
        Number(e.thu_hrs || 0) +
        Number(e.fri_hrs || 0) +
        Number(e.sat_hrs || 0) +
        Number(e.sun_hrs || 0);
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
          Number(e.mon_hrs || 0),
          Number(e.tue_hrs || 0),
          Number(e.wed_hrs || 0),
          Number(e.thu_hrs || 0),
          Number(e.fri_hrs || 0),
          Number(e.sat_hrs || 0),
          Number(e.sun_hrs || 0),
          e.client_sheet_hours !== undefined ? Number(e.client_sheet_hours) : rowTotal,
        ]
      );
    }

    return NextResponse.json({ ok: true, id });
  }

  if (action === 'update_timesheet_status') {
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [body.id];
    const nextStatus = String(body.status);
    for (const id of ids) {
      await exec('UPDATE timesheets SET status=?, reviewer_notes=? WHERE id=? AND tenant_id=?', [
        nextStatus,
        body.reviewer_notes || null,
        id,
        s.tenantId,
      ]);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'update_expense_status') {
    await exec('UPDATE expenses SET status=? WHERE id=? AND tenant_id=?', [body.status, body.id, s.tenantId]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

