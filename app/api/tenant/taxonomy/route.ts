import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { requireApiSession, apiErrorResponse } from '@/lib/session';
import { q, one, audit } from '@/lib/db';
import { assertMemberInTenant } from '@/lib/acl';
import { listTenantTaxonomy, listIndustryCatalog } from '@/lib/queries';

const GROUP_TYPES = ['sig_captive', 'retail_rsa', 'carrier_program', 'association', 'internal_division', 'custom'];
const BILLING_MODES = ['included_captive', 'fee_for_service', 'scoro_invoiced', 'hourly', 'none'];

export async function GET() {
  try {
    const s = await requireApiSession();
    const [taxonomy, industries] = await Promise.all([
      listTenantTaxonomy(s.tenantId),
      listIndustryCatalog(s.tenantId),
    ]);
    return NextResponse.json({ taxonomy, industries });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const s = await requireApiSession(req, 'team:taxonomy.manage');
    const body = await req.json();
    const { action } = body as { action: string };

    if (action === 'update_group_label') {
      const label = String(body.groupLabel || '').trim().slice(0, 60);
      if (!label) return NextResponse.json({ error: 'Terminology label is required (e.g. Gems, Programs, Captives).' }, { status: 400 });
      await q('UPDATE tenants SET group_label=? WHERE id=?', [label, s.tenantId]);
      await audit(s.tenantId, s.user.id, 'taxonomy.group_label_updated', 'tenant', s.tenantId, { label }, s.impersonation?.platformUserId);
      return NextResponse.json({ ok: true, message: `Portfolio group label updated to "${label}".` });
    }

    if (action === 'apply_group_preset') {
      const presetKey = String(body.presetKey || '');
      const raw = await fs.readFile(path.join(process.cwd(), 'data', 'v003_industries.json'), 'utf8');
      const data = JSON.parse(raw);
      const preset = data.groupPresets?.[presetKey];
      if (!preset) return NextResponse.json({ error: 'Unknown preset.' }, { status: 400 });

      await q('UPDATE tenants SET group_label=? WHERE id=?', [preset.label, s.tenantId]);
      for (const g of preset.groups || []) {
        await q(
          `INSERT INTO tenant_member_groups (id, tenant_id, code, name, group_type, accent_color, billing_mode, sort_order, is_active)
           VALUES (?,?,?,?,?,?,?,?,1)
           ON DUPLICATE KEY UPDATE name=VALUES(name), group_type=VALUES(group_type), accent_color=VALUES(accent_color), billing_mode=VALUES(billing_mode), is_active=1`,
          [randomUUID(), s.tenantId, g.code, g.name, g.group_type, g.accent_color, g.billing_mode, g.sort_order]
        );
      }
      for (const rt of preset.relationshipTypes || []) {
        await q(
          `INSERT INTO tenant_relationship_types (id, tenant_id, code, label, rolls_up_analytics)
           VALUES (?,?,?,?,?)
           ON DUPLICATE KEY UPDATE label=VALUES(label), rolls_up_analytics=VALUES(rolls_up_analytics)`,
          [randomUUID(), s.tenantId, rt.code, rt.label, rt.rolls_up_analytics ? 1 : 0]
        );
      }
      await audit(s.tenantId, s.user.id, 'taxonomy.preset_applied', 'tenant', s.tenantId, { presetKey }, s.impersonation?.platformUserId);
      return NextResponse.json({ ok: true, message: `Applied "${preset.label}" starter preset.` });
    }

    if (action === 'save_group') {
      const code = String(body.code || '')
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '')
        .slice(0, 32);
      const name = String(body.name || '').trim().slice(0, 160);
      const groupType = GROUP_TYPES.includes(body.groupType) ? body.groupType : 'custom';
      const accentColor = /^#[0-9a-fA-F]{6}$/.test(String(body.accentColor || '')) ? String(body.accentColor).toLowerCase() : '#4b2454';
      const billingMode = BILLING_MODES.includes(body.billingMode) ? body.billingMode : 'included_captive';
      const sortOrder = Number(body.sortOrder) || 50;

      if (!code || !name) {
        return NextResponse.json({ error: 'Group code and display name are required.' }, { status: 400 });
      }

      await q(
        `INSERT INTO tenant_member_groups (id, tenant_id, code, name, group_type, accent_color, billing_mode, sort_order, is_active)
         VALUES (?,?,?,?,?,?,?,?,1)
         ON DUPLICATE KEY UPDATE name=VALUES(name), group_type=VALUES(group_type), accent_color=VALUES(accent_color), billing_mode=VALUES(billing_mode), sort_order=VALUES(sort_order), is_active=1`,
        [body.id || randomUUID(), s.tenantId, code, name, groupType, accentColor, billingMode, sortOrder]
      );
      await audit(s.tenantId, s.user.id, 'taxonomy.group_saved', 'tenant_member_group', code, { code, name, groupType, billingMode }, s.impersonation?.platformUserId);
      return NextResponse.json({ ok: true, message: `Saved group "${code} — ${name}".` });
    }

    if (action === 'archive_group') {
      const id = String(body.id || '');
      await q('UPDATE tenant_member_groups SET is_active=0 WHERE id=? AND tenant_id=?', [id, s.tenantId]);
      await q('UPDATE members SET group_id=NULL WHERE group_id=? AND tenant_id=?', [id, s.tenantId]);
      await audit(s.tenantId, s.user.id, 'taxonomy.group_archived', 'tenant_member_group', id, undefined, s.impersonation?.platformUserId);
      return NextResponse.json({ ok: true, message: 'Group archived.' });
    }

    if (action === 'toggle_global_industry') {
      const industryLineId = String(body.industryLineId || '');
      const enabled = Boolean(body.enabled);
      if (enabled) {
        await q('DELETE FROM tenant_disabled_industries WHERE tenant_id=? AND industry_line_id=?', [s.tenantId, industryLineId]);
      } else {
        await q('INSERT IGNORE INTO tenant_disabled_industries (tenant_id, industry_line_id) VALUES (?,?)', [s.tenantId, industryLineId]);
      }
      await audit(s.tenantId, s.user.id, 'taxonomy.industry_toggled', 'industry_line', industryLineId, { enabled }, s.impersonation?.platformUserId);
      return NextResponse.json({ ok: true, message: enabled ? 'Industry enabled for workspace.' : 'Industry hidden from workspace pickers.' });
    }

    if (action === 'save_custom_industry') {
      const code = String(body.code || '')
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '')
        .slice(0, 32);
      const name = String(body.name || '').trim().slice(0, 160);
      const shieldBrand = String(body.shieldBrand || '').trim().slice(0, 80) || null;
      const federalBaseline = String(body.federalBaseline || '').trim().slice(0, 255) || null;
      const stateOverlayNotes = String(body.stateOverlayNotes || '').trim() || null;
      const defaultTopics = Array.isArray(body.defaultTopics)
        ? body.defaultTopics
        : String(body.defaultTopics || '')
            .split(',')
            .map(x => x.trim())
            .filter(Boolean);

      if (!code || !name) return NextResponse.json({ error: 'Industry code and name are required.' }, { status: 400 });

      const id = body.id ? String(body.id) : `ind-${s.tenantId}-${code.toLowerCase()}`.slice(0, 36);
      await q(
        `INSERT INTO industry_lines
           (id, tenant_id, code, name, shield_brand, is_core_shield, federal_baseline, state_overlay_notes, default_topics_json, sort_order, is_active)
         VALUES (?,?,?,?,?,0,?,?,?,200,1)
         ON DUPLICATE KEY UPDATE
           name=VALUES(name), shield_brand=VALUES(shield_brand), federal_baseline=VALUES(federal_baseline),
           state_overlay_notes=VALUES(state_overlay_notes), default_topics_json=VALUES(default_topics_json)`,
        [id, s.tenantId, code, name, shieldBrand, federalBaseline, stateOverlayNotes, JSON.stringify(defaultTopics)]
      );
      await audit(s.tenantId, s.user.id, 'taxonomy.custom_industry_saved', 'industry_line', id, { code, name }, s.impersonation?.platformUserId);
      return NextResponse.json({ ok: true, id, message: `Custom Industry "${name}" saved for your workspace.` });
    }

    if (action === 'save_custom_subsector') {
      const industryLineId = String(body.industryLineId || '').trim();
      const code = String(body.code || '')
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '')
        .slice(0, 40);
      const name = String(body.name || '').trim().slice(0, 160);
      const description = String(body.description || '').trim() || null;

      if (!industryLineId || !code || !name) {
        return NextResponse.json({ error: 'Parent industry line, sub-sector code, and name are required.' }, { status: 400 });
      }
      const line = await one('SELECT id FROM industry_lines WHERE id=? AND (tenant_id IS NULL OR tenant_id=?)', [
        industryLineId,
        s.tenantId,
      ]);
      if (!line) return NextResponse.json({ error: 'Industry line not found.' }, { status: 404 });

      const id = body.id ? String(body.id) : `sub-${s.tenantId}-${code.toLowerCase()}`.slice(0, 36);
      await q(
        `INSERT INTO industry_subsectors (id, industry_line_id, tenant_id, code, name, description, sort_order, is_active)
         VALUES (?,?,?,?,?,?,60,1)
         ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description)`,
        [id, industryLineId, s.tenantId, code, name, description]
      );
      await audit(s.tenantId, s.user.id, 'taxonomy.custom_subsector_saved', 'industry_subsector', id, { code, name }, s.impersonation?.platformUserId);
      return NextResponse.json({ ok: true, id, message: `Sub-Sector "${name}" added.` });
    }

    if (action === 'save_relationship_type') {
      const code = String(body.code || '')
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '')
        .slice(0, 32);
      const label = String(body.label || '').trim().slice(0, 120);
      const rollsUp = body.rollsUpAnalytics !== false ? 1 : 0;
      if (!code || !label) return NextResponse.json({ error: 'Code and relationship label are required.' }, { status: 400 });

      await q(
        `INSERT INTO tenant_relationship_types (id, tenant_id, code, label, rolls_up_analytics)
         VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE label=VALUES(label), rolls_up_analytics=VALUES(rolls_up_analytics)`,
        [randomUUID(), s.tenantId, code, label, rollsUp]
      );
      await audit(s.tenantId, s.user.id, 'taxonomy.rel_type_saved', 'tenant_relationship_type', code, { label, rollsUp }, s.impersonation?.platformUserId);
      return NextResponse.json({ ok: true, message: `Relationship type "${label}" saved.` });
    }

    if (action === 'add_company_relationship') {
      const fromMemberId = String(body.fromMemberId || '');
      const toMemberId = String(body.toMemberId || '');
      const relationshipCode = String(body.relationshipCode || 'PARENT_CHILD').toUpperCase().slice(0, 32);
      const notes = String(body.notes || '').trim().slice(0, 255) || null;

      if (!fromMemberId || !toMemberId || fromMemberId === toMemberId) {
        return NextResponse.json({ error: 'Select two distinct Member companies to link.' }, { status: 400 });
      }
      await assertMemberInTenant(s.tenantId, fromMemberId);
      await assertMemberInTenant(s.tenantId, toMemberId);

      const id = randomUUID();
      await q(
        `INSERT INTO company_relationships (id, tenant_id, from_member_id, to_member_id, relationship_code, notes)
         VALUES (?,?,?,?,?,?)`,
        [id, s.tenantId, fromMemberId, toMemberId, relationshipCode, notes]
      );
      await audit(
        s.tenantId,
        s.user.id,
        'member.relationship_added',
        'company_relationship',
        id,
        { fromMemberId, toMemberId, relationshipCode },
        s.impersonation?.platformUserId
      );
      return NextResponse.json({ ok: true, id, message: 'Company hierarchy relationship linked.' });
    }

    if (action === 'delete_company_relationship') {
      const id = String(body.id || '');
      await q('DELETE FROM company_relationships WHERE id=? AND tenant_id=?', [id, s.tenantId]);
      await audit(s.tenantId, s.user.id, 'member.relationship_removed', 'company_relationship', id, undefined, s.impersonation?.platformUserId);
      return NextResponse.json({ ok: true, message: 'Relationship removed.' });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

