// Browser-safe Dual-Plane ACL Matrix definitions (Platform Plane & Team/Tenant Plane).
// Contains zero Node.js or database imports so client components can safely render permission matrices.

// ============================================================================
// PLANE 1: PLATFORM ADMIN ACL MATRIX (SaaS Control Plane — /platform)
// ============================================================================

export type PlatformRole =
  | 'platform_super_admin'
  | 'platform_ops_admin'
  | 'platform_compliance_editor'
  | 'platform_support_viewer';

export type PlatformPermission =
  | 'platform:tenants.view'
  | 'platform:tenants.provision'
  | 'platform:tenants.billing'
  | 'platform:tenants.suspend'
  | 'platform:impersonate'
  | 'platform:users.manage'
  | 'platform:forms.master_manage'
  | 'platform:regulations.global_manage'
  | 'platform:industries.global_manage'
  | 'platform:audit.view';

export const PLATFORM_PERMISSION_LABELS: { key: PlatformPermission; label: string; group: string }[] = [
  { key: 'platform:tenants.view', label: 'View Tenants & Usage Metrics', group: 'Tenants' },
  { key: 'platform:tenants.provision', label: 'Provision New Tenants', group: 'Tenants' },
  { key: 'platform:tenants.billing', label: 'Edit Tenant Seats & Plans', group: 'Tenants' },
  { key: 'platform:tenants.suspend', label: 'Suspend / Reactivate Tenants', group: 'Tenants' },
  { key: 'platform:impersonate', label: 'Start Audited 60-Min Support Session', group: 'Support' },
  { key: 'platform:users.manage', label: 'Manage Platform Operators & ACLs', group: 'Security' },
  { key: 'platform:forms.master_manage', label: 'Create/Edit Master Forms, Policies & SHR-* Items', group: 'Compliance' },
  { key: 'platform:regulations.global_manage', label: 'Manage Global Regulations & 56 Jurisdictions', group: 'Compliance' },
  { key: 'platform:industries.global_manage', label: 'Manage Global Shield & Specialty Industries', group: 'Compliance' },
  { key: 'platform:audit.view', label: 'View Platform Security Audit Log', group: 'Security' },
];

export const PLATFORM_ROLE_DEFAULTS: Record<PlatformRole, PlatformPermission[]> = {
  platform_super_admin: PLATFORM_PERMISSION_LABELS.map(p => p.key),
  platform_ops_admin: [
    'platform:tenants.view',
    'platform:tenants.provision',
    'platform:tenants.billing',
    'platform:tenants.suspend',
    'platform:impersonate',
    'platform:industries.global_manage',
    'platform:audit.view',
  ],
  platform_compliance_editor: [
    'platform:tenants.view',
    'platform:forms.master_manage',
    'platform:regulations.global_manage',
    'platform:industries.global_manage',
  ],
  platform_support_viewer: [
    'platform:tenants.view',
    'platform:audit.view',
  ],
};

export function evaluatePlatformPermissions(
  role: PlatformRole,
  overrides: { permission_key: string; effect: 'allow' | 'deny' }[]
): Set<PlatformPermission> {
  const granted = new Set<PlatformPermission>(PLATFORM_ROLE_DEFAULTS[role] || []);
  for (const ov of overrides) {
    if (ov.effect === 'allow') granted.add(ov.permission_key as PlatformPermission);
  }
  for (const ov of overrides) {
    if (ov.effect === 'deny') granted.delete(ov.permission_key as PlatformPermission);
  }
  return granted;
}

// ============================================================================
// PLANE 2: TEAM / TENANT ACL MATRIX (Workspace Plane — /team & Console)
// ============================================================================

export type TeamRole = 'owner' | 'admin' | 'supervisor' | 'consultant' | 'underwriting' | 'viewer';

export type TeamPermission =
  | 'team:users.manage'
  | 'team:acl.manage'
  | 'team:billing.manage'
  | 'team:billing.view'
  | 'team:brand.manage'
  | 'team:taxonomy.manage'
  | 'team:members.manage'
  | 'team:members.assign'
  | 'team:forms.tenant_manage'
  | 'team:regulations.supplemental_manage'
  | 'team:inspections.execute'
  | 'team:qc.approve'
  | 'team:timesheets.approve'
  | 'team:reports.share';

