import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSession, can } from '@/lib/session';
import { q, one, audit } from '@/lib/db';
import { seatUsage, getTenant } from '@/lib/queries';
import { sendMail } from '@/lib/email';

export async function POST(req: Request) {
  const s = await getSession();
  const body = await req.json();
  const { action } = body as { action: string };

  if (action === 'approve' || action === 'decline') {
    if (!can.spendMoney(s)) {
      return NextResponse.json({ error: 'Only an Owner can approve or decline seat requests.' }, { status: 403 });
    }
    const requestId = String(body.requestId || '');
    const sr = await one<any>(
      'SELECT sr.*, u.email AS req_email, u.name AS req_name FROM seat_requests sr JOIN users u ON u.id = sr.requested_by WHERE sr.id=? AND sr.tenant_id=?',
      [requestId, s.tenantId]
    );
    if (!sr) return NextResponse.json({ error: 'Seat request not found.' }, { status: 404 });
    if (sr.status !== 'pending') return NextResponse.json({ error: `Request is already ${sr.status}.` }, { status: 409 });

    if (action === 'decline') {
      const declineReason = String(body.declineReason || body.reason || '').trim();
      if (!declineReason) return NextResponse.json({ error: 'Declining requires a one-line reason for the Admin.' }, { status: 400 });
      await q("UPDATE seat_requests SET status='declined', decided_by=?, decided_at=NOW(), decline_reason=? WHERE id=?", [
        s.user.id,
        declineReason,
        requestId,
      ]);
      await audit(s.tenantId, s.user.id, 'seat_request.declined', 'seat_request', requestId, { email: sr.invite_email, declineReason });
      if (sr.req_email) {
        await sendMail({
          to: sr.req_email,
          subject: `Seat request declined for ${sr.invite_email}`,
          text: `${s.user.name} declined the seat request for ${sr.invite_email}.\nReason: ${declineReason}`,
        });
      }
      return NextResponse.json({ ok: true, message: `Seat request for ${sr.invite_email} declined.` });
    }

    // Approve: add seat if needed + create invited user + send invite
    const seats = await seatUsage(s);
    if (seats.free <= 0) {
      await q('UPDATE tenants SET seats_purchased = seats_purchased + 1 WHERE id=?', [s.tenantId]);
      await audit(s.tenantId, s.user.id, 'seat.added', 'tenant', s.tenantId, { reason: 'approved seat request ' + requestId });
    }
    await q("UPDATE seat_requests SET status='approved', decided_by=?, decided_at=NOW() WHERE id=?", [s.user.id, requestId]);

    let userId = (await one<{ id: string }>('SELECT id FROM users WHERE tenant_id=? AND email=?', [s.tenantId, sr.invite_email]))?.id;
    if (!userId) {
      userId = randomUUID();
      const name = sr.invite_email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      await q("INSERT INTO users (id, tenant_id, name, email, role, status) VALUES (?,?,?,?,?,'invited')", [
        userId,
        s.tenantId,
        name,
        sr.invite_email,
        sr.invite_role,
      ]);
    }
    await audit(s.tenantId, s.user.id, 'seat_request.approved', 'seat_request', requestId, { email: sr.invite_email, role: sr.invite_role, userId });

    const tenant = await getTenant(s);
    const appUrl = (process.env.APP_URL || 'https://safetyalchemist.com').replace(/\/$/, '');
    await sendMail({
      to: sr.invite_email,
      fromName: tenant.brand_scopes?.email ? tenant.name : 'The Safety Alchemist',
      fromAddress: tenant.brand_scopes?.email && tenant.email_sender ? tenant.email_sender : undefined,
      subject: `You have been invited to ${tenant.name}`,
      text: `${s.user.name} approved your seat and invited you to join ${tenant.name} as ${sr.invite_role}.\n\nSign in here: ${appUrl}`,
    });

    return NextResponse.json({ ok: true, message: `Seat approved and invite sent to ${sr.invite_email}.` });
  }

  if (action === 'update_user') {
    if (!can.manageTeam(s)) {
      return NextResponse.json({ error: 'Only Owners and Admins can manage team members.' }, { status: 403 });
    }
    const userId = String(body.userId || '');
    const u = await one<any>('SELECT * FROM users WHERE id=? AND tenant_id=?', [userId, s.tenantId]);
    if (!u) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

    const nextRole = String(body.role || u.role);
    const nextStatus = String(body.status || u.status);
    const nextSupervisor = body.supervisorId ? String(body.supervisorId) : null;

    if ((nextRole === 'owner' || nextRole === 'admin' || u.role === 'owner') && !can.inviteAdmin(s)) {
      return NextResponse.json({ error: 'Only an Owner can change Owner or Admin roles.' }, { status: 403 });
    }

    const seats = await seatUsage(s);
    if (nextRole === 'owner' && u.role !== 'owner' && (seats.by.owner ?? 0) >= 2) {
      return NextResponse.json({ error: 'An account can have at most two Owners.' }, { status: 409 });
    }

    // Promoting an Admin to a field role consumes a paid seat
    const wasPaid = u.role !== 'admin' && u.status !== 'suspended';
    const willBePaid = nextRole !== 'admin' && nextStatus !== 'suspended';
    if (!wasPaid && willBePaid && seats.free <= 0) {
      if (!can.spendMoney(s)) {
        return NextResponse.json({ error: 'No free paid seat available. Ask an Owner to add a seat first.' }, { status: 409 });
      }
      await q('UPDATE tenants SET seats_purchased = seats_purchased + 1 WHERE id=?', [s.tenantId]);
      await audit(s.tenantId, s.user.id, 'seat.added', 'tenant', s.tenantId, { reason: 'role change for ' + u.email });
    }

    await q('UPDATE users SET role=?, status=?, supervisor_id=? WHERE id=?', [
      nextRole,
      nextStatus,
      nextRole === 'consultant' ? nextSupervisor : null,
      userId,
    ]);
    await audit(s.tenantId, s.user.id, 'user.updated', 'user', userId, { role: nextRole, status: nextStatus, supervisor_id: nextSupervisor });
    return NextResponse.json({ ok: true, message: `${u.name} updated.` });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}

