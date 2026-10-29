import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSession, can } from '@/lib/session';
import { q, one, audit } from '@/lib/db';
import { seatUsage, getTenant } from '@/lib/queries';
import { sendMail } from '@/lib/email';

const ROLES = ['owner', 'admin', 'supervisor', 'consultant'];

export async function POST(req: Request) {
  const s = await getSession();
  if (!can.manageTeam(s)) return NextResponse.json({ error: 'Only Owners and Admins can invite people.' }, { status: 403 });
  const { email, role, reason } = (await req.json()) as { email: string; role: string; reason?: string };
  const em = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: 'Unknown role.' }, { status: 400 });
  if ((role === 'admin' || role === 'owner') && !can.inviteAdmin(s)) return NextResponse.json({ error: 'Only an Owner can invite an Admin or Owner.' }, { status: 403 });
  if (await one('SELECT id FROM users WHERE tenant_id=? AND email=?', [s.tenantId, em])) return NextResponse.json({ error: em + ' is already on the team.' }, { status: 409 });

  const seats = await seatUsage(s);
  const needsSeat = role !== 'admin' && seats.free <= 0;

  // Enforce max 2 owners at app level too (in case MySQL binlog skipped trigger creation)
  if (role === 'owner' && (seats.by.owner ?? 0) >= 2) {
    return NextResponse.json({ error: 'An account can have at most two Owners.' }, { status: 409 });
  }

  const tenant = await getTenant(s);
  const appUrl = (process.env.APP_URL || 'https://safetyalchemist.com').replace(/\/$/, '');

  if (needsSeat && !can.spendMoney(s)) {
    const id = randomUUID();
    await q('INSERT INTO seat_requests (id, tenant_id, requested_by, invite_email, invite_role, reason) VALUES (?,?,?,?,?,?)', [id, s.tenantId, s.user.id, em, role, reason ?? null]);
    await audit(s.tenantId, s.user.id, 'seat.requested', 'seat_request', id, { email: em, role });

    const owners = await q<{ email: string }>('SELECT email FROM users WHERE tenant_id=? AND role="owner" AND status="active"', [s.tenantId]);
    if (owners.length > 0) {
      await sendMail({
        to: owners.map(o => o.email),
        subject: `Seat request from ${s.user.name} for ${em} (${role})`,
        text: `${s.user.name} requested a paid seat to invite ${em} as ${role}.\nReason: ${reason || 'None provided'}\n\nApprove or decline in the console: ${appUrl}/team`,
      });
    }
    return NextResponse.json({ ok: true, message: 'Seat request sent to both Owners for ' + em + '.' });
  }
  if (needsSeat) {
    await q('UPDATE tenants SET seats_purchased = seats_purchased + 1 WHERE id=?', [s.tenantId]);
    await audit(s.tenantId, s.user.id, 'seat.added', 'tenant', s.tenantId, { reason: 'invite ' + em });
  }
  const id = randomUUID();
  const name = em.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  await q("INSERT INTO users (id, tenant_id, name, email, role, status) VALUES (?,?,?,?,?,'invited')", [id, s.tenantId, name, em, role]);
  await audit(s.tenantId, s.user.id, 'user.invited', 'user', id, { email: em, role });

  await sendMail({
    to: em,
    fromName: tenant.brand_scopes?.email ? tenant.name : 'The Safety Alchemist',
    fromAddress: tenant.brand_scopes?.email && tenant.email_sender ? tenant.email_sender : undefined,
    subject: `You have been invited to ${tenant.name}`,
    text: `${s.user.name} invited you to join ${tenant.name} as ${role}.\n\nSign in here: ${appUrl}`,
  });

  return NextResponse.json({ ok: true, message: 'Invite sent to ' + em + '.' });
}
