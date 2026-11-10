import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import {
  getOptionalSession,
  getOptionalPlatformSession,
  apiErrorResponse,
  ApiAuthError,
} from '@/lib/session';
import { verifySameOrigin } from '@/lib/security';
import { q, one, audit, platformAudit } from '@/lib/db';
import { listBookRecommendations } from '@/lib/queries';

const TRIGGERS = ['Regulatory', 'Best Practice', 'Program', 'Training', 'Maintenance', 'Record Keeping'];
const PRIORITIES = ['High', 'Med', 'Low'];
const SCOPES = ['site_specific', 'corporate'];

export async function GET() {
  try {
    const [teamSess, platSess] = await Promise.all([getOptionalSession(), getOptionalPlatformSession()]);
    if (!teamSess && !platSess) throw new ApiAuthError(401, 'Authentication required.');
    const items = await listBookRecommendations(teamSess?.tenantId ?? null);
    return NextResponse.json({ items });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const csrf = verifySameOrigin(req);
    if (!csrf.ok) throw new ApiAuthError(403, csrf.error);

    const [teamSess, platSess] = await Promise.all([getOptionalSession(), getOptionalPlatformSession()]);
    if (!teamSess && !platSess) throw new ApiAuthError(401, 'Authentication required.');

    const canMaster = Boolean(platSess?.permissions.has('platform:forms.master_manage'));
    const canTenant = Boolean(teamSess?.permissions.has('team:forms.tenant_manage'));

    const body = await req.json();
    const { action } = body as { action: string };

    if (action === 'save') {
      const wantMaster = body.libraryScope === 'platform' || (!teamSess && canMaster);
      if (wantMaster && !canMaster) {
        throw new ApiAuthError(403, 'Only Platform Compliance Editors can edit Master Book of Recommendations entries.');
      }
      if (!wantMaster && !canTenant) {
        throw new ApiAuthError(403, 'Missing team:forms.tenant_manage permission.');
      }

      const title = String(body.title || '').trim().slice(0, 220);
      const recBody = String(body.body || '').trim();
      const triggerType = TRIGGERS.includes(body.triggerType) ? body.triggerType : 'Regulatory';
      const priority = PRIORITIES.includes(body.priority) ? body.priority : 'Med';
      const scope = SCOPES.includes(body.scope) ? body.scope : 'site_specific';
      const topic = String(body.topic || 'general').trim().slice(0, 40);
      const regId = body.regId ? String(body.regId).trim() : null;

      if (!title || !recBody) {
        return NextResponse.json({ error: 'Recommendation title and standard wording body are required.' }, { status: 400 });
      }

      const id = body.id ? String(body.id) : 'br-' + randomUUID().slice(0, 8);
      const existing = body.id ? await one<any>('SELECT * FROM book_recommendations WHERE id=?', [id]) : null;
      if (existing) {
        if (existing.tenant_id === null && !canMaster) {
          throw new ApiAuthError(403, 'Cannot overwrite a Master Book entry from a tenant account.');
        }
        if (existing.tenant_id !== null && (!teamSess || existing.tenant_id !== teamSess.tenantId)) {
          throw new ApiAuthError(403, 'Entry belongs to another workspace.');
        }
      }

      const targetTenantId = existing ? existing.tenant_id : wantMaster ? null : teamSess!.tenantId;
      const actorId = wantMaster ? platSess!.platformUserId : teamSess!.user.id;

      await q(
        `INSERT INTO book_recommendations (id, tenant_id, title, body, trigger_type, priority, scope, topic, reg_id, status, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,'active',?)
         ON DUPLICATE KEY UPDATE
           title=VALUES(title), body=VALUES(body), trigger_type=VALUES(trigger_type),
           priority=VALUES(priority), scope=VALUES(scope), topic=VALUES(topic), reg_id=VALUES(reg_id), status='active'`,
        [id, targetTenantId, title, recBody, triggerType, priority, scope, topic, regId, actorId]
      );

      if (targetTenantId) {
        await audit(targetTenantId, teamSess!.user.id, 'book_rec.saved', 'book_recommendation', id, { title, triggerType }, teamSess!.impersonation?.platformUserId);
      } else {
        await platformAudit(platSess!.platformUserId, 'book_rec.master_saved', null, 'book_recommendation', id, { title, triggerType });
      }

      return NextResponse.json({ ok: true, id, message: `Saved "${title}" to Book of Recommendations.` });
    }

    if (action === 'archive') {
      const id = String(body.id || '');
      const existing = await one<any>('SELECT * FROM book_recommendations WHERE id=?', [id]);
      if (!existing) return NextResponse.json({ error: 'Entry not found.' }, { status: 404 });
      if (existing.tenant_id === null && !canMaster) throw new ApiAuthError(403, 'Cannot archive Master entry.');
      if (existing.tenant_id !== null && (!teamSess || existing.tenant_id !== teamSess.tenantId)) {
        throw new ApiAuthError(403, 'Entry belongs to another workspace.');
      }

      await q("UPDATE book_recommendations SET status='archived' WHERE id=?", [id]);
      return NextResponse.json({ ok: true, message: 'Book recommendation archived.' });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

