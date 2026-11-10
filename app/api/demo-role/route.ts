import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { one, q, nowSql } from '@/lib/db';
import { generateOpaqueToken, sha256Hex, verifySameOrigin, getClientIp } from '@/lib/security';
import {
  TEAM_SESSION_COOKIE,
  IMPERSONATION_COOKIE,
  isDemoModeEnabled,
  sessionCookieOptions,
} from '@/lib/session';

export async function POST(req: Request) {
  if (!isDemoModeEnabled()) {
    return NextResponse.json({ error: 'Demo switcher is disabled.' }, { status: 403 });
  }
  const csrf = verifySameOrigin(req);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error }, { status: 403 });
  }

  const body = (await req.json()) as { role?: string; tenantId?: string; userId?: string };
  const jar = await cookies();
  const ip = getClientIp(req);
  const ua = (req.headers.get('user-agent') || '').slice(0, 250);

  let targetUser: any = null;
  if (body.userId) {
    targetUser = await one<any>(
      "SELECT u.* FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.id=? AND u.status='active' AND t.status <> 'suspended'",
      [body.userId]
    );
  } else if (body.tenantId || body.role) {
    targetUser = await one<any>(
      `SELECT u.* FROM users u JOIN tenants t ON t.id = u.tenant_id
        WHERE u.tenant_id = COALESCE(?, u.tenant_id)
          AND u.role = COALESCE(?, u.role)
          AND u.status = 'active'
          AND t.status <> 'suspended'
        LIMIT 1`,
      [body.tenantId ?? null, body.role ?? null]
    );
  }

  if (!targetUser) {
    return NextResponse.json({ error: 'Demo persona not found.' }, { status: 404 });
  }

  jar.delete('sa_user_id');
  jar.delete('demo_tenant');
  jar.delete('demo_role');
  jar.delete(IMPERSONATION_COOKIE);

  const rawToken = generateOpaqueToken();
  await q(
    `INSERT INTO user_sessions (id, tenant_id, user_id, token_hash, ip_address, user_agent, expires_at)
     VALUES (?,?,?,?,?,?,?)`,
    [randomUUID(), targetUser.tenant_id, targetUser.id, sha256Hex(rawToken), ip, ua, nowSql(7 * 86400 * 1000)]
  );
  jar.set(TEAM_SESSION_COOKIE, rawToken, sessionCookieOptions(7 * 86400));
  return NextResponse.json({ ok: true });
}
