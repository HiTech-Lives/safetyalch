import { cookies } from 'next/headers';
import { one } from './db';

export type Role = 'owner' | 'admin' | 'supervisor' | 'consultant';
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
export type Session = { tenantId: string; user: User; role: Role; isPlatformAdmin: boolean };

const DEMO_USERS_BY_TENANT: Record<string, Record<string, string>> = {
  t1: { owner: 'u1', admin: 'u2', supervisor: 'u3', consultant: 'u4' },
  t2: { owner: 'u7', admin: 'u8', supervisor: 'u7', consultant: 'u9' },
};

export async function getSession(): Promise<Session> {
  const jar = await cookies();
  const explicitUserId = jar.get('sa_user_id')?.value;
  if (explicitUserId) {
    const u = await one<User>('SELECT * FROM users WHERE id=? AND status <> "suspended"', [explicitUserId]);
    if (u) {
      return {
        tenantId: u.tenant_id,
        user: u,
        role: u.role,
        isPlatformAdmin: Boolean(u.is_platform_admin) || process.env.DEMO_ROLE_SWITCH === 'true',
      };
    }
  }

  const tenantId = jar.get('demo_tenant')?.value ?? 't1';
  const role = jar.get('demo_role')?.value ?? 'owner';
  const tenantMap = DEMO_USERS_BY_TENANT[tenantId];
  const fallbackUserId = tenantMap ? (tenantMap[role] ?? tenantMap.owner) : null;

  let user: User | null = null;
  if (fallbackUserId) {
    user = await one<User>('SELECT * FROM users WHERE id=?', [fallbackUserId]);
  }
  if (!user) {
    // Dynamically find matching user in that tenant
    user = await one<User>(
      'SELECT * FROM users WHERE tenant_id=? AND status <> "suspended" ORDER BY FIELD(role, ?, "owner", "admin", "supervisor", "consultant") LIMIT 1',
      [tenantId, role]
    );
  }
  if (!user) {
    user = await one<User>('SELECT * FROM users WHERE id="u1"');
  }
  if (!user) throw new Error('Seed the database first: npm run db:seed');

  return {
    tenantId: user.tenant_id,
    user,
    role: user.role,
    isPlatformAdmin: Boolean(user.is_platform_admin) || process.env.DEMO_ROLE_SWITCH === 'true',
  };
}

export async function getOptionalSession(): Promise<Session | null> {
  try {
    return await getSession();
  } catch {
    return null;
  }
}

export const can = {
  manageTeam: (s: Session) => s.role === 'owner' || s.role === 'admin',
  manageBrand: (s: Session) => s.role === 'owner' || s.role === 'admin',
  spendMoney: (s: Session) => s.role === 'owner',
  inviteAdmin: (s: Session) => s.role === 'owner',
  seeBilling: (s: Session) => s.role === 'owner' || s.role === 'admin',
  createMember: (s: Session) => s.role === 'owner' || s.role === 'admin',
  assignMembers: (s: Session) => s.role === 'owner' || s.role === 'admin' || s.role === 'supervisor',
  editFormsAndRegs: (s: Session) => s.role === 'owner' || s.role === 'admin',
  reviseWording: (s: Session) => s.role === 'owner' || s.role === 'admin' || s.role === 'supervisor',
  platformAdmin: (s: Session) => s.isPlatformAdmin,
};
