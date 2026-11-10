import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  requirePlatformSession,
  getOptionalSession,
  getOptionalPlatformSession,
  apiErrorResponse,
  ApiAuthError,
  IMPERSONATION_COOKIE,
  sessionCookieOptions,
} from '@/lib/session';
import { q, one, audit, platformAudit, nowSql } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { generateOpaqueToken, sha256Hex, verifySameOrigin } from '@/lib/security';
import { PLATFORM_PERMISSION_LABELS, evaluatePlatformPermissions, type PlatformRole } from '@/lib/acl';
import { sendMail } from '@/lib/email';

const VALID_PLATFORM_ROLES: PlatformRole[] = [
  'platform_super_admin',
  'platform_ops_admin',
  'platform_compliance_editor',
  'platform_support_viewer',
];
const VALID_PLATFORM_PERMS = new Set<string>(PLATFORM_PERMISSION_LABELS.map(p => p.key));

async function applyGroupPreset(tenantId: string, presetKey: string) {
  const raw = await fs.readFile(path.join(process.cwd(), 'data', 'v003_industries.json'), 'utf8');
  const data = JSON.parse(raw);
  const preset = data.groupPresets?.[presetKey];
  if (!preset) return;
  await q('UPDATE tenants SET group_label=? WHERE id=?', [preset.label || 'Portfolio Groups', tenantId]);
  for (const g of preset.groups || []) {
    await q(
      `INSERT IGNORE INTO tenant_member_groups (id, tenant_id, code, name, group_type, accent_color, billing_mode, sort_order, is_active)
       VALUES (?,?,?,?,?,?,?,?,1)`,
      [randomUUID(), tenantId, g.code, g.name, g.group_type, g.accent_color, g.billing_mode, g.sort_order]
    );
  }
  for (const rt of preset.relationshipTypes || []) {
    await q(
      `INSERT IGNORE INTO tenant_relationship_types (id, tenant_id, code, label, rolls_up_analytics)
       VALUES (?,?,?,?,?)`,
      [randomUUID(), tenantId, rt.code, rt.label, rt.rolls_up_analytics ? 1 : 0]
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body as { action: string };

    // Allow both Platform Master Editors (scope='platform') and Team Admins (scope='tenant') to clone forms/policies
    if (action === 'clone_form') {
      const csrf = verifySameOrigin(req);
      if (!csrf.ok) throw new ApiAuthError(403, csrf.error);

      const [teamSess, platSess] = await Promise.all([getOptionalSession(), getOptionalPlatformSession()]);
      if (!teamSess && !platSess) throw new ApiAuthError(401, 'Authentication required.');

      const canMaster = Boolean(platSess?.permissions.has('platform:forms.master_manage'));
      const canTenant = Boolean(teamSess?.permissions.has('team:forms.tenant_manage'));
      const wantMaster = body.scope === 'platform' || (!teamSess && canMaster);

      if (wantMaster && !canMaster) {
        throw new ApiAuthError(403, 'Missing platform:forms.master_manage permission to clone into Master Library.');
      }
      if (!wantMaster && !canTenant) {
        throw new ApiAuthError(403, 'Missing team:forms.tenant_manage permission to clone into Workspace.');
      }

      const sourceCode = String(body.sourceCode || '').toUpperCase();
      const newCode = String(body.newCode || '')
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, '')
        .slice(0, 16);
      const newName = String(body.newName || '').trim();

      if (!sourceCode || !newCode || !newName) {
        return NextResponse.json({ error: 'Source form, new code, and new form name are required.' }, { status: 400 });
      }
      const src = await one<any>(
        teamSess
          ? 'SELECT * FROM forms WHERE code=? AND (tenant_id IS NULL OR tenant_id=?)'
          : 'SELECT * FROM forms WHERE code=?',
        teamSess ? [sourceCode, teamSess.tenantId] : [sourceCode]
      );
      if (!src) return NextResponse.json({ error: 'Source form not found.' }, { status: 404 });
      if (await one('SELECT code FROM forms WHERE code=?', [newCode])) {
        return NextResponse.json({ error: `Form code ${newCode} already exists.` }, { status: 409 });
      }

      const targetTenantId = wantMaster ? null : teamSess!.tenantId;

      await q(
        `INSERT INTO forms (code, tenant_id, name, industry, shield_code, subsector_code, category, scale, description, allow_additional_findings, is_archived, version, published_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,0,1,?)`,
        [
          newCode,
          targetTenantId,
          newName,
          src.industry,
          src.shield_code,
          src.subsector_code,
          src.category || 'field_inspection',
          src.scale,
          src.description,
          src.allow_additional_findings,
          nowSql(),
        ]
      );
      await q(
        `INSERT INTO form_sections (form_code, section_no, name, max_points)
         SELECT ?, section_no, name, max_points FROM form_sections WHERE form_code=?`,
        [newCode, sourceCode]
      );
      await q(
        `INSERT INTO questions (form_code, question_id, question_key, section_no, sort_order, question_text, answer_type, na_label, requires_rec, photo_required, priority, topic, measure_unit, comparison, threshold, threshold_max, recommendation, is_shared)
         SELECT ?, question_id, question_key, section_no, sort_order, question_text, answer_type, na_label, requires_rec, photo_required, priority, topic, measure_unit, comparison, threshold, threshold_max, recommendation, is_shared
           FROM questions WHERE form_code=?`,
        [newCode, sourceCode]
      );

      if (wantMaster) {
        await platformAudit(platSess!.platformUserId, 'form.master_cloned', null, 'form', newCode, { sourceCode, newName });
      } else {
        await audit(
          teamSess!.tenantId,
          teamSess!.user.id,
          'form.cloned',
          'form',
          newCode,
          { sourceCode, newName },
          teamSess!.impersonation?.platformUserId
        );
      }
      return NextResponse.json({
        ok: true,
        message: `Cloned ${sourceCode} as ${wantMaster ? 'Master' : 'Workspace'} template ${newCode}.`,
        code: newCode,
      });
    }

    // =========================================================================
    // STRICT PLATFORM PLANE ACTIONS (sa_plat_session required — never tenant)
    // =========================================================================

    if (action === 'update_tenant') {
      const ps = await requirePlatformSession(req);
      const tenantId = String(body.tenantId || '');
      const existing = await one<any>('SELECT * FROM tenants WHERE id=?', [tenantId]);
      if (!existing) return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });

      const plan = ['solo', 'professional', 'enterprise'].includes(body.plan) ? body.plan : existing.plan;
      const status = ['active', 'trial', 'suspended'].includes(body.status) ? body.status : existing.status;
      const seats = Math.max(1, Number(body.seatsPurchased) || existing.seats_purchased);
      const customDomain = body.customDomain !== undefined ? String(body.customDomain || '').trim().toLowerCase() || null : existing.custom_domain;
      const senderVerified = body.emailSenderVerified !== undefined ? (body.emailSenderVerified ? 1 : 0) : existing.email_sender_verified;

      if (status !== existing.status && !ps.permissions.has('platform:tenants.suspend')) {
        return NextResponse.json({ error: 'Missing platform:tenants.suspend permission.' }, { status: 403 });
      }
      if ((plan !== existing.plan || seats !== existing.seats_purchased) && !ps.permissions.has('platform:tenants.billing')) {
        return NextResponse.json({ error: 'Missing platform:tenants.billing permission.' }, { status: 403 });
      }

      await q(
        'UPDATE tenants SET plan=?, status=?, seats_purchased=?, custom_domain=?, email_sender_verified=? WHERE id=?',
        [plan, status, seats, customDomain, senderVerified, tenantId]
      );
      await platformAudit(ps.platformUserId, 'tenant.updated', tenantId, 'tenant', tenantId, {
        plan,
        status,
        seats,
        customDomain,
        senderVerified,
      });
      return NextResponse.json({ ok: true, message: `Tenant ${existing.name} (${tenantId}) updated.` });
    }

    if (action === 'provision_tenant') {
      const ps = await requirePlatformSession(req, 'platform:tenants.provision');
      const name = String(body.name || '').trim();
      const ownerName = String(body.ownerName || '').trim();
      const ownerEmail = String(body.ownerEmail || '').trim().toLowerCase();
      const customDomain = String(body.customDomain || '').trim().toLowerCase() || null;
      const accent = /^#[0-9a-fA-F]{6}$/.test(String(body.accent || '')) ? String(body.accent) : '#1f4f6e';
      const plan = ['solo', 'professional', 'enterprise'].includes(body.plan) ? body.plan : 'professional';
      const seats = Math.max(1, Number(body.seatsPurchased) || 3);
      const groupPreset = ['breckpoint_sig_rsa', 'standard_consultancy', 'blank'].includes(body.groupPreset)
        ? body.groupPreset
        : 'standard_consultancy';

      if (!name || !ownerName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) {
        return NextResponse.json({ error: 'Organization name, Owner name, and valid Owner email are required.' }, { status: 400 });
      }

      const tenantId = 't_' + randomBytes(5).toString('hex');
      const userId = 'u_' + randomBytes(5).toString('hex');
      const tempPassword = 'SA-' + randomBytes(9).toString('base64url');
      const scopes = JSON.stringify({ app: true, reports: true, email: true, portal: true, signin: true });

      await q(
        `INSERT INTO tenants (id, name, custom_domain, email_sender, email_sender_verified, accent, brand_scopes, group_label, seats_purchased, plan, status)
         VALUES (?,?,?,?,0,?,?,'Portfolio Groups',?,?,'active')`,
        [tenantId, name, customDomain, `reports@${customDomain || 'safetyalchemist.com'}`, accent, scopes, seats, plan]
      );
      await q(
        `INSERT INTO users (id, tenant_id, name, email, password_hash, role, status, is_platform_admin)
         VALUES (?,?,?,?,?,'owner','active',0)`,
        [userId, tenantId, ownerName, ownerEmail, hashPassword(tempPassword)]
      );

      if (groupPreset !== 'blank') {
        await applyGroupPreset(tenantId, groupPreset);
      }

      const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
      await sendMail({
        to: ownerEmail,
        subject: `Your ${name} Workspace is Ready on The Safety Alchemist`,
        text: `Hello ${ownerName},\n\nYour consultancy workspace "${name}" has been provisioned.\n\nSign in at: ${appUrl}/login\nEmail: ${ownerEmail}\nTemporary Setup Password: ${tempPassword}\n`,
      });

      await platformAudit(ps.platformUserId, 'tenant.provisioned', tenantId, 'tenant', tenantId, {
        name,
        ownerEmail,
        plan,
        seats,
        groupPreset,
      });

      return NextResponse.json({
        ok: true,
        tenantId,
        setupTempPassword: tempPassword,
        message: `Workspace "${name}" (${tenantId}) provisioned. One-time Owner setup password generated.`,
      });
    }

    if (action === 'impersonate_tenant' || action === 'start_impersonation') {
      const ps = await requirePlatformSession(req, 'platform:impersonate');
      const tenantId = String(body.tenantId || '');
      const reason = String(body.reason || '').trim();
      if (reason.length < 10) {
        return NextResponse.json(
          { error: 'Support impersonation requires an audited business reason (at least 10 characters).' },
          { status: 400 }
        );
      }

      const targetUser = await one<any>(
        `SELECT id, name, email, role FROM users
          WHERE tenant_id=? AND status <> 'suspended'
          ORDER BY FIELD(role,'owner','admin','supervisor','consultant') LIMIT 1`,
        [tenantId]
      );
      if (!targetUser) {
        return NextResponse.json({ error: 'No active user found in that tenant.' }, { status: 404 });
      }

      const impId = randomUUID();
      const rawImp = generateOpaqueToken();
      const expiresAt = nowSql(60 * 60 * 1000); // Strictly 60 minutes

      await q(
        `INSERT INTO platform_impersonation_sessions
           (id, platform_user_id, target_tenant_id, target_user_id, token_hash, reason, expires_at)
         VALUES (?,?,?,?,?,?,?)`,
        [impId, ps.platformUserId, tenantId, targetUser.id, sha256Hex(rawImp), reason.slice(0, 500), expiresAt]
      );

      const jar = await cookies();
      jar.set(IMPERSONATION_COOKIE, rawImp, sessionCookieOptions(60 * 60));

      await platformAudit(ps.platformUserId, 'impersonation.started', tenantId, 'impersonation', impId, {
        targetUserId: targetUser.id,
        targetEmail: targetUser.email,
        reason,
        expiresAt,
      });

      return NextResponse.json({ ok: true, redirectTo: '/today', expiresAt });
    }

    // ---------- Platform Operators & Platform ACL Management ----------

    if (action === 'create_platform_user') {
      const ps = await requirePlatformSession(req, 'platform:users.manage');
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const role = body.role as PlatformRole;
      const password = String(body.password || '').trim() || 'Plat-' + randomBytes(9).toString('base64url');
      const overrides = (body.overrides || {}) as Record<string, 'allow' | 'deny' | 'inherit'>;

      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return NextResponse.json({ error: 'Valid operator name and email are required.' }, { status: 400 });
      }
      if (!VALID_PLATFORM_ROLES.includes(role)) {
        return NextResponse.json({ error: 'Invalid platform role.' }, { status: 400 });
      }
      if (password.length < 10) {
        return NextResponse.json({ error: 'Platform operator password must be at least 10 characters.' }, { status: 400 });
      }
      if (await one('SELECT id FROM platform_users WHERE LOWER(email)=?', [email])) {
        return NextResponse.json({ error: `${email} is already a Platform Operator.` }, { status: 409 });
      }

      const id = 'pu_' + randomBytes(5).toString('hex');
      await q(
        `INSERT INTO platform_users (id, name, email, password_hash, role, status)
         VALUES (?,?,?,?,?,'active')`,
        [id, name, email, hashPassword(password), role]
      );

      let appliedOverrides = 0;
      for (const [permKey, effect] of Object.entries(overrides)) {
        if (!VALID_PLATFORM_PERMS.has(permKey)) continue;
        if (effect === 'allow' || effect === 'deny') {
          await q(
            `INSERT INTO platform_user_acl (platform_user_id, permission_key, effect, updated_by, updated_at)
             VALUES (?,?,?,?,?)`,
            [id, permKey, effect, ps.platformUserId, nowSql()]
          );
          appliedOverrides++;
        }
      }

      await platformAudit(ps.platformUserId, 'platform_user.created', null, 'platform_user', id, {
        name,
        email,
        role,
        appliedOverrides,
      });
      return NextResponse.json({
        ok: true,
        id,
        tempPassword: body.password ? undefined : password,
        message: `Platform Operator ${name} (${role}${appliedOverrides ? ` · ${appliedOverrides} least-privilege ACL overrides` : ''}) created.`,
      });
    }

    if (action === 'update_platform_user') {
      const ps = await requirePlatformSession(req, 'platform:users.manage');
      const id = String(body.platformUserId || '');
      const existing = await one<any>('SELECT * FROM platform_users WHERE id=?', [id]);
      if (!existing) return NextResponse.json({ error: 'Platform operator not found.' }, { status: 404 });

      const nextName = body.name !== undefined ? String(body.name || '').trim() : existing.name;
      const nextEmail = body.email !== undefined ? String(body.email || '').trim().toLowerCase() : existing.email;
      const nextRole: PlatformRole = VALID_PLATFORM_ROLES.includes(body.role) ? body.role : existing.role;
      const nextStatus = ['active', 'suspended'].includes(body.status) ? body.status : existing.status;
      const newPassword = body.newPassword ? String(body.newPassword).trim() : '';

      if (!nextName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nextEmail)) {
        return NextResponse.json({ error: 'Valid operator name and email are required.' }, { status: 400 });
      }
      if (nextEmail !== existing.email.toLowerCase()) {
        if (await one('SELECT id FROM platform_users WHERE LOWER(email)=? AND id<>?', [nextEmail, id])) {
          return NextResponse.json({ error: `${nextEmail} is already assigned to another Platform Operator.` }, { status: 409 });
        }
      }
      if (newPassword && newPassword.length < 10) {
        return NextResponse.json({ error: 'New password must be at least 10 characters.' }, { status: 400 });
      }

      if (id === ps.platformUserId && nextStatus === 'suspended') {
        return NextResponse.json({ error: 'You cannot suspend your own Platform Operator account.' }, { status: 400 });
      }

      if (id === ps.platformUserId && nextRole !== existing.role) {
        const myOverrides = await q<{ permission_key: string; effect: 'allow' | 'deny' }>(
          'SELECT permission_key, effect FROM platform_user_acl WHERE platform_user_id=?',
          [id]
        );
        const nextPerms = evaluatePlatformPermissions(nextRole, myOverrides);
        if (!nextPerms.has('platform:users.manage')) {
          return NextResponse.json(
            { error: 'You cannot remove your own platform:users.manage privilege.' },
            { status: 400 }
          );
        }
      }

      if (existing.role === 'platform_super_admin' && (nextRole !== 'platform_super_admin' || nextStatus !== 'active')) {
        const superCount = await one<{ n: number }>(
          "SELECT COUNT(*) AS n FROM platform_users WHERE role='platform_super_admin' AND status='active' AND id<>?",
          [id]
        );
        if ((superCount?.n ?? 0) === 0) {
          return NextResponse.json(
            { error: 'At least one active Platform Super-Admin must remain on the platform.' },
            { status: 409 }
          );
        }
      }

      if (newPassword) {
        await q('UPDATE platform_users SET name=?, email=?, role=?, status=?, password_hash=? WHERE id=?', [
          nextName,
          nextEmail,
          nextRole,
          nextStatus,
          hashPassword(newPassword),
          id,
        ]);
      } else {
        await q('UPDATE platform_users SET name=?, email=?, role=?, status=? WHERE id=?', [
          nextName,
          nextEmail,
          nextRole,
          nextStatus,
          id,
        ]);
      }

      if (nextStatus === 'suspended' || (newPassword && id !== ps.platformUserId)) {
        await q('UPDATE platform_sessions SET revoked_at=? WHERE platform_user_id=? AND revoked_at IS NULL', [nowSql(), id]);
      }

      await platformAudit(ps.platformUserId, 'platform_user.updated', null, 'platform_user', id, {
        name: nextName,
        email: nextEmail,
        role: nextRole,
        status: nextStatus,
        passwordReset: Boolean(newPassword),
      });
      return NextResponse.json({ ok: true, message: `${nextName} updated.` });
    }

    if (action === 'delete_platform_user') {
      const ps = await requirePlatformSession(req, 'platform:users.manage');
      const id = String(body.platformUserId || '');
      const existing = await one<any>('SELECT * FROM platform_users WHERE id=?', [id]);
      if (!existing) return NextResponse.json({ error: 'Platform operator not found.' }, { status: 404 });

      if (id === ps.platformUserId) {
        return NextResponse.json({ error: 'You cannot delete your own active Platform Operator account.' }, { status: 400 });
      }

      if (existing.role === 'platform_super_admin' && existing.status === 'active') {
        const superCount = await one<{ n: number }>(
          "SELECT COUNT(*) AS n FROM platform_users WHERE role='platform_super_admin' AND status='active' AND id<>?",
          [id]
        );
        if ((superCount?.n ?? 0) === 0) {
          return NextResponse.json(
            { error: 'Cannot delete the last active Platform Super-Admin.' },
            { status: 409 }
          );
        }
      }

      const impCount = await one<{ n: number }>(
        'SELECT COUNT(*) AS n FROM platform_impersonation_sessions WHERE platform_user_id=?',
        [id]
      );
      if ((impCount?.n ?? 0) > 0) {
        await q("UPDATE platform_users SET status='suspended' WHERE id=?", [id]);
        await q('UPDATE platform_sessions SET revoked_at=? WHERE platform_user_id=? AND revoked_at IS NULL', [nowSql(), id]);
        await platformAudit(ps.platformUserId, 'platform_user.suspended_for_audit_retention', null, 'platform_user', id, {
          email: existing.email,
          historicalSupportSessions: impCount?.n,
        });
        return NextResponse.json({
          ok: true,
          message: `${existing.name} has historical audited support sessions (7-year retention) — account suspended and all sessions revoked.`,
        });
      }

      await q('DELETE FROM platform_user_acl WHERE platform_user_id=?', [id]);
      await q('DELETE FROM platform_sessions WHERE platform_user_id=?', [id]);
      await q('DELETE FROM platform_users WHERE id=?', [id]);
      await platformAudit(ps.platformUserId, 'platform_user.deleted', null, 'platform_user', id, {
        name: existing.name,
        email: existing.email,
        role: existing.role,
      });
      return NextResponse.json({ ok: true, message: `Platform Operator ${existing.name} removed.` });
    }

    if (action === 'set_platform_acl') {
      const ps = await requirePlatformSession(req, 'platform:users.manage');
      const targetId = String(body.platformUserId || '');
      const overrides = (body.overrides || {}) as Record<string, 'allow' | 'deny' | 'inherit'>;
      const existing = await one<any>('SELECT id, name FROM platform_users WHERE id=?', [targetId]);
      if (!existing) return NextResponse.json({ error: 'Platform operator not found.' }, { status: 404 });

      for (const [permKey, effect] of Object.entries(overrides)) {
        if (!VALID_PLATFORM_PERMS.has(permKey)) continue;
        if (targetId === ps.platformUserId && permKey === 'platform:users.manage' && effect === 'deny') {
          continue; // Prevent locking oneself out of platform ACL management
        }
        if (effect === 'inherit') {
          await q('DELETE FROM platform_user_acl WHERE platform_user_id=? AND permission_key=?', [targetId, permKey]);
        } else if (effect === 'allow' || effect === 'deny') {
          await q(
            `INSERT INTO platform_user_acl (platform_user_id, permission_key, effect, updated_by, updated_at)
             VALUES (?,?,?,?,?)
             ON DUPLICATE KEY UPDATE effect=VALUES(effect), updated_by=VALUES(updated_by), updated_at=VALUES(updated_at)`,
            [targetId, permKey, effect, ps.platformUserId, nowSql()]
          );
        }
      }

      await platformAudit(ps.platformUserId, 'platform_user.acl_updated', null, 'platform_user', targetId, { overrides });
      return NextResponse.json({ ok: true, message: `Platform ACL overrides saved for ${existing.name}.` });
    }

    // ---------- Cross-Plane Identity & Team Workspace Membership Management ----------

    if (action === 'attach_user_to_tenant') {
      const ps = await requirePlatformSession(req, 'platform:users.manage');
      const tenantId = String(body.tenantId || '').trim();
      const role = String(body.role || 'admin').trim();
      const VALID_TEAM_ROLES = ['owner', 'admin', 'supervisor', 'consultant', 'underwriting', 'viewer'];
      if (!VALID_TEAM_ROLES.includes(role)) {
        return NextResponse.json({ error: 'Invalid team workspace role.' }, { status: 400 });
      }

      const tenant = await one<any>('SELECT * FROM tenants WHERE id=?', [tenantId]);
      if (!tenant) return NextResponse.json({ error: 'Target workspace not found.' }, { status: 404 });

      let platOp: any = null;
      if (body.platformUserId) {
        platOp = await one<any>('SELECT * FROM platform_users WHERE id=?', [String(body.platformUserId)]);
        if (!platOp) return NextResponse.json({ error: 'Platform operator not found.' }, { status: 404 });
      }

      const email = (platOp ? platOp.email : String(body.email || '')).trim().toLowerCase();
      if (!platOp && email) {
        platOp = await one<any>('SELECT * FROM platform_users WHERE LOWER(email)=?', [email]);
      }
      const existingAnyUser = email
        ? await one<any>('SELECT name, password_hash FROM users WHERE LOWER(email)=? AND password_hash IS NOT NULL LIMIT 1', [email])
        : null;

      const name = String(body.name || platOp?.name || existingAnyUser?.name || '').trim();
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return NextResponse.json({ error: 'Valid name and email are required to attach a user to a workspace.' }, { status: 400 });
      }

      // Default to Complimentary ($0, 0 client seats consumed) unless explicitly unchecked
      const complimentary = body.complimentary !== false ? 1 : 0;
      const isPlatFlag = platOp ? 1 : 0;

      const existingInTenant = await one<any>(
        'SELECT * FROM users WHERE tenant_id=? AND LOWER(email)=?',
        [tenantId, email]
      );

      if (role === 'owner') {
        const ownerCount = await one<{ n: number }>(
          "SELECT COUNT(*) AS n FROM users WHERE tenant_id=? AND role='owner' AND status <> 'suspended' AND LOWER(email) <> ?",
          [tenantId, email]
        );
        if ((ownerCount?.n ?? 0) >= 2) {
          return NextResponse.json(
            { error: `${tenant.name} already has the maximum of 2 active Owners. Attach as Team Admin instead.` },
            { status: 409 }
          );
        }
      }

      let generatedTempPassword: string | undefined;
      let passwordHash: string | null = existingInTenant?.password_hash || platOp?.password_hash || existingAnyUser?.password_hash || null;
      if (body.password && String(body.password).trim()) {
        const rawPwd = String(body.password).trim();
        if (rawPwd.length < 10) {
          return NextResponse.json({ error: 'Password must be at least 10 characters.' }, { status: 400 });
        }
        passwordHash = hashPassword(rawPwd);
      } else if (!passwordHash) {
        generatedTempPassword = 'Team-' + randomBytes(9).toString('base64url');
        passwordHash = hashPassword(generatedTempPassword);
      }

      // If deliberately attached as a billed seat (complimentary === 0) on a paid role and tenant is full, expand seats_purchased
      if (!complimentary && !['admin', 'viewer'].includes(role)) {
        const paidUsed = await one<{ n: number }>(
          "SELECT COUNT(*) AS n FROM users WHERE tenant_id=? AND status <> 'suspended' AND role NOT IN ('admin','viewer') AND is_complimentary_seat = 0 AND LOWER(email) <> ?",
          [tenantId, email]
        );
        if ((paidUsed?.n ?? 0) >= Number(tenant.seats_purchased)) {
          await q('UPDATE tenants SET seats_purchased = seats_purchased + 1 WHERE id=?', [tenantId]);
        }
      }

      let userId: string;
      if (existingInTenant) {
        userId = existingInTenant.id;
        await q(
          `UPDATE users
              SET name=?, role=?, status='active', password_hash=COALESCE(?, password_hash),
                  is_platform_admin=?, is_complimentary_seat=?
            WHERE id=? AND tenant_id=?`,
          [name, role, passwordHash, isPlatFlag, complimentary, userId, tenantId]
        );
      } else {
        userId = 'u_' + randomBytes(5).toString('hex');
        await q(
          `INSERT INTO users (id, tenant_id, name, email, password_hash, role, status, is_platform_admin, is_complimentary_seat)
           VALUES (?,?,?,?,?,?,'active',?,?)`,
          [userId, tenantId, name, email, passwordHash, role, isPlatFlag, complimentary]
        );
      }

      await platformAudit(ps.platformUserId, 'user.attached_to_tenant', tenantId, 'user', userId, {
        email,
        name,
        role,
        complimentary: Boolean(complimentary),
        isPlatformOperator: Boolean(platOp),
      });
      await audit(
        tenantId,
        userId,
        'user.platform_attached',
        'user',
        userId,
        { email, role, complimentary: Boolean(complimentary) },
        ps.platformUserId
      );

      return NextResponse.json({
        ok: true,
        userId,
        tempPassword: generatedTempPassword,
        message: `Attached ${name} (${email}) to ${tenant.name} as ${role}${complimentary ? ' (Complimentary · 0 seats used)' : ''}.`,
      });
    }

    if (action === 'update_tenant_membership') {
      const ps = await requirePlatformSession(req, 'platform:users.manage');
      const userId = String(body.userId || '');
      const tenantId = String(body.tenantId || '');
      const existing = await one<any>('SELECT * FROM users WHERE id=? AND tenant_id=?', [userId, tenantId]);
      if (!existing) return NextResponse.json({ error: 'Workspace membership not found.' }, { status: 404 });

      const VALID_TEAM_ROLES = ['owner', 'admin', 'supervisor', 'consultant', 'underwriting', 'viewer'];
      const nextRole = VALID_TEAM_ROLES.includes(body.role) ? String(body.role) : existing.role;
      const nextStatus = ['active', 'suspended'].includes(body.status) ? String(body.status) : existing.status;
      const nextComp = body.complimentary !== undefined ? (body.complimentary ? 1 : 0) : existing.is_complimentary_seat;

      if (nextRole === 'owner' && nextStatus !== 'suspended' && (existing.role !== 'owner' || existing.status === 'suspended')) {
        const ownerCount = await one<{ n: number }>(
          "SELECT COUNT(*) AS n FROM users WHERE tenant_id=? AND role='owner' AND status <> 'suspended' AND id <> ?",
          [tenantId, userId]
        );
        if ((ownerCount?.n ?? 0) >= 2) {
          return NextResponse.json({ error: 'Workspace already has the maximum of 2 active Owners.' }, { status: 409 });
        }
      }

      await q('UPDATE users SET role=?, status=?, is_complimentary_seat=? WHERE id=? AND tenant_id=?', [
        nextRole,
        nextStatus,
        nextComp,
        userId,
        tenantId,
      ]);

      if (nextStatus === 'suspended') {
        await q('UPDATE user_sessions SET revoked_at=? WHERE user_id=? AND tenant_id=? AND revoked_at IS NULL', [
          nowSql(),
          userId,
          tenantId,
        ]);
      }

      await platformAudit(ps.platformUserId, 'user.membership_updated', tenantId, 'user', userId, {
        email: existing.email,
        role: nextRole,
        status: nextStatus,
        complimentary: Boolean(nextComp),
      });
      return NextResponse.json({ ok: true, message: `Updated ${existing.name}'s membership in ${tenantId}.` });
    }

    if (action === 'detach_user_from_tenant') {
      const ps = await requirePlatformSession(req, 'platform:users.manage');
      const userId = String(body.userId || '');
      const tenantId = String(body.tenantId || '');
      const existing = await one<any>('SELECT * FROM users WHERE id=? AND tenant_id=?', [userId, tenantId]);
      if (!existing) return NextResponse.json({ error: 'Workspace membership not found.' }, { status: 404 });

      await q('UPDATE user_sessions SET revoked_at=? WHERE user_id=? AND tenant_id=? AND revoked_at IS NULL', [
        nowSql(),
        userId,
        tenantId,
      ]);

      const [inspCnt, visitCnt, obsCnt, qrCnt, tsCnt] = await Promise.all([
        one<{ n: number }>('SELECT COUNT(*) AS n FROM inspections WHERE consultant_id=?', [userId]),
        one<{ n: number }>('SELECT COUNT(*) AS n FROM visits WHERE lead_user_id=? OR created_by=?', [userId, userId]),
        one<{ n: number }>('SELECT COUNT(*) AS n FROM observations WHERE created_by=?', [userId]),
        one<{ n: number }>('SELECT COUNT(*) AS n FROM quick_reports WHERE author_id=?', [userId]),
        one<{ n: number }>('SELECT COUNT(*) AS n FROM timesheets WHERE user_id=?', [userId]),
      ]);
      const hasHistory =
        (inspCnt?.n ?? 0) + (visitCnt?.n ?? 0) + (obsCnt?.n ?? 0) + (qrCnt?.n ?? 0) + (tsCnt?.n ?? 0) > 0;

      if (!hasHistory) {
        try {
          await q('DELETE FROM user_permission_overrides WHERE user_id=?', [userId]);
          await q('DELETE FROM user_group_scopes WHERE user_id=?', [userId]);
          await q('DELETE FROM member_assignments WHERE user_id=?', [userId]);
          await q('DELETE FROM user_certifications WHERE user_id=?', [userId]);
          await q('DELETE FROM user_time_away WHERE user_id=?', [userId]);
          await q('DELETE FROM user_sessions WHERE user_id=?', [userId]);
          await q('UPDATE users SET supervisor_id=NULL WHERE supervisor_id=?', [userId]);
          await q('DELETE FROM users WHERE id=? AND tenant_id=?', [userId, tenantId]);
          await platformAudit(ps.platformUserId, 'user.detached_from_tenant', tenantId, 'user', userId, {
            email: existing.email,
            hardDeleted: true,
          });
          return NextResponse.json({ ok: true, message: `Detached ${existing.name} from workspace.` });
        } catch {
          // Fall through to audit-safe suspension if any secondary FK references this userId
        }
      }

      await q("UPDATE users SET status='suspended', is_complimentary_seat=1 WHERE id=? AND tenant_id=?", [userId, tenantId]);
      await platformAudit(ps.platformUserId, 'user.membership_suspended_for_retention', tenantId, 'user', userId, {
        email: existing.email,
      });
      return NextResponse.json({
        ok: true,
        message: `${existing.name} has historical compliance records in this workspace — access revoked & seat freed ($0).`,
      });
    }

    if (action === 'promote_to_platform_user') {
      const ps = await requirePlatformSession(req, 'platform:users.manage');
      const email = String(body.email || '').trim().toLowerCase();
      const name = String(body.name || '').trim();
      const role: PlatformRole = VALID_PLATFORM_ROLES.includes(body.role) ? body.role : 'platform_support_viewer';

      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return NextResponse.json({ error: 'Valid name and email are required.' }, { status: 400 });
      }
      if (await one('SELECT id FROM platform_users WHERE LOWER(email)=?', [email])) {
        return NextResponse.json({ error: `${email} is already a Platform Operator.` }, { status: 409 });
      }

      const existingTenantUser = await one<any>(
        'SELECT password_hash FROM users WHERE LOWER(email)=? AND password_hash IS NOT NULL LIMIT 1',
        [email]
      );
      let tempPassword: string | undefined;
      let passwordHash = existingTenantUser?.password_hash || null;
      if (!passwordHash) {
        tempPassword = 'Plat-' + randomBytes(9).toString('base64url');
        passwordHash = hashPassword(tempPassword);
      }

      const id = 'pu_' + randomBytes(5).toString('hex');
      await q(
        `INSERT INTO platform_users (id, name, email, password_hash, role, status)
         VALUES (?,?,?,?,?,'active')`,
        [id, name, email, passwordHash, role]
      );
      await q('UPDATE users SET is_platform_admin=1 WHERE LOWER(email)=?', [email]);

      await platformAudit(ps.platformUserId, 'platform_user.promoted_from_tenant', null, 'platform_user', id, {
        email,
        name,
        role,
      });
      return NextResponse.json({
        ok: true,
        id,
        tempPassword,
        message: `Promoted ${name} (${email}) to Platform Operator (${role}). Unified SSO active.`,
      });
    }

    // ---------- Global Shield & Specialty Industry Builder ----------

    if (action === 'save_global_industry') {
      const ps = await requirePlatformSession(req, 'platform:industries.global_manage');
      const code = String(body.code || '')
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '')
        .slice(0, 32);
      const name = String(body.name || '').trim();
      const shieldBrand = String(body.shieldBrand || '').trim() || null;
      const isCoreShield = body.isCoreShield ? 1 : 0;
      const federalBaseline = String(body.federalBaseline || '').trim() || null;
      const stateOverlayNotes = String(body.stateOverlayNotes || '').trim() || null;
      const specialRuleAlert = String(body.specialRuleAlert || '').trim() || null;
      const defaultTopics = Array.isArray(body.defaultTopics)
        ? body.defaultTopics
        : String(body.defaultTopics || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

      if (!code || !name) {
        return NextResponse.json({ error: 'Industry code and name are required.' }, { status: 400 });
      }

      const id = body.id ? String(body.id) : `ind-${code.toLowerCase().replace(/_/g, '-')}`;
      await q(
        `INSERT INTO industry_lines
           (id, tenant_id, code, name, shield_brand, is_core_shield, federal_baseline, state_overlay_notes, special_rule_alert, default_topics_json, sort_order, is_active)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           name=VALUES(name), shield_brand=VALUES(shield_brand), is_core_shield=VALUES(is_core_shield),
           federal_baseline=VALUES(federal_baseline), state_overlay_notes=VALUES(state_overlay_notes),
           special_rule_alert=VALUES(special_rule_alert), default_topics_json=VALUES(default_topics_json)`,
        [
          id,
          code,
          name,
          shieldBrand,
          isCoreShield,
          federalBaseline,
          stateOverlayNotes,
          specialRuleAlert,
          JSON.stringify(defaultTopics),
          Number(body.sortOrder) || 150,
        ]
      );
      await platformAudit(ps.platformUserId, 'industry.global_saved', null, 'industry_line', id, { code, name, shieldBrand });
      return NextResponse.json({ ok: true, id, message: `Global Industry Line "${name}" saved.` });
    }

    if (action === 'save_global_subsector') {
      const ps = await requirePlatformSession(req, 'platform:industries.global_manage');
      const industryLineId = String(body.industryLineId || '').trim();
      const code = String(body.code || '')
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '')
        .slice(0, 40);
      const name = String(body.name || '').trim();
      const description = String(body.description || '').trim() || null;

      if (!industryLineId || !code || !name) {
        return NextResponse.json({ error: 'Industry line, sub-sector code, and name are required.' }, { status: 400 });
      }
      const line = await one('SELECT id FROM industry_lines WHERE id=? AND tenant_id IS NULL', [industryLineId]);
      if (!line) return NextResponse.json({ error: 'Global industry line not found.' }, { status: 404 });

      const id = body.id ? String(body.id) : `sub-${code.toLowerCase()}`;
      await q(
        `INSERT INTO industry_subsectors (id, industry_line_id, tenant_id, code, name, description, sort_order, is_active)
         VALUES (?, ?, NULL, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description)`,
        [id, industryLineId, code, name, description, Number(body.sortOrder) || 50]
      );
      await platformAudit(ps.platformUserId, 'subsector.global_saved', null, 'industry_subsector', id, {
        industryLineId,
        code,
        name,
      });
      return NextResponse.json({ ok: true, id, message: `Global Sub-Sector "${name}" saved.` });
    }

    if (action === 'delete_global_industry') {
      const ps = await requirePlatformSession(req, 'platform:industries.global_manage');
      const id = String(body.id || '');
      const existing = await one<any>('SELECT * FROM industry_lines WHERE id=? AND tenant_id IS NULL', [id]);
      if (!existing) return NextResponse.json({ error: 'Global industry line not found.' }, { status: 404 });

      await q('UPDATE industry_lines SET is_active=0 WHERE id=? AND tenant_id IS NULL', [id]);
      await platformAudit(ps.platformUserId, 'industry.global_archived', null, 'industry_line', id, {
        code: existing.code,
        name: existing.name,
      });
      return NextResponse.json({ ok: true, message: `Global Industry Line "${existing.name}" archived.` });
    }

    if (action === 'delete_global_subsector') {
      const ps = await requirePlatformSession(req, 'platform:industries.global_manage');
      const id = String(body.id || '');
      const existing = await one<any>('SELECT * FROM industry_subsectors WHERE id=? AND tenant_id IS NULL', [id]);
      if (!existing) return NextResponse.json({ error: 'Global sub-sector not found.' }, { status: 404 });

      await q('UPDATE industry_subsectors SET is_active=0 WHERE id=? AND tenant_id IS NULL', [id]);
      await platformAudit(ps.platformUserId, 'subsector.global_archived', null, 'industry_subsector', id, {
        code: existing.code,
        name: existing.name,
      });
      return NextResponse.json({ ok: true, message: `Sub-Sector "${existing.name}" archived.` });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
