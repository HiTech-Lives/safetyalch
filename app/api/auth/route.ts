import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID, randomBytes } from 'node:crypto';
import { q, one, audit } from '@/lib/db';
import { hashPassword, verifyPassword, hashToken } from '@/lib/auth';
import { sendMail } from '@/lib/email';

export async function POST(req: Request) {
  const body = await req.json();
  const { action } = body as { action: string };
  const jar = await cookies();

  if (action === 'login') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }
    const user = await one<any>('SELECT * FROM users WHERE LOWER(email)=? AND status <> "suspended" LIMIT 1', [email]);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: 'Invalid email or password. (Demo password: safetyalchemist)' }, { status: 401 });
    }
    jar.set('sa_user_id', user.id, { path: '/', sameSite: 'lax', httpOnly: true });
    jar.set('demo_tenant', user.tenant_id, { path: '/', sameSite: 'lax', httpOnly: true });
    jar.set('demo_role', user.role, { path: '/', sameSite: 'lax', httpOnly: true });
    await audit(user.tenant_id, user.id, 'user.login', 'user', user.id, { email: user.email });
    return NextResponse.json({ ok: true, redirectTo: '/today', user: { id: user.id, name: user.name, role: user.role, tenantId: user.tenant_id } });
  }

  if (action === 'signup') {
    const orgName = String(body.orgName || '').trim();
    const ownerName = String(body.ownerName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const customDomain = String(body.customDomain || '').trim().toLowerCase() || null;
    const emailSender = String(body.emailSender || '').trim().toLowerCase() || null;
    const accent = /^#[0-9a-fA-F]{6}$/.test(String(body.accent || '')) ? String(body.accent) : '#4b2454';
    const seats = Math.max(1, Math.min(100, Number(body.seats) || 1));
    const plan = ['solo', 'professional', 'enterprise'].includes(body.plan) ? body.plan : 'professional';
    const firstMemberName = String(body.firstMemberName || '').trim();
    const firstMemberIndustry = String(body.firstMemberIndustry || 'General').trim();
    const firstMemberCity = String(body.firstMemberCity || '').trim() || null;
    const firstSiteName = String(body.firstSiteName || 'Main Facility').trim();
    const firstSiteJur = String(body.firstSiteJur || 'CA').toUpperCase();
    const firstContactName = String(body.firstContactName || '').trim();
    const firstContactEmail = String(body.firstContactEmail || '').trim().toLowerCase();

    if (!orgName || !ownerName || !email || password.length < 6) {
      return NextResponse.json({ error: 'Organization name, owner name, email, and a password (6+ chars) are required.' }, { status: 400 });
    }

    const tenantId = 't_' + randomBytes(4).toString('hex');
    const userId = 'u_' + randomBytes(4).toString('hex');
    const scopes = JSON.stringify({ app: true, reports: true, email: true, portal: true, signin: true });

    await q(
      `INSERT INTO tenants (id, name, custom_domain, email_sender, accent, brand_scopes, seats_purchased, plan, status)
       VALUES (?,?,?,?,?,?,?,?,'active')`,
      [tenantId, orgName, customDomain, emailSender || `reports@${customDomain || 'safetyalchemist.com'}`, accent, scopes, seats, plan]
    );

    await q(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, role, status, is_platform_admin)
       VALUES (?,?,?,?,?,'owner','active',0)`,
      [userId, tenantId, ownerName, email, hashPassword(password)]
    );

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

    await audit(tenantId, userId, 'tenant.signup', 'tenant', tenantId, { orgName, plan, seats });
    jar.set('sa_user_id', userId, { path: '/', sameSite: 'lax', httpOnly: true });
    jar.set('demo_tenant', tenantId, { path: '/', sameSite: 'lax', httpOnly: true });
    jar.set('demo_role', 'owner', { path: '/', sameSite: 'lax', httpOnly: true });

    return NextResponse.json({ ok: true, tenantId, redirectTo: '/today' });
  }

  if (action === 'logout') {
    jar.delete('sa_user_id');
    jar.delete('demo_tenant');
    jar.delete('demo_role');
    return NextResponse.json({ ok: true, redirectTo: '/' });
  }

  if (action === 'request_magic_link') {
    const email = String(body.email || '').trim().toLowerCase();
    const contactId = String(body.contactId || '').trim();
    const contact = contactId
      ? await one<any>('SELECT c.*, m.name AS member_name, m.tenant_id FROM member_contacts c JOIN members m ON m.id = c.member_id WHERE c.id=?', [contactId])
      : await one<any>('SELECT c.*, m.name AS member_name, m.tenant_id FROM member_contacts c JOIN members m ON m.id = c.member_id WHERE LOWER(c.email)=? LIMIT 1', [email]);

    if (!contact) {
      return NextResponse.json({ error: 'No Member contact found for that email address.' }, { status: 404 });
    }

    const rawToken = randomBytes(20).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expires = new Date();
    expires.setDate(expires.getDate() + 90);
    const expStr = expires.toISOString().slice(0, 19).replace('T', ' ');

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
      text: `Hello ${contact.name},\n\nOpen your Member Safety Portal using this one-time sign-in link:\n${linkUrl}\n\nThis link remains valid for 90 days.`,
    });

    return NextResponse.json({
      ok: true,
      message: `Magic sign-in link sent to ${contact.email}.`,
      portalUrl: `/portal/${rawToken}`,
    });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}