export const TEAM_PERMISSION_LABELS: { key: TeamPermission; label: string; group: string }[] = [
  { key: 'team:users.manage', label: 'Invite, Suspend & Assign Team Users', group: 'Team & Security' },
  { key: 'team:acl.manage', label: 'Configure Per-User ACL Checkboxes & Admin Roles', group: 'Team & Security' },
  { key: 'team:billing.manage', label: 'Purchase Seats & Mark Jobs Billed', group: 'Billing & Programs' },
  { key: 'team:billing.view', label: 'View Engagements, Budgets & Billing', group: 'Billing & Programs' },
  { key: 'team:brand.manage', label: 'Manage Branding, Domain & Cloud AI Keys', group: 'Settings' },
  { key: 'team:taxonomy.manage', label: 'Customize Groups ("Gems"), Industries & Hierarchy', group: 'Settings' },
  { key: 'team:members.manage', label: 'Create/Edit Members, Sites & Watch-List Flags', group: 'Operations' },
  { key: 'team:members.assign', label: 'Assign Consultants, Visits, Jobs & Certs', group: 'Operations' },
  { key: 'team:forms.tenant_manage', label: 'Create/Edit Tenant Forms, Policies & Book of Recs', group: 'Compliance' },
  { key: 'team:regulations.supplemental_manage', label: 'Add Tenant Supplemental Citations & Verify Sources', group: 'Compliance' },
  { key: 'team:inspections.execute', label: 'Execute Field Inspections, Capture & Quick Reports', group: 'Field' },
  { key: 'team:qc.approve', label: 'QC Review, Revise Wording & Release Reports', group: 'Field' },
  { key: 'team:timesheets.approve', label: 'Approve / Send Back Crew Timesheets & Expenses', group: 'Billing & Programs' },
  { key: 'team:reports.share', label: 'Generate Expiring External Broker/Carrier Share Links', group: 'Operations' },
];

export const TEAM_ROLE_DEFAULTS: Record<TeamRole, TeamPermission[]> = {
  owner: TEAM_PERMISSION_LABELS.map(p => p.key),
  admin: [
    'team:users.manage',
    'team:acl.manage',
    'team:billing.manage',
    'team:billing.view',
    'team:brand.manage',
    'team:taxonomy.manage',
    'team:members.manage',
    'team:members.assign',
    'team:forms.tenant_manage',
    'team:regulations.supplemental_manage',
    'team:inspections.execute',
    'team:qc.approve',
    'team:timesheets.approve',
    'team:reports.share',
  ],
  supervisor: [
    'team:members.manage',
    'team:members.assign',
    'team:inspections.execute',
    'team:qc.approve',
    'team:timesheets.approve',
    'team:reports.share',
  ],
  consultant: [
    'team:inspections.execute',
  ],
  underwriting: [
    'team:billing.view',
    'team:reports.share',
  ],
  viewer: [],
};

export function evaluateTeamPermissions(
  role: TeamRole,
  roleOverrides: { permission_key: string; effect: 'allow' | 'deny' }[],
  userOverrides: { permission_key: string; effect: 'allow' | 'deny' }[]
): Set<TeamPermission> {
  const granted = new Set<TeamPermission>(TEAM_ROLE_DEFAULTS[role] || []);
  for (const ro of roleOverrides) {
    if (ro.effect === 'allow') granted.add(ro.permission_key as TeamPermission);
    if (ro.effect === 'deny') granted.delete(ro.permission_key as TeamPermission);
  }
  for (const uo of userOverrides) {
    if (uo.effect === 'allow') granted.add(uo.permission_key as TeamPermission);
  }
  for (const uo of userOverrides) {
    if (uo.effect === 'deny') {
      if (role === 'owner' && uo.permission_key === 'team:acl.manage') continue;
      granted.delete(uo.permission_key as TeamPermission);
    }
  }
  return granted;
}

