import { q, one } from './db';
export * from './acl-catalog';

// ---------- Cross-Tenant Foreign-Key Ownership Assertions ----------

export async function assertMemberInTenant(tenantId: string, memberId: string | null | undefined): Promise<void> {
  if (!memberId) return;
  const row = await one<{ id: string }>('SELECT id FROM members WHERE id=? AND tenant_id=?', [memberId, tenantId]);
  if (!row) throw new Error('Referenced member does not belong to this workspace.');
}

export async function assertSiteInTenant(tenantId: string, siteId: string | null | undefined): Promise<{ id: string; member_id: string } | null> {
  if (!siteId) return null;
  const row = await one<{ id: string; member_id: string }>(
    'SELECT st.id, st.member_id FROM sites st JOIN members m ON m.id = st.member_id WHERE st.id=? AND m.tenant_id=?',
    [siteId, tenantId]
  );
  if (!row) throw new Error('Referenced site does not belong to this workspace.');
  return row;
}

export async function assertUserInTenant(tenantId: string, userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  const row = await one<{ id: string }>('SELECT id FROM users WHERE id=? AND tenant_id=? AND status <> "suspended"', [userId, tenantId]);
  if (!row) throw new Error('Referenced team member does not belong to this workspace.');
}

export async function assertUsersInTenant(tenantId: string, userIds: string[]): Promise<void> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (!unique.length) return;
  const rows = await q<{ id: string }>(
    `SELECT id FROM users WHERE tenant_id=? AND status <> 'suspended' AND id IN (${unique.map(() => '?').join(',')})`,
    [tenantId, ...unique]
  );
  if (rows.length !== unique.length) {
    throw new Error('One or more referenced users do not belong to this workspace.');
  }
}

export async function assertEngagementInTenant(tenantId: string, engagementId: string | null | undefined): Promise<void> {
  if (!engagementId) return;
  const row = await one<{ id: string }>('SELECT id FROM engagements WHERE id=? AND tenant_id=?', [engagementId, tenantId]);
  if (!row) throw new Error('Referenced engagement does not belong to this workspace.');
}
