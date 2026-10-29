import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { getSession, can } from '@/lib/session';
import { q, one, audit } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(req: Request) {
  const s = await getSession();
  const body = await req.json();
  const { action } = body as { action: string };

  if (action === 'clone_form') {
    if (!can.editFormsAndRegs(s)) {
      return NextResponse.json({ error: 'Only Owners and Admins can clone forms.' }, { status: 403 });
    }
    const sourceCode = String(body.sourceCode || '').toUpperCase();
    const newCode = String(body.newCode || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
    const newName = String(body.newName || '').trim();

    if (!sourceCode || !newCode || !newName) {
      return NextResponse.json({ error: 'Source form, new code, and new form name are required.' }, { status: 400 });
    }
    const src = await one<any>('SELECT * FROM forms WHERE code=?', [sourceCode]);
    if (!src) return NextResponse.json({ error: 'Source form not found.' }, { status: 404 });
    if (await one('SELECT code FROM forms WHERE code=?', [newCode])) {
      return NextResponse.json({ error: `Form code ${newCode} already exists.` }, { status: 409 });
    }

    await q(
      `INSERT INTO forms (code, tenant_id, name, industry, scale, allow_additional_findings, version, published_at)
       VALUES (?,?,?,?,?,?,1,NOW())`,
      [newCode, s.tenantId, newName, src.industry, src.scale, src.allow_additional_findings]
    );
    await q(
      `INSERT INTO form_sections (form_code, section_no, name)
       SELECT ?, section_no, name FROM form_sections WHERE form_code=?`,
      [newCode, sourceCode]
    );
    await q(
      `INSERT INTO questions (form_code, question_id, question_key, section_no, sort_order, question_text, answer_type, na_label, requires_rec, photo_required, priority, topic, measure_unit, comparison, threshold, threshold_max, recommendation, is_shared)
       SELECT ?, question_id, question_key, section_no, sort_order, question_text, answer_type, na_label, requires_rec, photo_required, priority, topic, measure_unit, comparison, threshold, threshold_max, recommendation, is_shared
         FROM questions WHERE form_code=?`,
      [newCode, sourceCode]
    );
    await audit(s.tenantId, s.user.id, 'form.cloned', 'form', newCode, { sourceCode, newName });
    return NextResponse.json({ ok: true, message: `Cloned ${sourceCode} as tenant form ${newCode}.`, code: newCode });
  }

  if (!can.platformAdmin(s)) {
    return NextResponse.json({ error: 'Platform Super-Admin access required.' }, { status: 403 });
  }

  if (action === 'update_tenant') {
    const tenantId = String(body.tenantId || '');
    const plan = String(body.plan || 'professional');
    const status = ['active', 'trial', 'suspended'].includes(body.status) ? body.status : 'active';
    const seats = Math.max(1, Number(body.seatsPurchased) || 1);
    const customDomain = String(body.customDomain || '').trim() || null;

    await q('UPDATE tenants SET plan=?, status=?, seats_purchased=?, custom_domain=? WHERE id=?', [
      plan,
      status,
      seats,
      customDomain,
      tenantId,
    ]);
    await audit(tenantId, s.user.id, 'platform.tenant_updated', 'tenant', tenantId, { plan, status, seats, customDomain });
    return NextResponse.json({ ok: true, message: `Tenant ${tenantId} updated.` });
  }

  if (action === 'provision_tenant') {
    const name = String(body.name || '').trim();
    const ownerName = String(body.ownerName || '').trim();
    const ownerEmail = String(body.ownerEmail || '').trim().toLowerCase();
    const customDomain = String(body.customDomain || '').trim().toLowerCase() || null;
    const accent = /^#[0-9a-fA-F]{6}$/.test(String(body.accent || '')) ? String(body.accent) : '#1f4f6e';
    const plan = String(body.plan || 'professional');
    const seats = Math.max(1, Number(body.seatsPurchased) || 3);

    if (!name || !ownerName || !ownerEmail) {
      return NextResponse.json({ error: 'Organization name, Owner name, and Owner email are required.' }, { status: 400 });
    }

    const tenantId = 't_' + randomBytes(4).toString('hex');
    const userId = 'u_' + randomBytes(4).toString('hex');
    const scopes = JSON.stringify({ app: true, reports: true, email: true, portal: true, signin: true });

    await q(
      `INSERT INTO tenants (id, name, custom_domain, email_sender, accent, brand_scopes, seats_purchased, plan, status)
       VALUES (?,?,?,?,?,?,?,?,'active')`,
      [tenantId, name, customDomain, `reports@${customDomain || 'safetyalchemist.com'}`, accent, scopes, seats, plan]
    );
    await q(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, role, status, is_platform_admin)
       VALUES (?,?,?,?,?,'owner','active',0)`,
      [userId, tenantId, ownerName, ownerEmail, hashPassword('safetyalchemist')]
    );
    await audit(tenantId, s.user.id, 'platform.tenant_provisioned', 'tenant', tenantId, { name, ownerEmail, plan, seats });
    return NextResponse.json({ ok: true, message: `Consultancy "${name}" provisioned (${tenantId}).`, tenantId });
  }

  if (action === 'impersonate_tenant') {
    const tenantId = String(body.tenantId || '');
    const owner = await one<any>('SELECT id, role FROM users WHERE tenant_id=? AND status <> "suspended" ORDER BY FIELD(role,"owner","admin","supervisor","consultant") LIMIT 1', [tenantId]);
    if (!owner) return NextResponse.json({ error: 'No active user found in that tenant.' }, { status: 404 });
    const jar = await cookies();
    jar.set('sa_user_id', owner.id, { path: '/', sameSite: 'lax', httpOnly: true });
    jar.set('demo_tenant', tenantId, { path: '/', sameSite: 'lax', httpOnly: true });
    jar.set('demo_role', owner.role, { path: '/', sameSite: 'lax', httpOnly: true });
    return NextResponse.json({ ok: true, redirectTo: '/today' });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}

