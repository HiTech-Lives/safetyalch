import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireApiSession, apiErrorResponse } from '@/lib/session';
import { q, one, audit, nowSql } from '@/lib/db';
import { genId, generateOpaqueToken, sha256Hex, validateAndStoreUpload } from '@/lib/security';
import { getTenant } from '@/lib/queries';
import { sendMail } from '@/lib/email';
import { PRIORITY_DAYS } from '@/lib/format';

const VALID_ANSWER_VALUES = new Set([
  'safe',
  'unsafe',
  'na',
  'absent',
  'written',
  'practiced',
  'owned',
  'addressed',
  'partial',
  'not_addressed',
  'acceptable',
  'needs_improvement',
  'score_1',
  'score_2',
  'score_3',
  'score_4',
  'score_5',
  'points',
]);

const DEFICIENT_VALUES = new Set([
  'unsafe',
  'not_addressed',
  'partial',
  'needs_improvement',
  'score_4',
  'score_5',
]);

const VALID_TRIGGERS = ['Regulatory', 'Best Practice', 'Program', 'Training', 'Maintenance', 'Record Keeping'];

async function resolveJurisdictionRegId(questionKey: string, topic: string, jurisdiction: string, tenantId: string) {
  const mapped =
    (await one<{ reg_id: string }>(
      'SELECT reg_id FROM question_regulations WHERE question_key=? AND jurisdiction=? ORDER BY is_primary DESC LIMIT 1',
      [questionKey, jurisdiction]
    )) ||
    (await one<{ reg_id: string }>(
      "SELECT reg_id FROM question_regulations WHERE question_key=? AND jurisdiction='FED' ORDER BY is_primary DESC LIMIT 1",
      [questionKey]
    ));
  if (mapped) return mapped.reg_id;

  const fallback =
    (await one<{ reg_id: string }>(
      "SELECT reg_id FROM regulations WHERE topic=? AND jurisdiction=? AND (tenant_id IS NULL OR tenant_id=?) AND status <> 'superseded' ORDER BY tenant_id DESC LIMIT 1",
      [topic, jurisdiction, tenantId]
    )) ||
    (await one<{ reg_id: string }>(
      "SELECT reg_id FROM regulations WHERE topic=? AND jurisdiction='FED' AND (tenant_id IS NULL OR tenant_id=?) AND status <> 'superseded' ORDER BY tenant_id DESC LIMIT 1",
      [topic, tenantId]
    ));
  return fallback?.reg_id ?? null;
}

