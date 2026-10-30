import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getSession } from '@/lib/session';
import { exec } from '@/lib/db';

export async function POST(req: Request) {
  const s = await getSession();
  const body = await req.json();
  const action = body.action;

  if (action === 'publish_observations') {
    const items = Array.isArray(body.observations) ? body.observations : [];
    const createdIds: string[] = [];

    for (const item of items) {
      const id = 'obs-' + randomBytes(4).toString('hex');
      createdIds.push(id);
      await exec(
        `INSERT INTO observations
          (id, tenant_id, job_id, member_id, site_id, created_by, title, description, corrective_action,
           specific_location, assigned_company, priority, status, federal_citation, state_citation,
           photo_url, photo_kind, voice_transcript, ai_generated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, 1)`,
        [
          id,
          s.tenantId,
          body.job_id || null,
          body.member_id,
          body.site_id || null,
          s.user.id,
          item.title || 'Field Safety Observation',
          item.description || '',
          item.corrective_action || '',
          item.specific_location || null,
          item.assigned_company || null,
          item.priority || 'High',
          item.federal_citation || '29 CFR 1926.1053(b)(1)',
          item.state_citation || 'Cal/OSHA 8 CCR §1675(i)',
          item.photo_url || '/brand/logo.png',
          item.photo_kind || 'hazard',
          body.voice_transcript || null,
        ]
      );
    }

    if (body.job_id) {
      await exec('UPDATE work_jobs SET status=IF(status IN ("received","scheduled"), "visit_done", status) WHERE id=? AND tenant_id=?', [
        body.job_id,
        s.tenantId,
      ]);
    }

    return NextResponse.json({ ok: true, createdIds });
  }

  if (action === 'update_status') {
    await exec('UPDATE observations SET status=? WHERE id=? AND tenant_id=?', [body.status, body.id, s.tenantId]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

