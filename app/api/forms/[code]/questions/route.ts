import { NextResponse } from 'next/server';
import { getSession, can } from '@/lib/session';
import { q, one, audit } from '@/lib/db';

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const formCode = code.toUpperCase();
  const s = await getSession();
  if (!can.editFormsAndRegs(s)) {
    return NextResponse.json({ error: 'Only Owners and Admins can edit form templates.' }, { status: 403 });
  }

  const form = await one<any>('SELECT * FROM forms WHERE code=?', [formCode]);
  if (!form) return NextResponse.json({ error: 'Form not found.' }, { status: 404 });

  const body = await req.json();
  const { action } = body as { action: string };

  if (action === 'update') {
    const questionId = String(body.questionId || '');
    const existing = await one<any>('SELECT * FROM questions WHERE form_code=? AND question_id=?', [formCode, questionId]);
    if (!existing) return NextResponse.json({ error: 'Question not found.' }, { status: 404 });

    const questionText = String(body.questionText || '').trim();
    const recommendation = String(body.recommendation || '').trim() || null;
    const priority = ['High', 'Med', 'Low'].includes(body.priority) ? body.priority : existing.priority;
    const topic = String(body.topic || existing.topic).trim();
    const answerType = String(body.answerType || existing.answer_type).trim();
    const naLabel = String(body.naLabel ?? '').trim() || null;
    const requiresRec = body.requiresRec ? 1 : 0;
    const photoRequired = body.photoRequired ? 1 : 0;
    const measureUnit = String(body.measureUnit ?? '').trim() || null;
    const comparison = ['min', 'max', 'exact', 'range'].includes(body.comparison) ? body.comparison : null;
    const threshold = body.threshold === '' || body.threshold === null || body.threshold === undefined ? null : Number(body.threshold);
    const detach = !!body.detach;

    if (!questionText) return NextResponse.json({ error: 'Question text is required.' }, { status: 400 });

    if (existing.is_shared && detach) {
      // Detach this question from the shared SHR-* key into a form-specific key
      const parts = questionId.split('.');
      const newKey = `${formCode}-${String(existing.section_no).padStart(2, '0')}-${String(parts[1] || '99').padStart(2, '0')}`;
      await q(
        `UPDATE questions SET question_key=?, is_shared=0, question_text=?, recommendation=?, priority=?, topic=?, answer_type=?, na_label=?,
                requires_rec=?, photo_required=?, measure_unit=?, comparison=?, threshold=?
          WHERE form_code=? AND question_id=?`,
        [newKey, questionText, recommendation, priority, topic, answerType, naLabel, requiresRec, photoRequired, measureUnit, comparison, threshold, formCode, questionId]
      );
      await q('UPDATE forms SET version = version + 1, published_at = NOW() WHERE code=?', [formCode]);
      await audit(s.tenantId, s.user.id, 'question.detached', 'question', newKey, { fromKey: existing.question_key, formCode, questionId });
      return NextResponse.json({ ok: true, message: `Question ${questionId} detached from ${existing.question_key} as ${newKey}.` });
    }

    if (existing.is_shared) {
      // Shared question updates all forms referencing this question_key
      await q(
        `UPDATE questions SET question_text=?, recommendation=?, priority=?, topic=?, answer_type=?, na_label=?,
                requires_rec=?, photo_required=?, measure_unit=?, comparison=?, threshold=?
          WHERE question_key=?`,
        [questionText, recommendation, priority, topic, answerType, naLabel, requiresRec, photoRequired, measureUnit, comparison, threshold, existing.question_key]
      );
      await q('UPDATE forms SET version = version + 1, published_at = NOW() WHERE code IN (SELECT DISTINCT form_code FROM questions WHERE question_key=?)', [existing.question_key]);
      await audit(s.tenantId, s.user.id, 'question.shared_updated', 'question', existing.question_key, { questionText, priority });
      return NextResponse.json({ ok: true, message: `Shared question ${existing.question_key} updated across all forms using it.` });
    }

    await q(
      `UPDATE questions SET question_text=?, recommendation=?, priority=?, topic=?, answer_type=?, na_label=?,
              requires_rec=?, photo_required=?, measure_unit=?, comparison=?, threshold=?
        WHERE form_code=? AND question_id=?`,
      [questionText, recommendation, priority, topic, answerType, naLabel, requiresRec, photoRequired, measureUnit, comparison, threshold, formCode, questionId]
    );
    await q('UPDATE forms SET version = version + 1, published_at = NOW() WHERE code=?', [formCode]);
    await audit(s.tenantId, s.user.id, 'question.updated', 'question', existing.question_key, { formCode, questionId, priority });
    return NextResponse.json({ ok: true, message: `Question ${questionId} updated.` });
  }

  if (action === 'create') {
    const sectionNo = Number(body.sectionNo);
    const questionText = String(body.questionText || '').trim();
    const recommendation = String(body.recommendation || '').trim() || null;
    const priority = ['High', 'Med', 'Low'].includes(body.priority) ? body.priority : 'Med';
    const topic = String(body.topic || 'general').trim();
    const answerType = String(body.answerType || 'safe_unsafe_na').trim();
    const naLabel = String(body.naLabel ?? '').trim() || null;
    const requiresRec = body.requiresRec ? 1 : 0;
    const photoRequired = body.photoRequired ? 1 : 0;

    if (!sectionNo || !questionText) return NextResponse.json({ error: 'Section and question text are required.' }, { status: 400 });

    const existingInSec = await q<any>('SELECT question_id, sort_order FROM questions WHERE form_code=? AND section_no=? ORDER BY sort_order', [formCode, sectionNo]);
    const nextIdx = existingInSec.length + 1;
    const questionId = `${sectionNo}.${nextIdx}`;
    const questionKey = `${formCode}-${String(sectionNo).padStart(2, '0')}-${String(nextIdx).padStart(2, '0')}`;
    const maxSort = (await one<{ m: number }>('SELECT COALESCE(MAX(sort_order), 0) AS m FROM questions WHERE form_code=?', [formCode]))?.m ?? 0;

    await q(
      `INSERT INTO questions (form_code, question_id, question_key, section_no, sort_order, question_text, answer_type, na_label, requires_rec, photo_required, priority, topic, recommendation, is_shared)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
      [formCode, questionId, questionKey, sectionNo, maxSort + 1, questionText, answerType, naLabel, requiresRec, photoRequired, priority, topic, recommendation]
    );
    await q('UPDATE forms SET version = version + 1, published_at = NOW() WHERE code=?', [formCode]);
    await audit(s.tenantId, s.user.id, 'question.created', 'question', questionKey, { formCode, questionId });
    return NextResponse.json({ ok: true, message: `Question ${questionId} (${questionKey}) added to ${formCode}.` });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}