async function nextRecNumber(inspectionId: string): Promise<string> {
  const cnt = await one<{ n: number }>('SELECT COUNT(*) AS n FROM recommendations WHERE inspection_id=?', [inspectionId]);
  const seq = String((cnt?.n ?? 0) + 1).padStart(2, '0');
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${yy}*${seq}`;
}

export async function POST(req: Request) {
  try {
    const s = await requireApiSession(req, 'team:inspections.execute');
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
        'SELECT st.*, m.name AS member_name, m.tenant_id, m.employee_count AS member_employees FROM sites st JOIN members m ON m.id = st.member_id WHERE st.id=? AND m.tenant_id=?',
        [siteId, s.tenantId]
      );
      if (!site) return NextResponse.json({ error: 'Site not found in this workspace.' }, { status: 404 });

      const form = await one<any>('SELECT * FROM forms WHERE code=? AND (tenant_id IS NULL OR tenant_id=?) AND is_archived=0', [
        formCode,
        s.tenantId,
      ]);
      if (!form) return NextResponse.json({ error: 'Form template not found.' }, { status: 404 });

      const inspId = genId('I');
      const initialMeta = {
        employeesOnSite: site.employee_count ?? site.member_employees ?? null,
        ...(body.meta && typeof body.meta === 'object' ? body.meta : {}),
      };

      await q(
        `INSERT INTO inspections (id, tenant_id, visit_id, site_id, form_code, form_version, consultant_id, device_id, meta_json, started_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [inspId, s.tenantId, visitId, siteId, formCode, form.version, s.user.id, 'web-field-' + s.user.id, JSON.stringify(initialMeta), nowSql()]
      );
      await audit(
        s.tenantId,
        s.user.id,
        'inspection.started',
        'inspection',
        inspId,
        { siteId, formCode, visitId },
        s.impersonation?.platformUserId
      );
      return NextResponse.json({ ok: true, inspectionId: inspId });
    }

    if (action === 'update_meta') {
      const inspectionId = String(body.inspectionId || '');
      const insp = await one<any>('SELECT * FROM inspections WHERE id=? AND tenant_id=?', [inspectionId, s.tenantId]);
      if (!insp) return NextResponse.json({ error: 'Inspection not found.' }, { status: 404 });
      if (insp.submitted_at) return NextResponse.json({ error: 'Submitted inspections are immutable.' }, { status: 409 });

      let prev: Record<string, any> = {};
      if (typeof insp.meta_json === 'string' && insp.meta_json.trim()) {
        try { prev = JSON.parse(insp.meta_json); } catch { prev = {}; }
      } else if (insp.meta_json && typeof insp.meta_json === 'object') {
        prev = insp.meta_json;
      }
      const merged = { ...prev, ...(body.meta && typeof body.meta === 'object' ? body.meta : {}) };
      await q('UPDATE inspections SET meta_json=? WHERE id=? AND tenant_id=?', [JSON.stringify(merged), inspectionId, s.tenantId]);
      return NextResponse.json({ ok: true, meta: merged });
    }

    if (action === 'answer') {
      const inspectionId = String(body.inspectionId || '');
      const questionId = String(body.questionId || '');
      const value = String(body.value || '');
      const measuredValue =
        body.measuredValue === '' || body.measuredValue === null || body.measuredValue === undefined
          ? null
          : Number(body.measuredValue);
      const naReason = String(body.naReason || '').trim().slice(0, 255) || null;
      const note = String(body.note || '').trim() || null;
      const actionOwner = String(body.actionOwner || '').trim().slice(0, 160) || null;
      const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.targetDate || '')) ? String(body.targetDate) : null;

      if (!VALID_ANSWER_VALUES.has(value)) {
        return NextResponse.json({ error: `Invalid answer value "${value}".` }, { status: 400 });
      }

      const insp = await one<any>(
        'SELECT i.*, st.jurisdiction FROM inspections i JOIN sites st ON st.id = i.site_id WHERE i.id=? AND i.tenant_id=?',
        [inspectionId, s.tenantId]
      );
      if (!insp) return NextResponse.json({ error: 'Inspection not found.' }, { status: 404 });
      if (insp.submitted_at) return NextResponse.json({ error: 'Inspection is already submitted and locked.' }, { status: 409 });

      const qn = await one<any>('SELECT * FROM questions WHERE form_code=? AND question_id=?', [insp.form_code, questionId]);
      if (!qn) return NextResponse.json({ error: 'Question not found.' }, { status: 404 });

      // Clamp points to [0, threshold] for LCE-100 scale
      let finalMeasured = measuredValue;
      if (value === 'points' && finalMeasured !== null) {
        const maxPts = qn.threshold !== null ? Number(qn.threshold) : 100;
        finalMeasured = Math.max(0, Math.min(maxPts, finalMeasured));
      }

      await q(
        `INSERT INTO answers (inspection_id, question_id, question_key, value, measured_value, na_reason, note, action_owner, target_date, answered_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           value=VALUES(value), measured_value=VALUES(measured_value), na_reason=VALUES(na_reason),
           note=VALUES(note), action_owner=VALUES(action_owner), target_date=VALUES(target_date), answered_at=VALUES(answered_at)`,
        [inspectionId, questionId, qn.question_key, value, finalMeasured, naReason, note, actionOwner, targetDate, nowSql()]
      );

      const isLowLceScore =
        value === 'points' && qn.threshold !== null && finalMeasured !== null && finalMeasured < Number(qn.threshold) * 0.5;
      const shouldRaiseRec =
        (DEFICIENT_VALUES.has(value) && Boolean(qn.requires_rec || body.recText)) ||
        Boolean(body.raiseRec) ||
        (isLowLceScore && Boolean(body.recText));

      if (shouldRaiseRec) {
        const recText = String(body.recText || qn.recommendation || `Address deficiency on Item ${questionId}: ${qn.question_text}`).trim();
        const recTitle = String(body.recTitle || qn.question_text.slice(0, 110)).trim().slice(0, 220);
        const priority = (['High', 'Med', 'Low'].includes(body.priority) ? body.priority : qn.priority) as 'High' | 'Med' | 'Low';
        const triggerType = VALID_TRIGGERS.includes(body.triggerType) ? body.triggerType : 'Regulatory';
        const scope = body.scope === 'corporate' ? 'corporate' : 'site_specific';
        const isLossTrend = body.isLossTrend ? 1 : 0;
        const costBand = ['L', 'M', 'H'].includes(body.costBand) ? body.costBand : null;

        const days = PRIORITY_DAYS[priority] ?? 30;
        const due = new Date();
        due.setDate(due.getDate() + days);
        const dueStr = targetDate || due.toISOString().slice(0, 10);

        const regId = body.regId
          ? String(body.regId)
          : await resolveJurisdictionRegId(qn.question_key, qn.topic, insp.jurisdiction, s.tenantId);

        const prior = await one<any>(
          `SELECT r.id FROM recommendations r
           JOIN inspections i2 ON i2.id = r.inspection_id
           WHERE i2.site_id = ? AND r.question_key = ? AND r.inspection_id <> ?
           LIMIT 1`,
          [insp.site_id, qn.question_key, inspectionId]
        );
        const isRepeat = prior ? 1 : 0;

        const existingRec = await one<any>('SELECT id FROM recommendations WHERE inspection_id=? AND question_id=?', [
          inspectionId,
          questionId,
        ]);
        if (existingRec) {
          await q(
            `UPDATE recommendations
                SET title=?, text=?, trigger_type=?, scope=?, is_loss_trend=?, cost_band=?,
                    priority=?, due_on=?, reg_id=?, is_repeat=?
              WHERE id=?`,
            [recTitle, recText, triggerType, scope, isLossTrend, costBand, priority, dueStr, regId, isRepeat, existingRec.id]
          );
        } else {
          const recId = genId('R');
          const recNum = await nextRecNumber(inspectionId);
          await q(
            `INSERT INTO recommendations
               (id, tenant_id, inspection_id, question_id, question_key, section_no, rec_number, title, text,
                trigger_type, scope, is_loss_trend, cost_band, priority, due_on, status, reg_id, is_repeat, created_by, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'open',?,?,?,?)`,
            [
              recId,
              s.tenantId,
              inspectionId,
              questionId,
              qn.question_key,
              qn.section_no,
              recNum,
              recTitle,
              recText,
              triggerType,
              scope,
              isLossTrend,
              costBand,
              priority,
              dueStr,
              regId,
              isRepeat,
              s.user.id,
              nowSql(),
            ]
          );
          await q('INSERT INTO rec_events (rec_id, at, actor_user_id, kind, note) VALUES (?, ?, ?, "raised", ?)', [
            recId,
            nowSql(),
            s.user.id,
            `Raised (${recNum}) during ${inspectionId}${isRepeat ? ' (repeat finding on site)' : ''}.`,
          ]);
        }
      } else {
        const existingRec = await one<any>('SELECT id FROM recommendations WHERE inspection_id=? AND question_id=?', [
          inspectionId,
          questionId,
        ]);
        if (existingRec) {
          await q('DELETE FROM rec_events WHERE rec_id=?', [existingRec.id]).catch(() => {});
          await q('DELETE FROM recommendations WHERE id=?', [existingRec.id]).catch(() => {});
        }
      }

      return NextResponse.json({ ok: true });
    }

    if (action === 'add_finding') {
      const inspectionId = String(body.inspectionId || '');
      const insp = await one<any>(
        'SELECT i.*, st.jurisdiction FROM inspections i JOIN sites st ON st.id = i.site_id WHERE i.id=? AND i.tenant_id=?',
        [inspectionId, s.tenantId]
      );
      if (!insp) return NextResponse.json({ error: 'Inspection not found.' }, { status: 404 });
      if (insp.submitted_at) return NextResponse.json({ error: 'Inspection is already submitted and locked.' }, { status: 409 });

      let title = String(body.title || '').trim().slice(0, 220);
      let text = String(body.text || '').trim();
      let triggerType = VALID_TRIGGERS.includes(body.triggerType) ? body.triggerType : 'Regulatory';
      let priority = (['High', 'Med', 'Low'].includes(body.priority) ? body.priority : 'Med') as 'High' | 'Med' | 'Low';
      let scope = body.scope === 'corporate' ? 'corporate' : 'site_specific';
      let regId: string | null = body.regId ? String(body.regId) : null;

      if (body.bookRecId) {
        const br = await one<any>(
          'SELECT * FROM book_recommendations WHERE id=? AND (tenant_id IS NULL OR tenant_id=?)',
          [String(body.bookRecId), s.tenantId]
        );
        if (br) {
          title = title || br.title;
          text = text || br.body;
          triggerType = body.triggerType ? triggerType : br.trigger_type;
          priority = body.priority ? priority : br.priority;
          scope = body.scope ? scope : br.scope;
          regId = regId || br.reg_id;
        }
      }

      if (!text) return NextResponse.json({ error: 'Recommendation wording is required.' }, { status: 400 });
      title = title || text.slice(0, 90);
      const isLossTrend = body.isLossTrend ? 1 : 0;
      const days = PRIORITY_DAYS[priority] ?? 30;
      const due = new Date();
      due.setDate(due.getDate() + days);
      const dueStr = body.dueOn || due.toISOString().slice(0, 10);

      const recId = genId('R');
      const recNum = await nextRecNumber(inspectionId);
      await q(
        `INSERT INTO recommendations
           (id, tenant_id, inspection_id, rec_number, title, text, trigger_type, scope, is_loss_trend,
            priority, due_on, status, reg_id, is_repeat, created_by, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,'open',?,0,?,?)`,
        [recId, s.tenantId, inspectionId, recNum, title, text, triggerType, scope, isLossTrend, priority, dueStr, regId, s.user.id, nowSql()]
      );
      await q('INSERT INTO rec_events (rec_id, at, actor_user_id, kind, note) VALUES (?, ?, ?, "raised", ?)', [
        recId,
        nowSql(),
        s.user.id,
        `Added (${recNum}) during ${inspectionId}.`,
      ]);
      return NextResponse.json({ ok: true, recId, recNumber: recNum, message: `Added recommendation ${recNum}.` });
    }

    if (action === 'upload_photo') {
      const inspectionId = String(body.inspectionId || '');
      const recId = body.recId ? String(body.recId) : null;
      const photoDataUrl = String(body.photoDataUrl || '').trim();
      const insp = await one<any>(
        'SELECT i.*, st.member_id FROM inspections i JOIN sites st ON st.id = i.site_id WHERE i.id=? AND i.tenant_id=?',
        [inspectionId, s.tenantId]
      );
      if (!insp) return NextResponse.json({ error: 'Inspection not found.' }, { status: 404 });
      if (!photoDataUrl.startsWith('data:image/')) {
        return NextResponse.json({ error: 'Valid PNG/JPEG/WebP image data is required.' }, { status: 400 });
      }

      const m = photoDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!m) return NextResponse.json({ error: 'Malformed image upload.' }, { status: 400 });
      const rawBuf = Buffer.from(m[2], 'base64');
      const fileObj = new File([rawBuf], `finding-${inspectionId}`, { type: m[1] });
      const validated = await validateAndStoreUpload(fileObj, s.tenantId, { maxBytes: 8 * 1024 * 1024 });

      await q(
        `INSERT INTO stored_files (id, tenant_id, member_id, inspection_id, mime_type, byte_size, disk_path, original_name, uploaded_by_user)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          validated.fileId,
          s.tenantId,
          insp.member_id,
          inspectionId,
          validated.mimeType,
          validated.byteSize,
          validated.diskPath,
          `finding-${inspectionId}.${validated.ext}`,
          s.user.id,
        ]
      );
      const photoUrl = `/api/files/${validated.fileId}`;
      const photoId = randomUUID();
      await q(
        `INSERT INTO photos (id, tenant_id, inspection_id, rec_id, kind, storage_key, annotated_key, captured_at, uploaded_by_user)
         VALUES (?,?,?,?,'finding',?,?,?,?)`,
        [photoId, s.tenantId, inspectionId, recId, photoUrl, body.caption ? String(body.caption).slice(0, 255) : null, nowSql(), s.user.id]
      );
      return NextResponse.json({ ok: true, photoId, url: photoUrl });
    }

    if (action === 'submit') {
      const inspectionId = String(body.inspectionId || '');
      const insp = await one<any>(
        `SELECT i.*, f.scale, st.name AS site_name, m.id AS member_id, m.name AS member_name,
                c.id AS contact_id, c.name AS contact_name, c.email AS contact_email
           FROM inspections i
           JOIN forms f ON f.code = i.form_code
           JOIN sites st ON st.id = i.site_id
           JOIN members m ON m.id = st.member_id
           LEFT JOIN member_contacts c ON c.member_id = m.id AND c.is_primary = 1
          WHERE i.id=? AND i.tenant_id=?`,
        [inspectionId, s.tenantId]
      );
      if (!insp) return NextResponse.json({ error: 'Inspection not found.' }, { status: 404 });
      if (insp.submitted_at) return NextResponse.json({ error: 'Inspection already submitted.' }, { status: 409 });

      // Enforce ARU Construction Part II RCA qualification rule unless explicitly waived
      if (insp.scale === 'rca_percent' && !body.waiveRcaRule) {
        let meta: any = {};
        if (typeof insp.meta_json === 'string' && insp.meta_json.trim()) {
          try { meta = JSON.parse(insp.meta_json); } catch { meta = {}; }
        } else if (insp.meta_json) {
          meta = insp.meta_json;
        }
        const empCount = Number(body.employeesOnSite ?? meta.employeesOnSite ?? 0);
        const applicableRow = await one<{ n: number }>(
          "SELECT COUNT(*) AS n FROM answers WHERE inspection_id=? AND value IN ('acceptable','needs_improvement')",
          [inspectionId]
        );
        const applicableCount = applicableRow?.n ?? 0;
        if (empCount < 2 || applicableCount < 30) {
          return NextResponse.json(
            {
              error: `ARU Construction Part II RCA requires at least 2 company employees on site (current: ${empCount}) and at least 30 applicable items rated (current: ${applicableCount}). Complete more items or confirm supervisor override.`,
              requiresRcaOverride: true,
            },
            { status: 409 }
          );
        }
      }

      await q('UPDATE inspections SET submitted_at=? WHERE id=? AND tenant_id=?', [nowSql(), inspectionId, s.tenantId]);
      await audit(s.tenantId, s.user.id, 'inspection.submitted', 'inspection', inspectionId, undefined, s.impersonation?.platformUserId);

      if (insp.contact_id && insp.contact_email) {
        const rawToken = generateOpaqueToken();
        const tokenHash = sha256Hex(rawToken);
        const expStr = nowSql(90 * 86400 * 1000);
        await q('INSERT INTO magic_links (id, contact_id, inspection_id, token_hash, expires_at) VALUES (?,?,?,?,?)', [
          randomUUID(),
          insp.contact_id,
          inspectionId,
          tokenHash,
          expStr,
        ]);

        const tenant = await getTenant(s);
        const verifiedFrom =
          tenant.brand_scopes?.email && tenant.email_sender_verified && tenant.email_sender ? tenant.email_sender : undefined;
        const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
        await sendMail({
          to: insp.contact_email,
          fromName: tenant.brand_scopes?.email ? tenant.name : 'The Safety Alchemist',
          fromAddress: verifiedFrom,
          subject: `Inspection Report Ready: ${insp.member_name} · ${insp.site_name} (${inspectionId})`,
          text: `Hello ${insp.contact_name},\n\nYour safety assessment report (${inspectionId}) for ${insp.site_name} has been submitted.\n\nView your report and respond to recommendations here:\n${appUrl}/portal/${rawToken}`,
        });
      }

      return NextResponse.json({ ok: true, message: `Assessment ${inspectionId} submitted and locked for 7 years.` });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
