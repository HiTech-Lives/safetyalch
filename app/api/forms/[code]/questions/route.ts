import { NextResponse } from 'next/server';
import {
  getOptionalSession,
  getOptionalPlatformSession,
  apiErrorResponse,
  ApiAuthError,
} from '@/lib/session';
import { verifySameOrigin } from '@/lib/security';
import { q, one, audit, platformAudit, nowSql } from '@/lib/db';

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const csrf = verifySameOrigin(req);
    if (!csrf.ok) throw new ApiAuthError(403, csrf.error);

    const { code } = await params;
    const formCode = code.toUpperCase();

    const [teamSess, platSess] = await Promise.all([getOptionalSession(), getOptionalPlatformSession()]);
    if (!teamSess && !platSess) throw new ApiAuthError(401, 'Authentication required.');

    const canMaster = Boolean(platSess?.permissions.has('platform:forms.master_manage'));
    const canTenant = Boolean(teamSess?.permissions.has('team:forms.tenant_manage'));

    const form = await one<any>('SELECT * FROM forms WHERE code=?', [formCode]);
    if (!form) return NextResponse.json({ error: 'Form not found.' }, { status: 404 });

    const isMasterForm = form.tenant_id === null;
    if (isMasterForm && !canMaster) {
      return NextResponse.json(
        { error: 'Master templates can only be edited by Platform Compliance Editors. Clone this form to customize it for your workspace.' },
        { status: 403 }
      );
    }
    if (!isMasterForm && (!canTenant || !teamSess || form.tenant_id !== teamSess.tenantId)) {
      return NextResponse.json({ error: 'Forbidden: template belongs to another workspace or missing permission.' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body as { action: string };

    if (action === 'update') {
      const questionId = String(body.questionId || '');
      const existing = await one<any>('SELECT * FROM questions WHERE form_code=? AND question_id=?', [formCode, questionId]);
      if (!existing) return NextResponse.json({ error: 'Question not found.' }, { status: 404 });

      const questionText = String(body.questionText || '').trim();
      const recommendation = String(body.recommendation ?? '').trim() || null;
      const priority = ['High', 'Med', 'Low'].includes(body.priority) ? body.priority : existing.priority;
      const topic = String(body.topic || existing.topic).trim().slice(0, 40);
      const answerType = String(body.answerType || existing.answer_type).trim().slice(0, 20);
      const naLabel = String(body.naLabel ?? '').trim() || null;
      const requiresRec = body.requiresRec ? 1 : 0;
      const photoRequired = body.photoRequired ? 1 : 0;
      const measureUnit = String(body.measureUnit ?? '').trim().slice(0, 20) || null;
      const comparison = ['min', 'max', 'exact', 'range'].includes(body.comparison) ? body.comparison : null;
      const threshold = body.threshold === '' || body.threshold === null || body.threshold === undefined ? null : Number(body.threshold);
      const thresholdMax = body.thresholdMax === '' || body.thresholdMax === null || body.thresholdMax === undefined ? null : Number(body.thresholdMax);

      // Tenant admins can NEVER mutate shared SHR-* items globally; auto-detach or require detach!
      const detach = Boolean(body.detach) || (Boolean(existing.is_shared) && !canMaster);

      if (!questionText) return NextResponse.json({ error: 'Question text is required.' }, { status: 400 });

      if (existing.is_shared && detach) {
        const parts = questionId.split('.');
        const newKey = `${formCode}-${String(existing.section_no).padStart(2, '0')}-${String(parts[1] || '99').padStart(2, '0')}`.slice(0, 32);
        await q(
          `UPDATE questions SET question_key=?, is_shared=0, question_text=?, recommendation=?, priority=?, topic=?, answer_type=?, na_label=?,
                  requires_rec=?, photo_required=?, measure_unit=?, comparison=?, threshold=?, threshold_max=?
            WHERE form_code=? AND question_id=?`,
          [
            newKey,
            questionText,
            recommendation,
            priority,
            topic,
            answerType,
            naLabel,
            requiresRec,
            photoRequired,
            measureUnit,
            comparison,
            threshold,
            thresholdMax,
            formCode,
            questionId,
          ]
        );
        await q('UPDATE forms SET version = version + 1, published_at = ? WHERE code=?', [nowSql(), formCode]);
        if (!isMasterForm && teamSess) {
          await audit(
            teamSess.tenantId,
            teamSess.user.id,
            'question.detached',
            'question',
            newKey,
            { fromKey: existing.question_key, formCode, questionId },
            teamSess.impersonation?.platformUserId
          );
        }
        return NextResponse.json({ ok: true, message: `Question ${questionId} detached from ${existing.question_key} as ${newKey}.` });
      }

      if (existing.is_shared && canMaster) {
        await q(
          `UPDATE questions SET question_text=?, recommendation=?, priority=?, topic=?, answer_type=?, na_label=?,
                  requires_rec=?, photo_required=?, measure_unit=?, comparison=?, threshold=?, threshold_max=?
            WHERE question_key=?`,
          [
            questionText,
            recommendation,
            priority,
            topic,
            answerType,
            naLabel,
            requiresRec,
            photoRequired,
            measureUnit,
            comparison,
            threshold,
            thresholdMax,
            existing.question_key,
          ]
        );
        await q(
          'UPDATE forms SET version = version + 1, published_at = ? WHERE code IN (SELECT DISTINCT form_code FROM questions WHERE question_key=?)',
          [nowSql(), existing.question_key]
        );
        await platformAudit(platSess!.platformUserId, 'question.shared_updated', null, 'question', existing.question_key, {
          questionText,
          priority,
        });
        return NextResponse.json({ ok: true, message: `Shared question ${existing.question_key} updated across all master forms.` });
      }

      await q(
        `UPDATE questions SET question_text=?, recommendation=?, priority=?, topic=?, answer_type=?, na_label=?,
                requires_rec=?, photo_required=?, measure_unit=?, comparison=?, threshold=?, threshold_max=?
          WHERE form_code=? AND question_id=?`,
        [
          questionText,
          recommendation,
          priority,
          topic,
          answerType,
          naLabel,
          requiresRec,
          photoRequired,
          measureUnit,
          comparison,
          threshold,
          thresholdMax,
          formCode,
          questionId,
        ]
      );
      await q('UPDATE forms SET version = version + 1, published_at = ? WHERE code=?', [nowSql(), formCode]);

      if (isMasterForm) {
        await platformAudit(platSess!.platformUserId, 'question.master_updated', null, 'question', existing.question_key, { formCode, questionId });
      } else {
        await audit(teamSess!.tenantId, teamSess!.user.id, 'question.updated', 'question', existing.question_key, { formCode, questionId }, teamSess!.impersonation?.platformUserId);
      }
      return NextResponse.json({ ok: true, message: `Question ${questionId} updated.` });
    }

    if (action === 'create') {
      const sectionNo = Number(body.sectionNo);
      const questionText = String(body.questionText || '').trim();
      const recommendation = String(body.recommendation || '').trim() || null;
      const priority = ['High', 'Med', 'Low'].includes(body.priority) ? body.priority : 'Med';
      const topic = String(body.topic || 'general').trim().slice(0, 40);
      const answerType = String(body.answerType || form.scale || 'safe_unsafe_na').trim().slice(0, 20);
      const naLabel = String(body.naLabel ?? '').trim() || null;
      const requiresRec = body.requiresRec !== false ? 1 : 0;
      const photoRequired = body.photoRequired ? 1 : 0;
      const measureUnit = String(body.measureUnit ?? '').trim().slice(0, 20) || null;
      const comparison = ['min', 'max', 'exact', 'range'].includes(body.comparison) ? body.comparison : null;
      const threshold = body.threshold === '' || body.threshold === null || body.threshold === undefined ? null : Number(body.threshold);

      if (!sectionNo || !questionText) {
        return NextResponse.json({ error: 'Section and question text are required.' }, { status: 400 });
      }

      const existingInSec = await q<any>('SELECT question_id, sort_order FROM questions WHERE form_code=? AND section_no=? ORDER BY sort_order', [formCode, sectionNo]);
      let nextIdx = existingInSec.length + 1;
      let questionId = `${sectionNo}.${nextIdx}`.slice(0, 10);
      while (await one('SELECT question_id FROM questions WHERE form_code=? AND question_id=?', [formCode, questionId])) {
        nextIdx++;
        questionId = `${sectionNo}.${nextIdx}`.slice(0, 10);
      }
      const questionKey = `${formCode}-${String(sectionNo).padStart(2, '0')}-${String(nextIdx).padStart(2, '0')}`.slice(0, 32);
      const maxSort = (await one<{ m: number }>('SELECT COALESCE(MAX(sort_order), 0) AS m FROM questions WHERE form_code=?', [formCode]))?.m ?? 0;

      await q(
        `INSERT INTO questions (form_code, question_id, question_key, section_no, sort_order, question_text, answer_type, na_label, requires_rec, photo_required, priority, topic, measure_unit, comparison, threshold, recommendation, is_shared)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
        [
          formCode,
          questionId,
          questionKey,
          sectionNo,
          maxSort + 1,
          questionText,
          answerType,
          naLabel,
          requiresRec,
          photoRequired,
          priority,
          topic,
          measureUnit,
          comparison,
          threshold,
          recommendation,
        ]
      );

      if (body.regId) {
        const jur = String(body.regJurisdiction || 'FED').toUpperCase().slice(0, 8);
        await q(
          `INSERT IGNORE INTO question_regulations (question_key, jurisdiction, reg_id, is_primary, measure_unit, comparison, threshold)
           VALUES (?,?,?,1,?,?,?)`,
          [questionKey, jur, String(body.regId), measureUnit, comparison, threshold]
        );
      }

      await q('UPDATE forms SET version = version + 1, published_at = ? WHERE code=?', [nowSql(), formCode]);
      if (isMasterForm) {
        await platformAudit(platSess!.platformUserId, 'question.master_created', null, 'question', questionKey, { formCode, questionId });
      } else {
        await audit(teamSess!.tenantId, teamSess!.user.id, 'question.created', 'question', questionKey, { formCode, questionId }, teamSess!.impersonation?.platformUserId);
      }
      return NextResponse.json({ ok: true, questionId, questionKey, message: `Question ${questionId} (${questionKey}) added to ${formCode}.` });
    }

    if (action === 'reorder') {
      const questionId = String(body.questionId || '');
      const direction = body.direction === 'up' ? 'up' : 'down';
      const cur = await one<any>('SELECT * FROM questions WHERE form_code=? AND question_id=?', [formCode, questionId]);
      if (!cur) return NextResponse.json({ error: 'Question not found.' }, { status: 404 });

      const neighbor = await one<any>(
        direction === 'up'
          ? 'SELECT * FROM questions WHERE form_code=? AND section_no=? AND sort_order < ? ORDER BY sort_order DESC LIMIT 1'
          : 'SELECT * FROM questions WHERE form_code=? AND section_no=? AND sort_order > ? ORDER BY sort_order ASC LIMIT 1',
        [formCode, cur.section_no, cur.sort_order]
      );
      if (neighbor) {
        await q('UPDATE questions SET sort_order=? WHERE form_code=? AND question_id=?', [neighbor.sort_order, formCode, cur.question_id]);
        await q('UPDATE questions SET sort_order=? WHERE form_code=? AND question_id=?', [cur.sort_order, formCode, neighbor.question_id]);
      }
      return NextResponse.json({ ok: true, message: 'Question order updated.' });
    }

    if (action === 'delete') {
      const questionId = String(body.questionId || '');
      const cur = await one<any>('SELECT * FROM questions WHERE form_code=? AND question_id=?', [formCode, questionId]);
      if (!cur) return NextResponse.json({ error: 'Question not found.' }, { status: 404 });

      const used = await one<{ n: number }>(
        `SELECT COUNT(*) AS n FROM answers a JOIN inspections i ON i.id = a.inspection_id
          WHERE i.form_code=? AND a.question_id=?`,
        [formCode, questionId]
      );
      if ((used?.n ?? 0) > 0) {
        return NextResponse.json(
          { error: 'Cannot delete a question that already has historical inspection answers. Clone a new form or edit text instead.' },
          { status: 409 }
        );
      }

      await q('DELETE FROM questions WHERE form_code=? AND question_id=?', [formCode, questionId]);
      return NextResponse.json({ ok: true, message: `Question ${questionId} removed.` });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
