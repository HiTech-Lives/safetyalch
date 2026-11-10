import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { one, q, nowSql } from './db';
import { sha256Hex, verifySameOrigin } from './security';
import {
  evaluatePlatformPermissions,
  evaluateTeamPermissions,
  type PlatformPermission,
  type PlatformRole,
  type TeamPermission,
  type TeamRole,
} from './acl';

export const TEAM_SESSION_COOKIE = 'sa_session';
export const PLATFORM_SESSION_COOKIE = 'sa_plat_session';
export const IMPERSONATION_COOKIE = 'sa_imp_session';
export const PORTAL_SESSION_COOKIE = 'sa_portal_session';

export type Role = TeamRole;

export type User = {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: Role;
  status: string;
  supervisor_id: string | null;
  is_platform_admin?: number;
};

export type ImpersonationContext = {
  id: string;
  platformUserId: string;
  platformName: string;
  platformEmail: string;
  reason: string;
  expiresAt: string;
};

export type Session = {
  tenantId: string;
  user: User;
  role: Role;
  permissions: Set<TeamPermission>;
  groupScopes: string[];
  isPlatformAdmin: boolean;
  impersonation: ImpersonationContext | null;
};

export type PlatformUser = {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
  status: string;
};

export type PlatformSession = {
  platformUserId: string;
  user: PlatformUser;
  role: PlatformRole;
  permissions: Set<PlatformPermission>;
};

export type PortalSession = {
  sessionId: string;
  contactId: string;
  memberId: string;
  tenantId: string;
  contactName: string;
  contactEmail: string;
};

export class ApiAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function isDemoModeEnabled(): boolean {
  if (process.env.ENABLE_DEMO_MODE === 'true') return true;
  if (process.env.ENABLE_DEMO_MODE === 'false') return false;
  return process.env.NODE_ENV !== 'production' && process.env.DEMO_ROLE_SWITCH === 'true';
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production' && process.env.DISABLE_SECURE_COOKIE !== 'true',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

// ---------- Platform Plane Session Resolution ----------

export async function getOptionalPlatformSession(): Promise<PlatformSession | null> {
  const jar = await cookies();
  const rawToken = jar.get(PLATFORM_SESSION_COOKIE)?.value;
  if (!rawToken || rawToken.length < 32) return null;

  const tokenHash = sha256Hex(rawToken);
  const row = await one<PlatformUser & { session_id: string }>(
    `SELECT pu.id, pu.name, pu.email, pu.role, pu.status, ps.id AS session_id
       FROM platform_sessions ps
       JOIN platform_users pu ON pu.id = ps.platform_user_id
      WHERE ps.token_hash = ?
        AND ps.revoked_at IS NULL
        AND ps.expires_at > ?
        AND pu.status = 'active'`,
    [tokenHash, nowSql()]
  );
  if (!row) return null;

  const overrides = await q<{ permission_key: string; effect: 'allow' | 'deny' }>(
    'SELECT permission_key, effect FROM platform_user_acl WHERE platform_user_id = ?',
    [row.id]
  );
  return {
    platformUserId: row.id,
    user: { id: row.id, name: row.name, email: row.email, role: row.role, status: row.status },
    role: row.role,
    permissions: evaluatePlatformPermissions(row.role, overrides),
  };
}

export async function getPlatformSession(): Promise<PlatformSession> {
  const ps = await getOptionalPlatformSession();
  if (!ps) redirect('/login?next=/platform');
  return ps;
}

export async function requirePlatformSession(req?: Request, perm?: PlatformPermission): Promise<PlatformSession> {
  if (req) {
    const csrf = verifySameOrigin(req);
    if (!csrf.ok) throw new ApiAuthError(403, csrf.error);
  }
  const ps = await getOptionalPlatformSession();
  if (!ps) throw new ApiAuthError(401, 'Platform administrator authentication required.');
  if (perm && !ps.permissions.has(perm)) {
    throw new ApiAuthError(403, `Missing platform permission: ${perm}`);
  }
  return ps;
}

// ---------- Team / Tenant Plane Session Resolution ----------

async function buildTeamSessionForUser(
  user: User,
  hasActivePlatformSession: boolean,
  impersonation: ImpersonationContext | null
): Promise<Session> {
  const [roleOvs, userOvs, groupRows] = await Promise.all([
    q<{ permission_key: string; effect: 'allow' | 'deny' }>(
      'SELECT permission_key, effect FROM tenant_role_permissions WHERE tenant_id=? AND role=?',
      [user.tenant_id, user.role]
    ),
    q<{ permission_key: string; effect: 'allow' | 'deny' }>(
      'SELECT permission_key, effect FROM user_permission_overrides WHERE user_id=?',
      [user.id]
    ),
    q<{ group_id: string }>('SELECT group_id FROM user_group_scopes WHERE user_id=?', [user.id]),
  ]);

  return {
    tenantId: user.tenant_id,
    user,
    role: user.role,
    permissions: evaluateTeamPermissions(user.role, roleOvs, userOvs),
    groupScopes: groupRows.map(g => g.group_id),
    isPlatformAdmin: hasActivePlatformSession,
    impersonation,
  };
}

export async function getOptionalSession(): Promise<Session | null> {
  const jar = await cookies();
  const now = nowSql();
  const platSession = await getOptionalPlatformSession();

  // 1. Check active time-boxed Platform Support Impersonation first (requires valid Platform Session too)
  const rawImp = jar.get(IMPERSONATION_COOKIE)?.value;
  if (rawImp && rawImp.length >= 32 && platSession) {
    const impHash = sha256Hex(rawImp);
    const impRow = await one<any>(
      `SELECT pis.id AS imp_id, pis.reason, pis.expires_at,
              u.id, u.tenant_id, u.name, u.email, u.role, u.status, u.supervisor_id, u.is_platform_admin,
              t.status AS tenant_status
         FROM platform_impersonation_sessions pis
         JOIN users u ON u.id = pis.target_user_id
         JOIN tenants t ON t.id = pis.target_tenant_id
        WHERE pis.token_hash = ?
          AND pis.platform_user_id = ?
          AND pis.ended_at IS NULL
          AND pis.expires_at > ?
          AND u.status <> 'suspended'`,
      [impHash, platSession.platformUserId, now]
    );
    if (impRow) {
      const targetUser: User = {
        id: impRow.id,
        tenant_id: impRow.tenant_id,
        name: impRow.name,
        email: impRow.email,
        role: impRow.role,
        status: impRow.status,
        supervisor_id: impRow.supervisor_id,
        is_platform_admin: impRow.is_platform_admin,
      };
      return buildTeamSessionForUser(targetUser, true, {
        id: impRow.imp_id,
        platformUserId: platSession.platformUserId,
        platformName: platSession.user.name,
        platformEmail: platSession.user.email,
        reason: impRow.reason,
        expiresAt: impRow.expires_at,
      });
    }
  }

  // 2. Check standard Team Plane cryptographic session cookie
  const rawTeam = jar.get(TEAM_SESSION_COOKIE)?.value;
  if (!rawTeam || rawTeam.length < 32) return null;

  const teamHash = sha256Hex(rawTeam);
  const row = await one<User & { tenant_status: string }>(
    `SELECT u.id, u.tenant_id, u.name, u.email, u.role, u.status, u.supervisor_id, u.is_platform_admin,
            t.status AS tenant_status
       FROM user_sessions us
       JOIN users u ON u.id = us.user_id
       JOIN tenants t ON t.id = us.tenant_id
      WHERE us.token_hash = ?
        AND us.revoked_at IS NULL
        AND us.expires_at > ?
        AND u.status = 'active'
        AND t.status <> 'suspended'`,
    [teamHash, now]
  );
  if (!row) return null;

  return buildTeamSessionForUser(row, Boolean(platSession), null);
}

export async function getSession(): Promise<Session> {
  const s = await getOptionalSession();
  if (!s) {
    // Check if user only has a Platform Plane session — send them straight to /platform
    const ps = await getOptionalPlatformSession();
    if (ps) redirect('/platform');
    redirect('/login');
  }
  return s;
}

export async function requireApiSession(req?: Request, perm?: TeamPermission): Promise<Session> {
  if (req) {
    const csrf = verifySameOrigin(req);
    if (!csrf.ok) throw new ApiAuthError(403, csrf.error);
  }
  const s = await getOptionalSession();
  if (!s) throw new ApiAuthError(401, 'Authentication required. Please sign in.');
  if (perm && !s.permissions.has(perm)) {
    throw new ApiAuthError(403, `Forbidden: missing permission "${perm}".`);
  }
  return s;
}

// ---------- Member Client Portal Session Resolution ----------

export async function getOptionalPortalSession(): Promise<PortalSession | null> {
  const jar = await cookies();
  const raw = jar.get(PORTAL_SESSION_COOKIE)?.value;
  if (!raw || raw.length < 32) return null;

  const row = await one<any>(
    `SELECT ps.id AS session_id, ps.contact_id, ps.member_id, ps.tenant_id,
            mc.name AS contact_name, mc.email AS contact_email
       FROM portal_sessions ps
       JOIN member_contacts mc ON mc.id = ps.contact_id
      WHERE ps.token_hash = ?
        AND ps.revoked_at IS NULL
        AND ps.expires_at > ?`,
    [sha256Hex(raw), nowSql()]
  );
  if (!row) return null;
  return {
    sessionId: row.session_id,
    contactId: row.contact_id,
    memberId: row.member_id,
    tenantId: row.tenant_id,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
  };
}

// ---------- API Error Response Helper ----------

export function apiErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiAuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const msg = err instanceof Error ? err.message : 'Request failed.';
  if (msg.includes('does not belong to this workspace')) {
    return NextResponse.json({ error: msg }, { status: 403 });
  }
  return NextResponse.json({ error: msg }, { status: 400 });
}

