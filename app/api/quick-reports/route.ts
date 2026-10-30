import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getSession } from '@/lib/session';
import { exec } from '@/lib/db';

export async function POST(req: Request) {
  const s = await getSession();
  const body = await req.json();
  const action = body.action;

  if (action === 'submit_report') {
    if (!body.consultant_verified) {
      return NextResponse.json(
        { error: 'Please confirm that you have reviewed the AI-generated report before submitting.' },
        { status: 400 }
      );
    }
    const id = 'qr-' + randomBytes(4).toString('hex');
    const nextJobStatus = body.deliver_immediately ? 'delivered' : 'in_qc';

    await exec(
      `INSERT INTO quick_reports
        (id, tenant_id, job_id, member_id, site_id, author_id, template_type, title, incident_date,
         sections_json, photos_json, voice_transcript, field_notes, ai_generated, ai_model_used,
         consultant_verified, verified_by_name, verified_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1, ?, NOW(), ?)`,
      [
        id,
        s.tenantId,
        body.job_id || null,
        body.member_id,
        body.site_id || null,
        s.user.id,
        body.template_type || 'post_incident',
        body.title || 'Post-Incident Loss Control Review',
        body.incident_date || new Date().toISOString().slice(0, 10),
        JSON.stringify(body.sections || {}),
        JSON.stringify(body.photos || []),
        body.voice_transcript || null,
        body.field_notes || null,
        body.ai_model_used || 'aws_bedrock:qwen.qwen2.5-32b-instruct-v1:0',
        body.verified_by_name || s.user.name,
        nextJobStatus,
      ]
    );

    if (body.job_id) {
      await exec('UPDATE work_jobs SET status=?, quick_report_id=? WHERE id=? AND tenant_id=?', [
        nextJobStatus,
        id,
        body.job_id,
        s.tenantId,
      ]);
    }

    return NextResponse.json({ ok: true, id });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

