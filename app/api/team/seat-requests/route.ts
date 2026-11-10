import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireApiSession, can, apiErrorResponse } from '@/lib/session';
import { q, one, audit, nowSql } from '@/lib/db';
import { seatUsage, getTenant } from '@/lib/queries';
import { TEAM_PERMISSION_LABELS, assertUserInTenant } from '@/lib/acl';
import { sendMail } from '@/lib/email';

const VALID_ROLES = ['owner', 'admin', 'supervisor', 'consultant', 'underwriting', 'viewer'];
const COMPLIMENTARY_ROLES = new Set(['admin', 'viewer']);
const VALID_TEAM_PERMS = new Set<string>(TEAM_PERMISSION_LABELS.map(p => p.key));

export async function POST(req: Request) {
  try {
    const s = await requireApiSession(req);
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
        await q("UPDATE seat_requests SET status='declined', decided_by=?, decided_at=?, decline_reason=? WHERE id=? AND tenant_id=?", [
          s.user.id,
          nowSql(),
          declineReason,
          requestId,
          s.tenantId,
        ]);
        await audit(
          s.tenantId,
          s.user.id,
          'seat_request.declined',
          'seat_request',
          requestId,
          { email: sr.invite_email, declineReason },
          s.impersonation?.platformUserId
        );
        if (sr.req_email) {
          await sendMail({
            to: sr.req_email,
            subject: `Seat request declined for ${sr.invite_email}`,
            text: `${s.user.name} declined the seat request for ${sr.invite_email}.\nReason: ${declineReason}`,
          });
        }
        return NextResponse.json({ ok: true, message: `Seat request for ${sr.invite_email} declined.` });
      }

      const seats = await seatUsage(s);
      if (!COMPLIMENTARY_ROLES.has(sr.invite_role) && seats.free <= 0) {
        await q('UPDATE tenants SET seats_purchased = seats_purchased + 1 WHERE id=?', [s.tenantId]);
        await audit(
          s.tenantId,
          s.user.id,
          'seat.added',
          'tenant',
          s.tenantId,
          { reason: 'approved seat request ' + requestId },
          s.impersonation?.platformUserId
        );
      }
      await q("UPDATE seat_requests SET status='approved', decided_by=?, decided_at=? WHERE id=? AND tenant_id=?", [
        s.user.id,
        nowSql(),
        requestId,
        s.tenantId,
      ]);

      let userId = (await one<{ id: string }>('SELECT id FROM users WHERE tenant_id=? AND LOWER(email)=LOWER(?)', [s.tenantId, sr.invite_email]))?.id;
      if (!userId) {
        userId = randomUUID();
        const name = sr.invite_email
          .split('@')[0]
          .replace(/[._-]+/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase());
        await q("INSERT INTO users (id, tenant_id, name, email, role, status) VALUES (?,?,?,?,?,'invited')", [
          userId,
          s.tenantId,
          name,
          sr.invite_email,
          sr.invite_role,
        ]);
      }
      await audit(
        s.tenantId,
        s.user.id,
        'seat_request.approved',
        'seat_request',
        requestId,
        { email: sr.invite_email, role: sr.invite_role, userId },
        s.impersonation?.platformUserId
      );

      const tenant = await getTenant(s);
      const appUrl = (process.env.APP_URL || 'https://safetyalchemist.com').replace(/\/$/, '');
      const verifiedFrom =
        tenant.brand_scopes?.email && tenant.email_sender_verified && tenant.email_sender ? tenant.email_sender : undefined;
      await sendMail({
        to: sr.invite_email,
        fromName: tenant.brand_scopes?.email ? tenant.name : 'The Safety Alchemist',
        fromAddress: verifiedFrom,
        subject: `You have been invited to ${tenant.name}`,
        text: `${s.user.name} approved your seat and invited you to join ${tenant.name} as ${sr.invite_role}.\n\nSign in here: ${appUrl}/login`,
      });

      return NextResponse.json({ ok: true, message: `Seat approved and invite sent to ${sr.invite_email}.` });
    }

    if (action === 'update_user') {
      if (!can.manageTeam(s)) {
        return NextResponse.json({ error: 'Missing team:users.manage permission.' }, { status: 403 });
      }
      const userId = String(body.userId || '');
      const u = await one<any>('SELECT * FROM users WHERE id=? AND tenant_id=?', [userId, s.tenantId]);
      if (!u) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

      const nextRole = VALID_ROLES.includes(body.role) ? String(body.role) : u.role;
      const nextStatus = ['active', 'invited', 'suspended'].includes(body.status) ? String(body.status) : u.status;
      const nextSupervisor = body.supervisorId ? String(body.supervisorId) : null;

      if (nextSupervisor) {
        await assertUserInTenant(s.tenantId, nextSupervisor);
      }

      if ((nextRole === 'owner' || u.role === 'owner') && s.role !== 'owner') {
        return NextResponse.json({ error: 'Only a Workspace Owner can modify Owner roles.' }, { status: 403 });
      }
      if ((nextRole === 'admin' || u.role === 'admin') && !can.inviteAdmin(s)) {
        return NextResponse.json({ error: 'Only an Owner or ACL Admin can change Admin roles.' }, { status: 403 });
      }
      if (userId === s.user.id && nextStatus === 'suspended') {
        return NextResponse.json({ error: 'You cannot suspend your own account.' }, { status: 400 });
      }

      const seats = await seatUsage(s);
      if (nextRole === 'owner' && u.role !== 'owner' && (seats.by.owner ?? 0) >= 2) {
        return NextResponse.json({ error: 'An account can have at most two Owners.' }, { status: 409 });
      }

      const wasPaid = !COMPLIMENTARY_ROLES.has(u.role) && !u.is_complimentary_seat && u.status !== 'suspended';
      const willBePaid = !COMPLIMENTARY_ROLES.has(nextRole) && !u.is_complimentary_seat && nextStatus !== 'suspended';
      if (!wasPaid && willBePaid && seats.free <= 0) {
        if (!can.spendMoney(s)) {
          return NextResponse.json({ error: 'No free paid seat available. Ask an Owner to add a seat first.' }, { status: 409 });
        }
        await q('UPDATE tenants SET seats_purchased = seats_purchased + 1 WHERE id=?', [s.tenantId]);
        await audit(
          s.tenantId,
          s.user.id,
          'seat.added',
          'tenant',
          s.tenantId,
          { reason: 'role change for ' + u.email },
          s.impersonation?.platformUserId
        );
      }

      // Revoke active sessions immediately if user is suspended
      if (nextStatus === 'suspended' && u.status !== 'suspended') {
        await q('UPDATE user_sessions SET revoked_at=? WHERE user_id=? AND tenant_id=? AND revoked_at IS NULL', [
          nowSql(),
          userId,
          s.tenantId,
        ]);
      }

      await q('UPDATE users SET role=?, status=?, supervisor_id=? WHERE id=? AND tenant_id=?', [
        nextRole,
        nextStatus,
        nextRole === 'consultant' ? nextSupervisor : null,
        userId,
        s.tenantId,
      ]);
      await audit(
        s.tenantId,
        s.user.id,
        'user.updated',
        'user',
        userId,
        { role: nextRole, status: nextStatus, supervisor_id: nextSupervisor },
        s.impersonation?.platformUserId
      );
      return NextResponse.json({ ok: true, message: `${u.name} updated.` });
    }

    if (action === 'set_user_acl') {
      if (!can.manageAcl(s)) {
        return NextResponse.json({ error: 'Missing team:acl.manage permission.' }, { status: 403 });
      }
      const userId = String(body.userId || '');
      const overrides = (body.overrides || {}) as Record<string, 'allow' | 'deny' | 'inherit'>;
      const u = await one<any>('SELECT * FROM users WHERE id=? AND tenant_id=?', [userId, s.tenantId]);
      if (!u) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
      if (u.role === 'owner' && s.role !== 'owner') {
        return NextResponse.json({ error: 'Only an Owner can modify another Owner’s ACL overrides.' }, { status: 403 });
      }

      for (const [permKey, effect] of Object.entries(overrides)) {
        if (!VALID_TEAM_PERMS.has(permKey)) continue;
        if (u.role === 'owner' && permKey === 'team:acl.manage' && effect === 'deny') continue;

        if (effect === 'inherit') {
          await q('DELETE FROM user_permission_overrides WHERE user_id=? AND tenant_id=? AND permission_key=?', [
            userId,
            s.tenantId,
            permKey,
          ]);
        } else if (effect === 'allow' || effect === 'deny') {
          await q(
            `INSERT INTO user_permission_overrides (tenant_id, user_id, permission_key, effect, updated_by, updated_at)
             VALUES (?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE effect=VALUES(effect), updated_by=VALUES(updated_by), updated_at=VALUES(updated_at)`,
            [s.tenantId, userId, permKey, effect, s.user.id, nowSql()]
          );
        }
      }

      await audit(
        s.tenantId,
        s.user.id,
        'user.acl_updated',
        'user',
        userId,
        { overrides },
        s.impersonation?.platformUserId
      );
      return NextResponse.json({ ok: true, message: `ACL permission overrides saved for ${u.name}.` });
    }

    if (action === 'set_user_groups') {
      if (!can.manageTeam(s) && !can.manageAcl(s)) {
        return NextResponse.json({ error: 'Missing permission to assign portfolio group scopes.' }, { status: 403 });
      }
      const userId = String(body.userId || '');
      const groupIds: string[] = Array.isArray(body.groupIds) ? body.groupIds.map(String) : [];
      const u = await one<any>('SELECT * FROM users WHERE id=? AND tenant_id=?', [userId, s.tenantId]);
      if (!u) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

      const validGroups = groupIds.length
        ? await q<{ id: string }>(
            `SELECT id FROM tenant_member_groups WHERE tenant_id=? AND id IN (${groupIds.map(() => '?').join(',')})`,
            [s.tenantId, ...groupIds]
          )
        : [];

      await q('DELETE FROM user_group_scopes WHERE user_id=?', [userId]);
      for (const g of validGroups) {
        await q('INSERT IGNORE INTO user_group_scopes (user_id, group_id) VALUES (?,?)', [userId, g.id]);
      }

      await audit(
        s.tenantId,
        s.user.id,
        'user.groups_scoped',
        'user',
        userId,
        { groupIds: validGroups.map(g => g.id) },
        s.impersonation?.platformUserId
      );
      return NextResponse.json({
        ok: true,
        message: validGroups.length
          ? `${u.name} scoped to ${validGroups.length} portfolio group(s).`
          : `${u.name} now has access across all portfolio groups.`,
      });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