// ---------- Capability Helpers (Backed by Evaluated ACL Matrix) ----------

export const can = {
  manageTeam: (s: Session) => s.permissions.has('team:users.manage'),
  manageAcl: (s: Session) => s.permissions.has('team:acl.manage'),
  manageBrand: (s: Session) => s.permissions.has('team:brand.manage'),
  manageTaxonomy: (s: Session) => s.permissions.has('team:taxonomy.manage'),
  spendMoney: (s: Session) => s.permissions.has('team:billing.manage') && s.role === 'owner',
  billJobs: (s: Session) => s.permissions.has('team:billing.manage'),
  inviteAdmin: (s: Session) => s.permissions.has('team:acl.manage') && (s.role === 'owner' || s.role === 'admin'),
  seeBilling: (s: Session) => s.permissions.has('team:billing.view'),
  createMember: (s: Session) => s.permissions.has('team:members.manage'),
  assignMembers: (s: Session) => s.permissions.has('team:members.assign'),
  editFormsAndRegs: (s: Session) => s.permissions.has('team:forms.tenant_manage'),
  manageSupplementalRegs: (s: Session) => s.permissions.has('team:regulations.supplemental_manage'),
  executeInspections: (s: Session) => s.permissions.has('team:inspections.execute'),
  reviseWording: (s: Session) => s.permissions.has('team:qc.approve'),
  approveTimesheets: (s: Session) => s.permissions.has('team:timesheets.approve'),
  shareReports: (s: Session) => s.permissions.has('team:reports.share'),
  platformAdmin: (s: Session) => s.isPlatformAdmin,
};
