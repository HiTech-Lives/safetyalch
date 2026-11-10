import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID, randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { q, one, audit, platformAudit, nowSql } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { sendMail } from '@/lib/email';
import {
  generateOpaqueToken,
  sha256Hex,
  verifySameOrigin,
  checkRateLimit,
  getClientIp,
} from '@/lib/security';
import {
  TEAM_SESSION_COOKIE,
  PLATFORM_SESSION_COOKIE,
  IMPERSONATION_COOKIE,
  PORTAL_SESSION_COOKIE,
  getOptionalSession,
  getOptionalPlatformSession,
  isDemoModeEnabled,
  sessionCookieOptions,
} from '@/lib/session';
import { listUserWorkspaces } from '@/lib/queries';

const TEAM_MAX_AGE = 7 * 86400; // 7 days
const PLAT_MAX_AGE = 12 * 3600; // 12 hours

async function applyGroupPreset(tenantId: string, presetKey: string) {
  try {
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
  } catch {
    // Non-fatal if preset file unavailable
  }
}

export async function POST(req: Request) {
  const csrf = verifySameOrigin(req);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error }, { status: 403 });
  }

  const ip = getClientIp(req);
  const body = await req.json();
  const { action } = body as { action: string };
  const jar = await cookies();
  const ua = (req.headers.get('user-agent') || '').slice(0, 250);

  // Clear legacy v0.0.2 unsigned cookies on any auth action
  const clearLegacyCookies = () => {
    jar.delete('sa_user_id');
    jar.delete('demo_tenant');
    jar.delete('demo_role');
  };

  if (action === 'sso_lookup') {
    const rl = checkRateLimit(`sso:${ip}`, 30, 5 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: `Too many requests. Retry in ${rl.retryAfterSec}s.` }, { status: 429 });
    }
    const emailOrDomain = String(body.email || body.domain || '').trim().toLowerCase();
    const domain = emailOrDomain.includes('@') ? emailOrDomain.split('@')[1] : emailOrDomain;
    if (!domain) return NextResponse.json({ ssoAvailable: false });

    const tenant = await one<any>(
      "SELECT id, name, custom_domain, sso_config_json FROM tenants WHERE status <> 'suspended' AND custom_domain = ? LIMIT 1",
      [domain]
    );
    if (!tenant) return NextResponse.json({ ssoAvailable: false });
    let ssoCfg: any = null;
    if (typeof tenant.sso_config_json === 'string' && tenant.sso_config_json.trim()) {
      try { ssoCfg = JSON.parse(tenant.sso_config_json); } catch { ssoCfg = null; }
    } else if (tenant.sso_config_json && typeof tenant.sso_config_json === 'object') {
      ssoCfg = tenant.sso_config_json;
    }
    if (!ssoCfg?.enabled) return NextResponse.json({ ssoAvailable: false, tenantName: tenant.name });
    return NextResponse.json({
      ssoAvailable: true,
      tenantId: tenant.id,
      tenantName: tenant.name,
      providerName: ssoCfg.providerName || 'Enterprise OIDC / SAML SSO',
      authorizationUrl: ssoCfg.authorizationUrl || null,
    });
  }

  if (action === 'login') {
    const rl = checkRateLimit(`login:${ip}`, 15, 5 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Too many sign-in attempts. Please wait ${rl.retryAfterSec} seconds.` },
        { status: 429 }
      );
    }

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const requestedTenantId = body.tenantId ? String(body.tenantId) : null;
    const preferPlatform = Boolean(body.preferPlatform);

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const [platRow, tenantUsers] = await Promise.all([
      one<any>("SELECT * FROM platform_users WHERE LOWER(email)=? AND status='active' LIMIT 1", [email]),
      q<any>(
        `SELECT u.*, t.name AS tenant_name, t.accent AS tenant_accent
           FROM users u
           JOIN tenants t ON t.id = u.tenant_id
          WHERE LOWER(u.email)=? AND u.status='active' AND t.status <> 'suspended'
          ORDER BY t.name`,
        [email]
      ),
    ]);

    const platVerified = Boolean(platRow && verifyPassword(password, platRow.password_hash));
    const verifiedTenantUsers = tenantUsers.filter(u => verifyPassword(password, u.password_hash));

    if (!platVerified && verifiedTenantUsers.length === 0) {
      const hint = isDemoModeEnabled() ? ' (Demo password: safetyalchemist)' : '';
      return NextResponse.json({ error: `Invalid email or password.${hint}` }, { status: 401 });
    }

    clearLegacyCookies();
    jar.delete(IMPERSONATION_COOKIE);

    if (platVerified && platRow) {
      const rawPlat = generateOpaqueToken();
      await q(
        `INSERT INTO platform_sessions (id, platform_user_id, token_hash, ip_address, user_agent, expires_at)
         VALUES (?,?,?,?,?,?)`,
        [randomUUID(), platRow.id, sha256Hex(rawPlat), ip, ua, nowSql(PLAT_MAX_AGE * 1000)]
      );
      jar.set(PLATFORM_SESSION_COOKIE, rawPlat, sessionCookieOptions(PLAT_MAX_AGE));
      await platformAudit(platRow.id, 'platform.login', null, 'platform_user', platRow.id, { email: platRow.email });
    } else {
      jar.delete(PLATFORM_SESSION_COOKIE);
    }

    const safeNext =
      typeof body.next === 'string' && body.next.startsWith('/') && !body.next.startsWith('//')
        ? body.next
        : null;

    const enterPlatformDirectly = platVerified && (preferPlatform || safeNext === '/platform' || verifiedTenantUsers.length === 0);

    let chosenUser: any = null;
    if (verifiedTenantUsers.length > 0 && !enterPlatformDirectly) {
      chosenUser =
        (requestedTenantId && verifiedTenantUsers.find(u => u.tenant_id === requestedTenantId)) ||
        verifiedTenantUsers[0];
      const rawTeam = generateOpaqueToken();
      await q(
        `INSERT INTO user_sessions (id, tenant_id, user_id, token_hash, ip_address, user_agent, expires_at)
         VALUES (?,?,?,?,?,?,?)`,
        [randomUUID(), chosenUser.tenant_id, chosenUser.id, sha256Hex(rawTeam), ip, ua, nowSql(TEAM_MAX_AGE * 1000)]
      );
      jar.set(TEAM_SESSION_COOKIE, rawTeam, sessionCookieOptions(TEAM_MAX_AGE));
      await audit(chosenUser.tenant_id, chosenUser.id, 'user.login', 'user', chosenUser.id, { email: chosenUser.email });
    } else {
      jar.delete(TEAM_SESSION_COOKIE);
    }

    let redirectTo = '/today';
    if (enterPlatformDirectly) {
      redirectTo = '/platform';
    } else if (safeNext) {
      redirectTo = safeNext;
    }

    return NextResponse.json({
      ok: true,
      redirectTo,
      workspaces: {
        platform: platVerified
          ? { id: platRow.id, name: platRow.name, role: platRow.role }
          : null,
        tenants: verifiedTenantUsers.map(u => ({
          tenantId: u.tenant_id,
          tenantName: u.tenant_name,
          role: u.role,
          accent: u.tenant_accent,
        })),
      },
      user: chosenUser
        ? { id: chosenUser.id, name: chosenUser.name, role: chosenUser.role, tenantId: chosenUser.tenant_id }
        : { id: platRow.id, name: platRow.name, role: platRow.role, tenantId: null },
    });
  }

  if (action === 'switch_workspace') {
    const [teamSess, platSess] = await Promise.all([getOptionalSession(), getOptionalPlatformSession()]);
    const verifiedEmail = platSess?.user.email || teamSess?.user.email;
    if (!verifiedEmail) {
      return NextResponse.json({ error: 'Authentication required to switch workspaces.' }, { status: 401 });
    }

    // End any active support impersonation when switching workspaces explicitly
    const rawImp = jar.get(IMPERSONATION_COOKIE)?.value;
    if (rawImp) {
      await q('UPDATE platform_impersonation_sessions SET ended_at=? WHERE token_hash=? AND ended_at IS NULL', [
        nowSql(),
        sha256Hex(rawImp),
      ]);
      jar.delete(IMPERSONATION_COOKIE);
    }

    if (body.target === 'platform') {
      if (!platSess) {
        return NextResponse.json({ error: 'No active Platform Operator session for this account.' }, { status: 403 });
      }
      const oldTeamRaw = jar.get(TEAM_SESSION_COOKIE)?.value;
      if (oldTeamRaw) {
        await q('UPDATE user_sessions SET revoked_at=? WHERE token_hash=?', [nowSql(), sha256Hex(oldTeamRaw)]);
        jar.delete(TEAM_SESSION_COOKIE);
      }
      return NextResponse.json({ ok: true, redirectTo: '/platform', workspaces: await listUserWorkspaces(verifiedEmail) });
    }

    const targetTenantId = String(body.tenantId || '');
    const targetUser = await one<any>(
      `SELECT u.*
         FROM users u
         JOIN tenants t ON t.id = u.tenant_id
        WHERE u.tenant_id=? AND LOWER(u.email)=LOWER(?) AND u.status='active' AND t.status <> 'suspended'
        LIMIT 1`,
      [targetTenantId, verifiedEmail]
    );
    if (!targetUser) {
      return NextResponse.json({ error: 'You do not have an active membership in that workspace.' }, { status: 403 });
    }

    const oldRaw = jar.get(TEAM_SESSION_COOKIE)?.value;
    if (oldRaw) {
      await q('UPDATE user_sessions SET revoked_at=? WHERE token_hash=?', [nowSql(), sha256Hex(oldRaw)]);
    }

    const rawTeam = generateOpaqueToken();
    await q(
      `INSERT INTO user_sessions (id, tenant_id, user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES (?,?,?,?,?,?,?)`,
      [randomUUID(), targetUser.tenant_id, targetUser.id, sha256Hex(rawTeam), ip, ua, nowSql(TEAM_MAX_AGE * 1000)]
    );
    jar.set(TEAM_SESSION_COOKIE, rawTeam, sessionCookieOptions(TEAM_MAX_AGE));
    await audit(targetUser.tenant_id, targetUser.id, 'user.workspace_switched', 'user', targetUser.id, { tenantId: targetTenantId });
    return NextResponse.json({ ok: true, redirectTo: '/today', workspaces: await listUserWorkspaces(verifiedEmail) });
  }

  if (action === 'exit_impersonation') {
    const platSess = await getOptionalPlatformSession();
    const rawImp = jar.get(IMPERSONATION_COOKIE)?.value;
    if (rawImp) {
      const impRow = await one<any>('SELECT * FROM platform_impersonation_sessions WHERE token_hash=?', [sha256Hex(rawImp)]);
      await q('UPDATE platform_impersonation_sessions SET ended_at=? WHERE token_hash=? AND ended_at IS NULL', [
        nowSql(),
        sha256Hex(rawImp),
      ]);
      if (impRow) {
        await platformAudit(
          platSess?.platformUserId ?? impRow.platform_user_id,
          'impersonation.ended',
          impRow.target_tenant_id,
          'impersonation',
          impRow.id
        );
      }
      jar.delete(IMPERSONATION_COOKIE);
    }
    return NextResponse.json({ ok: true, redirectTo: '/platform' });
  }

  if (action === 'demo_login') {
    if (!isDemoModeEnabled()) {
      return NextResponse.json({ error: 'Demo quick-login is disabled in this environment.' }, { status: 403 });
    }
    clearLegacyCookies();
    jar.delete(IMPERSONATION_COOKIE);

    if (body.platformEmail) {
      const pu = await one<any>("SELECT * FROM platform_users WHERE LOWER(email)=LOWER(?) AND status='active'", [
        String(body.platformEmail),
      ]);
      if (!pu) return NextResponse.json({ error: 'Demo platform operator not found.' }, { status: 404 });
      const rawPlat = generateOpaqueToken();
      await q(
        `INSERT INTO platform_sessions (id, platform_user_id, token_hash, ip_address, user_agent, expires_at)
         VALUES (?,?,?,?,?,?)`,
        [randomUUID(), pu.id, sha256Hex(rawPlat), ip, ua, nowSql(PLAT_MAX_AGE * 1000)]
      );
      jar.set(PLATFORM_SESSION_COOKIE, rawPlat, sessionCookieOptions(PLAT_MAX_AGE));
      return NextResponse.json({ ok: true, redirectTo: '/platform' });
    }

    const userId = String(body.userId || '');
    const u = await one<any>(
      "SELECT u.* FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.id=? AND u.status='active' AND t.status <> 'suspended'",
      [userId]
    );
    if (!u) return NextResponse.json({ error: 'Demo user not found.' }, { status: 404 });
    const rawTeam = generateOpaqueToken();
    await q(
      `INSERT INTO user_sessions (id, tenant_id, user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES (?,?,?,?,?,?,?)`,
      [randomUUID(), u.tenant_id, u.id, sha256Hex(rawTeam), ip, ua, nowSql(TEAM_MAX_AGE * 1000)]
    );
    jar.set(TEAM_SESSION_COOKIE, rawTeam, sessionCookieOptions(TEAM_MAX_AGE));
    return NextResponse.json({ ok: true, redirectTo: '/today' });
  }

  if (action === 'signup') {
    const rl = checkRateLimit(`signup:${ip}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: `Too many signup attempts. Retry in ${rl.retryAfterSec}s.` }, { status: 429 });
    }

    const orgName = String(body.orgName || '').trim();
    const ownerName = String(body.ownerName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const customDomain = String(body.customDomain || '').trim().toLowerCase() || null;
    const emailSender = String(body.emailSender || '').trim().toLowerCase() || null;
    const accent = /^#[0-9a-fA-F]{6}$/.test(String(body.accent || '')) ? String(body.accent) : '#4b2454';
    const seats = Math.max(1, Math.min(100, Number(body.seats) || 1));
    const plan = ['solo', 'professional', 'enterprise'].includes(body.plan) ? body.plan : 'professional';
    const groupPreset = ['breckpoint_sig_rsa', 'standard_consultancy', 'blank'].includes(body.groupPreset)
      ? body.groupPreset
      : 'standard_consultancy';
    const firstMemberName = String(body.firstMemberName || '').trim();
    const firstMemberIndustry = String(body.firstMemberIndustry || 'General').trim();
    const firstMemberCity = String(body.firstMemberCity || '').trim() || null;
    const firstSiteName = String(body.firstSiteName || 'Main Facility').trim();
    const firstSiteJur = String(body.firstSiteJur || 'CA').toUpperCase().slice(0, 8);
    const firstContactName = String(body.firstContactName || '').trim();
    const firstContactEmail = String(body.firstContactEmail || '').trim().toLowerCase();

    if (!orgName || !ownerName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 10) {
      return NextResponse.json(
        { error: 'Organization name, owner name, valid email, and a password of at least 10 characters are required.' },
        { status: 400 }
      );
    }

    if (customDomain && (await one('SELECT id FROM tenants WHERE custom_domain=?', [customDomain]))) {
      return NextResponse.json({ error: 'That custom domain is already registered.' }, { status: 409 });
    }

    const tenantId = 't_' + randomBytes(6).toString('hex');
    const userId = 'u_' + randomBytes(6).toString('hex');
    const scopes = JSON.stringify({ app: true, reports: true, email: true, portal: true, signin: true });

    await q(
      `INSERT INTO tenants (id, name, custom_domain, email_sender, email_sender_verified, accent, brand_scopes, group_label, seats_purchased, plan, status)
       VALUES (?,?,?,?,0,?,?,'Client Portfolios',?,?,'active')`,
      [tenantId, orgName, customDomain, emailSender || `reports@${customDomain || 'safetyalchemist.com'}`, accent, scopes, seats, plan]
    );

    await q(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, role, status, is_platform_admin)
       VALUES (?,?,?,?,?,'owner','active',0)`,
      [userId, tenantId, ownerName, email, hashPassword(password)]
    );

    if (groupPreset !== 'blank') {
      await applyGroupPreset(tenantId, groupPreset);
    }

    if (firstMemberName) {
      const mId = randomUUID();
      const sId = randomUUID();
      const cId = randomUUID();
      await q('INSERT INTO members (id, tenant_id, name, industry, city) VALUES (?,?,?,?,?)', [
        mId,
        tenantId,
        firstMemberName,
        firstMemberIndustry,
        firstMemberCity,
      ]);
      await q('INSERT INTO sites (id, member_id, name, jurisdiction) VALUES (?,?,?,?)', [
        sId,
        mId,
        firstSiteName,
        firstSiteJur,
      ]);
      await q('INSERT INTO member_contacts (id, member_id, name, email, is_primary) VALUES (?,?,?,?,1)', [
        cId,
        mId,
        firstContactName || ownerName,
        firstContactEmail || email,
      ]);
      await q('INSERT INTO member_assignments (member_id, user_id) VALUES (?,?)', [mId, userId]);
    }

    await audit(tenantId, userId, 'tenant.signup', 'tenant', tenantId, { orgName, plan, seats, groupPreset });

    clearLegacyCookies();
    const rawTeam = generateOpaqueToken();
    await q(
      `INSERT INTO user_sessions (id, tenant_id, user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES (?,?,?,?,?,?,?)`,
      [randomUUID(), tenantId, userId, sha256Hex(rawTeam), ip, ua, nowSql(TEAM_MAX_AGE * 1000)]
    );
    jar.set(TEAM_SESSION_COOKIE, rawTeam, sessionCookieOptions(TEAM_MAX_AGE));

    return NextResponse.json({ ok: true, tenantId, redirectTo: '/today' });
  }

  if (action === 'logout') {
    const now = nowSql();
    const teamRaw = jar.get(TEAM_SESSION_COOKIE)?.value;
    const platRaw = jar.get(PLATFORM_SESSION_COOKIE)?.value;
    const impRaw = jar.get(IMPERSONATION_COOKIE)?.value;
    const portRaw = jar.get(PORTAL_SESSION_COOKIE)?.value;

    await Promise.all([
      teamRaw ? q('UPDATE user_sessions SET revoked_at=? WHERE token_hash=?', [now, sha256Hex(teamRaw)]) : Promise.resolve(),
      platRaw ? q('UPDATE platform_sessions SET revoked_at=? WHERE token_hash=?', [now, sha256Hex(platRaw)]) : Promise.resolve(),
      impRaw ? q('UPDATE platform_impersonation_sessions SET ended_at=? WHERE token_hash=?', [now, sha256Hex(impRaw)]) : Promise.resolve(),
      portRaw ? q('UPDATE portal_sessions SET revoked_at=? WHERE token_hash=?', [now, sha256Hex(portRaw)]) : Promise.resolve(),
    ]);

    jar.delete(TEAM_SESSION_COOKIE);
    jar.delete(PLATFORM_SESSION_COOKIE);
    jar.delete(IMPERSONATION_COOKIE);
    jar.delete(PORTAL_SESSION_COOKIE);
    clearLegacyCookies();
    return NextResponse.json({ ok: true, redirectTo: '/login' });
  }

  if (action === 'request_magic_link') {
    const rl = checkRateLimit(`magic:${ip}`, 6, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: `Too many requests. Please wait ${rl.retryAfterSec}s.` }, { status: 429 });
    }

    const email = String(body.email || '').trim().toLowerCase();
    const contactId = String(body.contactId || '').trim();
    const teamSess = await getOptionalSession();

    let contact: any = null;
    if (contactId && teamSess) {
      contact = await one<any>(
        'SELECT c.*, m.name AS member_name, m.tenant_id FROM member_contacts c JOIN members m ON m.id = c.member_id WHERE c.id=? AND m.tenant_id=?',
        [contactId, teamSess.tenantId]
      );
    } else if (email) {
      contact = await one<any>(
        'SELECT c.*, m.name AS member_name, m.tenant_id FROM member_contacts c JOIN members m ON m.id = c.member_id WHERE LOWER(c.email)=? LIMIT 1',
        [email]
      );
    }

    // Prevent account enumeration for unauthenticated callers
    if (!contact) {
      return NextResponse.json({
        ok: true,
        message: 'If a Member Portal contact matches that email address, a one-time sign-in link has been sent.',
      });
    }

    const rawToken = generateOpaqueToken();
    const tokenHash = sha256Hex(rawToken);
    const expStr = nowSql(30 * 86400 * 1000); // 30-day magic link

    await q('INSERT INTO magic_links (id, contact_id, token_hash, expires_at) VALUES (?,?,?,?)', [
      randomUUID(),
      contact.id,
      tokenHash,
      expStr,
    ]);

    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const linkUrl = `${appUrl}/portal/${rawToken}`;
    await sendMail({
      to: contact.email,
      subject: `Your sign-in link for ${contact.member_name} Safety Portal`,
      text: `Hello ${contact.name},\n\nOpen your Member Safety Portal using this secure sign-in link:\n${linkUrl}\n\nThis link expires in 30 days.`,
    });

    await audit(contact.tenant_id, teamSess?.user.id ?? null, 'portal.magic_link_requested', 'member_contact', contact.id, {
      email: contact.email,
    });

    return NextResponse.json({
      ok: true,
      message: `If a Member Portal contact matches ${contact.email}, a secure sign-in link has been sent.`,
      ...(isDemoModeEnabled() ? { demoPortalUrl: `/portal/${rawToken}` } : {}),
    });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
