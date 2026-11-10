import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { requireApiSession, apiErrorResponse } from '@/lib/session';
import { exec, nowSql } from '@/lib/db';
import { assertMemberInTenant, assertSiteInTenant } from '@/lib/acl';

export async function POST(req: Request) {
  try {
    const s = await requireApiSession(req, 'team:inspections.execute');
    const body = await req.json();
    const action = body.action;

    if (action === 'submit_report') {
      if (!body.consultant_verified) {
        return NextResponse.json(
          { error: 'Please confirm that you have reviewed the AI-generated report before submitting.' },
          { status: 400 }
        );
      }
      await assertMemberInTenant(s.tenantId, body.member_id);
      if (body.site_id) await assertSiteInTenant(s.tenantId, body.site_id);

      const id = 'qr-' + randomBytes(4).toString('hex');
      const canReleaseDirectly = Boolean(body.deliver_immediately && s.permissions.has('team:qc.approve'));
      const nextJobStatus = canReleaseDirectly ? 'delivered' : 'in_qc';

      await exec(
        `INSERT INTO quick_reports
          (id, tenant_id, job_id, member_id, site_id, author_id, template_type, title, incident_date,
           sections_json, photos_json, voice_transcript, field_notes, ai_generated, ai_model_used,
           consultant_verified, verified_by_name, verified_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1, ?, ?, ?)`,
        [
          id,
          s.tenantId,
          body.job_id || null,
          body.member_id,
          body.site_id || null,
          s.user.id,
          ['post_incident', 'equipment_breakdown', 'followup_survey', 'commercial_supplement'].includes(body.template_type)
            ? body.template_type
            : 'post_incident',
          String(body.title || 'Post-Incident Loss Control Review').slice(0, 220),
          body.incident_date || new Date().toISOString().slice(0, 10),
          JSON.stringify(body.sections || {}),
          JSON.stringify(body.photos || []),
          body.voice_transcript || null,
          body.field_notes || null,
          body.ai_model_used || 'aws_bedrock:qwen.qwen2.5-32b-instruct-v1:0',
          body.verified_by_name || s.user.name,
          nowSql(),
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

      return NextResponse.json({ ok: true, id, status: nextJobStatus });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
