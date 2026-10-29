import { NextResponse } from 'next/server';
import { randomUUID, randomBytes } from 'node:crypto';
import { getSession } from '@/lib/session';
import { q, one, audit } from '@/lib/db';
import { hashToken } from '@/lib/auth';
import { sendMail } from '@/lib/email';
import { PRIORITY_DAYS } from '@/lib/format';

export async function POST(req: Request) {
  const s = await getSession();
  const body = await req.json();
  const { action } = body as { action: string };

  if (action === 'start_inspection') {
    const siteId = String(body.siteId || '');
    const formCode = String(body.formCode || '').toUpperCase();
    const visitId = body.visitId ? String(body.visitId) : null;

    if (!siteId || !formCode) {
      return NextResponse.json({ error: 'Site and form are required to start an inspection.' }, { status: 400 });
    }
    const site = await one<any>(
      'SELECT st.*, m.name AS member_name, m.tenant_id FROM sites st JOIN members m ON m.id = st.member_id WHERE st.id=? AND m.tenant_id=?',
      [siteId, s.tenantId]
    );
    if (!site) return NextResponse.json({ error: 'Site not found.' }, { status: 404 });

    const form = await one<any>('SELECT * FROM forms WHERE code=?', [formCode]);
    if (!form) return NextResponse.json({ error: 'Form not found.' }, { status: 404 });

    const maxRow = await one<{ m: number }>(
      "SELECT COALESCE(MAX(CAST(SUBSTRING(id, 3) AS UNSIGNED)), 2050) AS m FROM inspections WHERE id LIKE 'I-%'"
    );
    const inspId = 'I-' + ((maxRow?.m ?? 2050) + 1);

    await q(
      `INSERT INTO inspections (id, tenant_id, visit_id, site_id, form_code, form_version, consultant_id, device_id, started_at)
       VALUES (?,?,?,?,?,?,?, ?, NOW())`,
      [inspId, s.tenantId, visitId, siteId, formCode, form.version, s.user.id, 'web-field-' + s.user.id]
    );
    await audit(s.tenantId, s.user.id, 'inspection.started', 'inspection', inspId, { siteId, formCode, visitId });
    return NextResponse.json({ ok: true, inspectionId: inspId });
  }

  if (action === 'answer') {
    const inspectionId = String(body.inspectionId || '');
    const questionId = String(body.questionId || '');
    const value = String(body.value || '');
    const measuredValue = body.measuredValue === '' || body.measuredValue === null || body.measuredValue === undefined ? null : Number(body.measuredValue);
    const naReason = String(body.naReason || '').trim() || null;

    const insp = await one<any>(
      'SELECT i.*, st.jurisdiction FROM inspections i JOIN sites st ON st.id = i.site_id WHERE i.id=? AND i.tenant_id=?',
      [inspectionId, s.tenantId]
    );
    if (!insp) return NextResponse.json({ error: 'Inspection not found.' }, { status: 404 });
    if (insp.submitted_at) return NextResponse.json({ error: 'Inspection is already submitted and locked.' }, { status: 409 });

    const qn = await one<any>('SELECT * FROM questions WHERE form_code=? AND question_id=?', [insp.form_code, questionId]);
    if (!qn) return NextResponse.json({ error: 'Question not found.' }, { status: 404 });

    await q(
      `INSERT INTO answers (inspection_id, question_id, question_key, value, measured_value, na_reason, answered_at)
       VALUES (?,?,?,?,?,?,NOW())
       ON DUPLICATE KEY UPDATE value=VALUES(value), measured_value=VALUES(measured_value), na_reason=VALUES(na_reason), answered_at=NOW()`,
      [inspectionId, questionId, qn.question_key, value, measuredValue, naReason]
    );

    if (value === 'unsafe') {
      const recText = String(body.recText || qn.recommendation || `Correct unsafe condition on Q ${questionId}.`).trim();
      const priority = (['High', 'Med', 'Low'].includes(body.priority) ? body.priority : qn.priority) as 'High' | 'Med' | 'Low';
      const days = PRIORITY_DAYS[priority] ?? 30;
      const due = new Date();
      due.setDate(due.getDate() + days);
      const dueStr = due.toISOString().slice(0, 10);

      // Resolve citation by site jurisdiction first, then FED fallback
      const reg =
        (await one<any>('SELECT reg_id FROM regulations WHERE topic=? AND jurisdiction=? AND status <> "superseded" LIMIT 1', [qn.topic, insp.jurisdiction])) ||
        (await one<any>('SELECT reg_id FROM regulations WHERE topic=? AND jurisdiction="FED" AND status <> "superseded" LIMIT 1', [qn.topic]));

      // Check for repeat finding on same site + question_key
      const prior = await one<any>(
        `SELECT r.id FROM recommendations r
         JOIN inspections i2 ON i2.id = r.inspection_id
         WHERE i2.site_id = ? AND r.question_key = ? AND r.inspection_id <> ?
         LIMIT 1`,
        [insp.site_id, qn.question_key, inspectionId]
      );
      const isRepeat = prior ? 1 : 0;

      const existingRec = await one<any>('SELECT id FROM recommendations WHERE inspection_id=? AND question_id=?', [inspectionId, questionId]);
      if (existingRec) {
        await q('UPDATE recommendations SET text=?, priority=?, due_on=?, reg_id=?, is_repeat=? WHERE id=?', [
          recText,
          priority,
          dueStr,
          reg?.reg_id ?? null,
          isRepeat,
          existingRec.id,
        ]);
      } else {
        const maxRec = await one<{ m: number }>(
          "SELECT COALESCE(MAX(CAST(SUBSTRING(id, 3) AS UNSIGNED)), 200) AS m FROM recommendations WHERE id LIKE 'R-%'"
        );
        const recId = 'R-' + ((maxRec?.m ?? 200) + 1);
        await q(
          `INSERT INTO recommendations (id, tenant_id, inspection_id, question_id, question_key, section_no, text, priority, due_on, status, reg_id, is_repeat, created_by, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,'open',?,?,?,NOW())`,
          [recId, s.tenantId, inspectionId, questionId, qn.question_key, qn.section_no, recText, priority, dueStr, reg?.reg_id ?? null, isRepeat, s.user.id]
        );
        await q('INSERT INTO rec_events (rec_id, at, actor_user_id, kind, note) VALUES (?, NOW(), ?, "raised", ?)', [
          recId,
          s.user.id,
          `Raised during ${inspectionId}${isRepeat ? ' (repeat finding on site)' : ''}.`,
        ]);
      }
    } else {
      // If changed from unsafe to safe/na before submission, remove draft recommendation if no events beyond raised
      const existingRec = await one<any>('SELECT id FROM recommendations WHERE inspection_id=? AND question_id=?', [inspectionId, questionId]);
      if (existingRec) {
        await q('DELETE FROM recommendations WHERE id=?', [existingRec.id]);
      }
    }

    return NextResponse.json({ ok: true });
  }

  if (action === 'submit') {
    const inspectionId = String(body.inspectionId || '');
    const insp = await one<any>(
      `SELECT i.*, st.name AS site_name, m.id AS member_id, m.name AS member_name,
              c.id AS contact_id, c.name AS contact_name, c.email AS contact_email
         FROM inspections i
         JOIN sites st ON st.id = i.site_id
         JOIN members m ON m.id = st.member_id
         LEFT JOIN member_contacts c ON c.member_id = m.id AND c.is_primary = 1
        WHERE i.id=? AND i.tenant_id=?`,
      [inspectionId, s.tenantId]
    );
    if (!insp) return NextResponse.json({ error: 'Inspection not found.' }, { status: 404 });
    if (insp.submitted_at) return NextResponse.json({ error: 'Inspection already submitted.' }, { status: 409 });

    await q('UPDATE inspections SET submitted_at=NOW() WHERE id=?', [inspectionId]);
    await audit(s.tenantId, s.user.id, 'inspection.submitted', 'inspection', inspectionId);

    if (insp.contact_id && insp.contact_email) {
      const rawToken = randomBytes(20).toString('hex');
      const tokenHash = hashToken(rawToken);
      const exp = new Date();
      exp.setDate(exp.getDate() + 90);
      await q('INSERT INTO magic_links (id, contact_id, inspection_id, token_hash, expires_at) VALUES (?,?,?,?,?)', [
        randomUUID(),
        insp.contact_id,
        inspectionId,
        tokenHash,
        exp.toISOString().slice(0, 19).replace('T', ' '),
      ]);

      const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
      await sendMail({
        to: insp.contact_email,
        subject: `Inspection Report Ready: ${insp.member_name} · ${insp.site_name} (${inspectionId})`,
        text: `Hello ${insp.contact_name},\n\nYour safety inspection report (${inspectionId}) for ${insp.site_name} has been submitted.\n\nView your report and respond to any open recommendations here:\n${appUrl}/portal/${rawToken}`,
      });
    }

    return NextResponse.json({ ok: true, message: `Inspection ${inspectionId} submitted and locked for 7 years.` });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}

