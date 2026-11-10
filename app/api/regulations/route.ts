import { NextResponse } from 'next/server';
import {
  getOptionalSession,
  getOptionalPlatformSession,
  apiErrorResponse,
  ApiAuthError,
} from '@/lib/session';
import { verifySameOrigin } from '@/lib/security';
import { q, one, audit, platformAudit } from '@/lib/db';
import { todayISO } from '@/lib/format';

export async function POST(req: Request) {
  try {
    const csrf = verifySameOrigin(req);
    if (!csrf.ok) throw new ApiAuthError(403, csrf.error);

    const [teamSess, platSess] = await Promise.all([getOptionalSession(), getOptionalPlatformSession()]);
    if (!teamSess && !platSess) {
      throw new ApiAuthError(401, 'Authentication required.');
    }

    const canGlobal = Boolean(platSess?.permissions.has('platform:regulations.global_manage'));
    const canTenant = Boolean(
      teamSess &&
        (teamSess.permissions.has('team:regulations.supplemental_manage') ||
          teamSess.permissions.has('team:forms.tenant_manage'))
    );

    if (!canGlobal && !canTenant) {
      throw new ApiAuthError(403, 'Missing permission to manage regulatory citations.');
    }

    const body = await req.json();
    const { action } = body as { action: string };
    const requestedGlobal = body.scope === 'global' || (!teamSess && canGlobal);

    if (action === 'create') {
      if (requestedGlobal && !canGlobal) {
        return NextResponse.json(
          { error: 'Only Platform Compliance Editors can create Global citations. Create a Tenant-Supplemental citation instead.' },
          { status: 403 }
        );
      }
      const targetTenantId = requestedGlobal ? null : teamSess!.tenantId;
      const actorName = requestedGlobal ? platSess!.user.name : teamSess!.user.name;

      const jurisdiction = String(body.jurisdiction || 'CA').toUpperCase().slice(0, 8);
      const agency = String(body.agency || '').trim().slice(0, 60);
      const code = String(body.code || '').trim().slice(0, 60);
      const title = String(body.title || '').trim().slice(0, 255);
      const topic = String(body.topic || 'general').trim().slice(0, 40);
      const summary = String(body.summary || '').trim();
      const verbatimText = String(body.verbatimText || '').trim() || null;
      const sourceUrl = String(body.sourceUrl || '').trim() || 'https://www.osha.gov';
      const verifiedToday = Boolean((body.verifiedToday || body.verifyNow) && verbatimText);
      const notes = String(body.notes || '').trim() || null;

      if (!agency || !code || !title || !summary || !sourceUrl) {
        return NextResponse.json(
          { error: 'Agency, citation code, section title, summary, and official source URL are required.' },
          { status: 400 }
        );
      }

      const prefix = targetTenantId ? `${targetTenantId.slice(0, 6).toUpperCase()}-` : '';
      const regId = `${prefix}${jurisdiction}-${code.replace(/[^A-Za-z0-9]/g, '')}`.slice(0, 40);
      if (await one('SELECT reg_id FROM regulations WHERE reg_id=?', [regId])) {
        return NextResponse.json({ error: `Regulation ${regId} already exists. Use Supersede if the law changed.` }, { status: 409 });
      }

      const verifiedOn = verifiedToday ? todayISO() : null;
      const verifiedBy = verifiedToday ? actorName : null;
      const status = verifiedToday ? 'active' : 'UNVERIFIED - paste from source';

      await q(
        `INSERT INTO regulations (reg_id, tenant_id, jurisdiction, agency, code, title, topic, summary, verbatim_text, source_url, verified_on, verified_by, status, notes)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [regId, targetTenantId, jurisdiction, agency, code, title, topic, summary, verbatimText, sourceUrl, verifiedOn, verifiedBy, status, notes]
      );

      if (targetTenantId) {
        await audit(targetTenantId, teamSess!.user.id, 'regulation.created', 'regulation', regId, { code, jurisdiction, status }, teamSess!.impersonation?.platformUserId);
      } else {
        await platformAudit(platSess!.platformUserId, 'regulation.global_created', null, 'regulation', regId, { code, jurisdiction, status });
      }

      return NextResponse.json({ ok: true, message: `Regulation ${code} (${regId}) added.`, regId });
    }

    if (action === 'verify') {
      const regId = String(body.regId || '');
      const verbatimText = String(body.verbatimText || '').trim();
      const sourceUrl = String(body.sourceUrl || '').trim();
      const notes = String(body.notes || '').trim() || null;

      if (!verbatimText) {
        return NextResponse.json({ error: 'Paste or fetch the verbatim regulation text from the official agency source to verify.' }, { status: 400 });
      }

      const existing = await one<any>('SELECT * FROM regulations WHERE reg_id=?', [regId]);
      if (!existing) return NextResponse.json({ error: 'Regulation not found.' }, { status: 404 });

      if (existing.tenant_id === null && !canGlobal) {
        return NextResponse.json({ error: 'Only Platform Compliance Editors can modify global citations.' }, { status: 403 });
      }
      if (existing.tenant_id !== null && (!teamSess || existing.tenant_id !== teamSess.tenantId)) {
        return NextResponse.json({ error: 'Citation belongs to another workspace.' }, { status: 403 });
      }
      if (existing.verified_on) {
        return NextResponse.json({ error: 'Verified entries cannot be edited in place. Use Supersede instead.' }, { status: 409 });
      }

      const today = todayISO();
      const actorName = existing.tenant_id === null ? platSess!.user.name : teamSess!.user.name;
      await q(
        'UPDATE regulations SET verbatim_text=?, source_url=?, verified_on=?, verified_by=?, status=?, notes=? WHERE reg_id=?',
        [verbatimText, sourceUrl || existing.source_url, today, actorName, 'active', notes, regId]
      );

      if (existing.tenant_id) {
        await audit(existing.tenant_id, teamSess!.user.id, 'regulation.verified', 'regulation', regId, { verifiedOn: today }, teamSess!.impersonation?.platformUserId);
      } else {
        await platformAudit(platSess!.platformUserId, 'regulation.global_verified', null, 'regulation', regId, { verifiedOn: today });
      }
      return NextResponse.json({ ok: true, message: `${existing.code} verified on ${today}.` });
    }

    if (action === 'supersede') {
      const oldRegId = String(body.oldRegId || '');
      const oldReg = await one<any>('SELECT * FROM regulations WHERE reg_id=?', [oldRegId]);
      if (!oldReg) return NextResponse.json({ error: 'Original regulation not found.' }, { status: 404 });

      if (oldReg.tenant_id === null && !canGlobal) {
        return NextResponse.json({ error: 'Only Platform Compliance Editors can supersede global citations.' }, { status: 403 });
      }
      if (oldReg.tenant_id !== null && (!teamSess || oldReg.tenant_id !== teamSess.tenantId)) {
        return NextResponse.json({ error: 'Citation belongs to another workspace.' }, { status: 403 });
      }

      const code = String(body.code || oldReg.code).trim();
      const title = String(body.title || oldReg.title).trim();
      const summary = String(body.summary || oldReg.summary).trim();
      const verbatimText = String(body.verbatimText || '').trim() || null;
      const sourceUrl = String(body.sourceUrl || oldReg.source_url).trim();
      const notes = String(body.notes || '').trim() || null;

      const prefix = oldReg.tenant_id ? `${oldReg.tenant_id.slice(0, 6).toUpperCase()}-` : '';
      const baseId = `${prefix}${oldReg.jurisdiction}-${code.replace(/[^A-Za-z0-9]/g, '')}`;
      const newRegId = (baseId === oldRegId ? `${baseId}-R${Date.now().toString().slice(-4)}` : baseId).slice(0, 40);
      const today = verbatimText ? todayISO() : null;
      const actorName = oldReg.tenant_id === null ? platSess!.user.name : teamSess!.user.name;
      const status = verbatimText ? 'active' : 'UNVERIFIED - paste from source';

      await q(
        `INSERT INTO regulations (reg_id, tenant_id, jurisdiction, agency, code, title, topic, summary, verbatim_text, source_url, verified_on, verified_by, status, notes)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [newRegId, oldReg.tenant_id, oldReg.jurisdiction, oldReg.agency, code, title, oldReg.topic, summary, verbatimText, sourceUrl, today, today ? actorName : null, status, notes]
      );
      await q("UPDATE regulations SET status='superseded', superseded_by=? WHERE reg_id=?", [newRegId, oldRegId]);
      await q('UPDATE question_regulations SET reg_id=? WHERE reg_id=?', [newRegId, oldRegId]);

      if (oldReg.tenant_id) {
        await audit(oldReg.tenant_id, teamSess!.user.id, 'regulation.superseded', 'regulation', oldRegId, { supersededBy: newRegId }, teamSess!.impersonation?.platformUserId);
      } else {
        await platformAudit(platSess!.platformUserId, 'regulation.global_superseded', null, 'regulation', oldRegId, { supersededBy: newRegId });
      }
      return NextResponse.json({ ok: true, message: `${oldReg.code} superseded by ${newRegId}.`, newRegId });
    }

    if (action === 'link_question') {
      const questionKey = String(body.questionKey || '').trim();
      const jurisdiction = String(body.jurisdiction || 'FED').toUpperCase().slice(0, 8);
      const regId = String(body.regId || '').trim();
      const isPrimary = body.isPrimary !== false ? 1 : 0;
      const measureUnit = body.measureUnit ? String(body.measureUnit).slice(0, 20) : null;
      const comparison = ['min', 'max', 'exact', 'range'].includes(body.comparison) ? body.comparison : null;
      const threshold = body.threshold !== undefined && body.threshold !== '' && body.threshold !== null ? Number(body.threshold) : null;
      const notes = body.notes ? String(body.notes).trim() : null;

      if (!questionKey || !regId) {
        return NextResponse.json({ error: 'questionKey and regId are required.' }, { status: 400 });
      }

      if (questionKey.startsWith('SHR-') && !canGlobal) {
        return NextResponse.json({ error: 'Only Platform Compliance Editors can map citations onto shared SHR-* items.' }, { status: 403 });
      }

      if (isPrimary) {
        await q('UPDATE question_regulations SET is_primary=0 WHERE question_key=? AND jurisdiction=?', [questionKey, jurisdiction]);
      }

      await q(
        `INSERT INTO question_regulations (question_key, jurisdiction, reg_id, is_primary, measure_unit, comparison, threshold, notes)
         VALUES (?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE is_primary=VALUES(is_primary), measure_unit=VALUES(measure_unit), comparison=VALUES(comparison), threshold=VALUES(threshold), notes=VALUES(notes)`,
        [questionKey, jurisdiction, regId, isPrimary, measureUnit, comparison, threshold, notes]
      );

      return NextResponse.json({ ok: true, message: `Mapped ${regId} (${jurisdiction}) to ${questionKey}.` });
    }

    if (action === 'update_portal') {
      if (!canGlobal || !platSess) {
        return NextResponse.json({ error: 'Only Platform Compliance Editors can update global jurisdiction portals.' }, { status: 403 });
      }
      const code = String(body.code || '').trim().toUpperCase();
      const existing = await one<any>('SELECT * FROM jurisdiction_portals WHERE code=?', [code]);
      if (!existing) return NextResponse.json({ error: 'Jurisdiction portal not found.' }, { status: 404 });

      const agencyName = String(body.agencyName || existing.agency_name).trim().slice(0, 190);
      const adminCode = body.adminCodeCitation !== undefined ? String(body.adminCodeCitation || '').trim().slice(0, 255) || null : existing.admin_code_citation;
      const portalUrl = String(body.portalUrl || existing.portal_url).trim().slice(0, 500);
      const standardsUrl = body.standardsUrl !== undefined ? String(body.standardsUrl || '').trim().slice(0, 500) || null : existing.standards_url;
      const keyDivergences = body.keyDivergences !== undefined ? String(body.keyDivergences || '').trim() || null : existing.key_divergences;

      await q(
        `UPDATE jurisdiction_portals
            SET agency_name=?, admin_code_citation=?, portal_url=?, standards_url=?, key_divergences=?
          WHERE code=?`,
        [agencyName, adminCode, portalUrl, standardsUrl, keyDivergences, code]
      );
      await platformAudit(platSess.platformUserId, 'jurisdiction_portal.updated', null, 'jurisdiction_portal', code, {
        agencyName,
        portalUrl,
      });
      return NextResponse.json({ ok: true, message: `Jurisdiction portal ${code} updated.` });
    }

    if (action === 'delete_unverified') {
      const regId = String(body.regId || '').trim();
      const existing = await one<any>('SELECT * FROM regulations WHERE reg_id=?', [regId]);
      if (!existing) return NextResponse.json({ error: 'Regulation not found.' }, { status: 404 });

      if (existing.tenant_id === null && !canGlobal) {
        return NextResponse.json({ error: 'Only Platform Compliance Editors can remove unverified global citations.' }, { status: 403 });
      }
      if (existing.tenant_id !== null && (!teamSess || existing.tenant_id !== teamSess.tenantId)) {
        return NextResponse.json({ error: 'Citation belongs to another workspace.' }, { status: 403 });
      }
      if (existing.verified_on) {
        return NextResponse.json(
          { error: 'Verified citations are immutable for 7-year compliance. Use Supersede instead.' },
          { status: 409 }
        );
      }

      const [qRef, rRef, bRef] = await Promise.all([
        one<{ n: number }>('SELECT COUNT(*) AS n FROM question_regulations WHERE reg_id=?', [regId]),
        one<{ n: number }>('SELECT COUNT(*) AS n FROM recommendations WHERE reg_id=?', [regId]),
        one<{ n: number }>('SELECT COUNT(*) AS n FROM book_recommendations WHERE reg_id=?', [regId]),
      ]);
      if ((qRef?.n ?? 0) > 0 || (rRef?.n ?? 0) > 0 || (bRef?.n ?? 0) > 0) {
        return NextResponse.json(
          { error: 'Citation is linked to questions or recommendations. Detach or verify/supersede it instead.' },
          { status: 409 }
        );
      }

      await q('DELETE FROM regulations WHERE reg_id=? AND verified_on IS NULL', [regId]);
      if (existing.tenant_id) {
        await audit(existing.tenant_id, teamSess!.user.id, 'regulation.draft_deleted', 'regulation', regId, { code: existing.code }, teamSess!.impersonation?.platformUserId);
      } else {
        await platformAudit(platSess!.platformUserId, 'regulation.global_draft_deleted', null, 'regulation', regId, { code: existing.code });
      }
      return NextResponse.json({ ok: true, message: `Unverified draft citation ${existing.code} deleted.` });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
