'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Frame, Pill } from './ui';
import { fmtDate } from '@/lib/format';
import {
  PLATFORM_PERMISSION_LABELS,
  PLATFORM_ROLE_DEFAULTS,
  evaluatePlatformPermissions,
  type PlatformPermission,
  type PlatformRole,
} from '@/lib/acl-catalog';

const ROLE_TITLES: Record<PlatformRole, string> = {
  platform_super_admin: 'Platform Super-Admin',
  platform_ops_admin: 'Platform Ops Admin',
  platform_compliance_editor: 'Master Compliance Editor',
  platform_support_viewer: 'Platform Support Viewer',
};

const TEAM_ROLE_TITLES: Record<string, string> = {
  owner: 'Owner',
  admin: 'Team Admin',
  supervisor: 'Supervisor',
  consultant: 'Consultant',
  underwriting: 'Underwriting',
  viewer: 'Viewer',
};

export default function PlatformManager({
  tenants,
  activeTenantId,
  currentOperatorId,
  grantedPermissions,
  operators,
  allTenantUsers = [],
  globalIndustries,
  auditLog,
}: {
  tenants: any[];
  activeTenantId: string;
  currentOperatorId: string;
  grantedPermissions: string[];
  operators: any[];
  allTenantUsers?: any[];
  globalIndustries: any[];
  auditLog: any[];
}) {
  const router = useRouter();
  const perms = new Set(grantedPermissions);
  const [tab, setTab] = useState<'tenants' | 'operators' | 'directory' | 'industries' | 'audit'>('tenants');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [provisionSecretBanner, setProvisionSecretBanner] = useState<string | null>(null);

  // Edit tenant drawer
  const [selected, setSelected] = useState<any | null>(null);
  const [ePlan, setEPlan] = useState('professional');
  const [eStatus, setEStatus] = useState('active');
  const [eSeats, setESeats] = useState(4);
  const [eDomain, setEDomain] = useState('');
  const [eSenderVerified, setESenderVerified] = useState(false);

  // Provision tenant drawer
  const [creating, setCreating] = useState(false);
  const [cName, setCName] = useState('');
  const [cOwnerName, setCOwnerName] = useState('');
  const [cOwnerEmail, setCOwnerEmail] = useState('');
  const [cDomain, setCDomain] = useState('');
  const [cAccent, setCAccent] = useState('#1f4f6e');
  const [cPlan, setCPlan] = useState('professional');
  const [cPreset, setCPreset] = useState('standard_consultancy');
  const [cSeats, setCSeats] = useState(4);

  // Impersonation modal
  const [impTarget, setImpTarget] = useState<any | null>(null);
  const [impReason, setImpReason] = useState('');

  // Add Platform Operator + Least-Privilege Matrix state
  const [addingOp, setAddingOp] = useState(false);
  const [opName, setOpName] = useState('');
  const [opEmail, setOpEmail] = useState('');
  const [opRole, setOpRole] = useState<PlatformRole>('platform_support_viewer');
  const [opPassword, setOpPassword] = useState('');
  const [opCreateChecks, setOpCreateChecks] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const p of PLATFORM_PERMISSION_LABELS) {
      init[p.key] = PLATFORM_ROLE_DEFAULTS.platform_support_viewer.includes(p.key);
    }
    return init;
  });

  // Edit Platform Operator profile / password state
  const [editingOp, setEditingOp] = useState<any | null>(null);
  const [editOpName, setEditOpName] = useState('');
  const [editOpEmail, setEditOpEmail] = useState('');
  const [editOpRole, setEditOpRole] = useState<PlatformRole>('platform_ops_admin');
  const [editOpStatus, setEditOpStatus] = useState('active');
  const [editOpPassword, setEditOpPassword] = useState('');

  // Per-Operator Least-Privilege ACL Drawer state
  const [aclOperator, setAclOperator] = useState<any | null>(null);
  const [aclDraft, setAclDraft] = useState<Record<string, 'inherit' | 'allow' | 'deny'>>({});

  // Global Industry & Sub-sector builder (Add & Edit)
  const [industryModal, setIndustryModal] = useState<any | null>(null); // { id?: string }
  const [indCode, setIndCode] = useState('');
  const [indName, setIndName] = useState('');
  const [indBrand, setIndBrand] = useState('');
  const [indCore, setIndCore] = useState(false);
  const [indFed, setIndFed] = useState('');
  const [indStateNotes, setIndStateNotes] = useState('');
  const [indAlert, setIndAlert] = useState('');

  const [subModal, setSubModal] = useState<{ line: any; sub?: any } | null>(null);
  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');
  const [subDesc, setSubDesc] = useState('');

  // Cross-Tenant Identity Directory filters
  const [dirPlaneFilter, setDirPlaneFilter] = useState<'all' | 'dual' | 'platform_only' | 'team_only'>('all');
  const [dirTenantFilter, setDirTenantFilter] = useState<string>('all');
  const [dirQuery, setDirQuery] = useState('');

  // Attach User / Platform Admin to Team Workspace drawer
  const [attachModal, setAttachModal] = useState<{
    platformUserId?: string;
    lockIdentity?: boolean;
  } | null>(null);
  const [attName, setAttName] = useState('');
  const [attEmail, setAttEmail] = useState('');
  const [attTenantId, setAttTenantId] = useState('');
  const [attRole, setAttRole] = useState('admin');
  const [attComplimentary, setAttComplimentary] = useState(true);
  const [attPassword, setAttPassword] = useState('');

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3400);
  }

  function syncCreateChecksToRole(nextRole: PlatformRole) {
    setOpRole(nextRole);
    const defaults = new Set(PLATFORM_ROLE_DEFAULTS[nextRole] || []);
    const next: Record<string, boolean> = {};
    for (const p of PLATFORM_PERMISSION_LABELS) {
      next[p.key] = defaults.has(p.key);
    }
    setOpCreateChecks(next);
  }

  function openAddOperator() {
    setAddingOp(true);
    setOpName('');
    setOpEmail('');
    setOpPassword('');
    syncCreateChecksToRole('platform_support_viewer');
  }

  function openEditOperator(op: any) {
    setEditingOp(op);
    setEditOpName(op.name || '');
    setEditOpEmail(op.email || '');
    setEditOpRole(op.role as PlatformRole);
    setEditOpStatus(op.status || 'active');
    setEditOpPassword('');
  }

  function openTenant(t: any) {
    setSelected(t);
    setEPlan(t.plan || 'professional');
    setEStatus(t.status || 'active');
    setESeats(Number(t.seats_purchased) || 1);
    setEDomain(t.custom_domain || '');
    setESenderVerified(Boolean(t.email_sender_verified));
  }

  function openOperatorAcl(op: any) {
    setAclOperator(op);
    const map: Record<string, 'inherit' | 'allow' | 'deny'> = {};
    for (const p of PLATFORM_PERMISSION_LABELS) {
      const ov = (op.acl_overrides || []).find((x: any) => x.permission_key === p.key);
      map[p.key] = ov ? ov.effect : 'inherit';
    }
    setAclDraft(map);
  }

  function openIndustryDrawer(ind?: any) {
    if (ind) {
      setIndustryModal(ind);
      setIndCode(ind.code || '');
      setIndName(ind.name || '');
      setIndBrand(ind.shield_brand || '');
      setIndCore(Boolean(ind.is_core_shield));
      setIndFed(ind.federal_baseline || '');
      setIndStateNotes(ind.state_overlay_notes || '');
      setIndAlert(ind.special_rule_alert || '');
    } else {
      setIndustryModal({ id: null });
      setIndCode('');
      setIndName('');
      setIndBrand('');
      setIndCore(false);
      setIndFed('');
      setIndStateNotes('');
      setIndAlert('');
    }
  }

  function openSubsectorDrawer(line: any, sub?: any) {
    setSubModal({ line, sub });
    setSubCode(sub?.code || '');
    setSubName(sub?.name || '');
    setSubDesc(sub?.description || '');
  }

  async function saveTenant(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'update_tenant',
        tenantId: selected.id,
        plan: ePlan,
        status: eStatus,
        seatsPurchased: eSeats,
        customDomain: eDomain,
        emailSenderVerified: eSenderVerified,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setSelected(null);
      router.refresh();
    }
  }

  async function provisionTenant(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'provision_tenant',
        name: cName,
        ownerName: cOwnerName,
        ownerEmail: cOwnerEmail,
        customDomain: cDomain,
        accent: cAccent,
        plan: cPlan,
        groupPreset: cPreset,
        seatsPurchased: cSeats,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setCreating(false);
      if (body.setupTempPassword) {
        setProvisionSecretBanner(`Provisioned ${cName} (${body.tenantId}). One-Time Owner Password for ${cOwnerEmail}: ${body.setupTempPassword}`);
      }
      setCName('');
      setCOwnerName('');
      setCOwnerEmail('');
      setCDomain('');
      router.refresh();
    }
  }

  async function launchSupportSession(e: React.FormEvent) {
    e.preventDefault();
    if (!impTarget) return;
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'start_impersonation',
        tenantId: impTarget.id,
        reason: impReason,
      }),
    });
    const body = await res.json();
    setBusy(false);
    if (res.ok) {
      setImpTarget(null);
      setImpReason('');
      router.push(body.redirectTo || '/today');
      router.refresh();
    } else {
      notify(body.error);
    }
  }

  async function createOperator(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // Compute minimal explicit allow/deny overrides relative to opRole defaults
    const roleDefaults = new Set<string>(PLATFORM_ROLE_DEFAULTS[opRole] || []);
    const overrides: Record<string, 'allow' | 'deny' | 'inherit'> = {};
    for (const p of PLATFORM_PERMISSION_LABELS) {
      const want = Boolean(opCreateChecks[p.key]);
      const hasByRole = roleDefaults.has(p.key);
      if (want && !hasByRole) overrides[p.key] = 'allow';
      else if (!want && hasByRole) overrides[p.key] = 'deny';
      else overrides[p.key] = 'inherit';
    }

    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create_platform_user',
        name: opName,
        email: opEmail,
        role: opRole,
        password: opPassword || undefined,
        overrides,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      if (body.tempPassword) {
        setProvisionSecretBanner(`Created Platform Operator ${opEmail} — Temporary Password: ${body.tempPassword}`);
      }
      setAddingOp(false);
      setOpName('');
      setOpEmail('');
      setOpPassword('');
      router.refresh();
    }
  }

  async function submitEditOperator(e: React.FormEvent) {
    e.preventDefault();
    if (!editingOp) return;
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'update_platform_user',
        platformUserId: editingOp.id,
        name: editOpName,
        email: editOpEmail,
        role: editOpRole,
        status: editOpStatus,
        newPassword: editOpPassword || undefined,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setEditingOp(null);
      setEditOpPassword('');
      router.refresh();
    }
  }

  async function updateOperatorRoleStatus(platformUserId: string, role: string, status: string) {
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update_platform_user', platformUserId, role, status }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) router.refresh();
  }

  async function deleteOperator(op: any) {
    if (!window.confirm(`Remove Platform Operator "${op.name}" (${op.email}) from the SaaS Control Plane?`)) return;
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete_platform_user', platformUserId: op.id }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) router.refresh();
  }

  async function saveOperatorAcl(e: React.FormEvent) {
    e.preventDefault();
    if (!aclOperator) return;
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'set_platform_acl',
        platformUserId: aclOperator.id,
        overrides: aclDraft,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setAclOperator(null);
      router.refresh();
    }
  }

  async function saveGlobalIndustry(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'save_global_industry',
        id: industryModal?.id || undefined,
        code: indCode,
        name: indName,
        shieldBrand: indBrand,
        isCoreShield: indCore,
        federalBaseline: indFed,
        stateOverlayNotes: indStateNotes,
        specialRuleAlert: indAlert,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setIndustryModal(null);
      router.refresh();
    }
  }

  async function archiveGlobalIndustry(ind: any) {
    if (!window.confirm(`Archive Global Industry Line "${ind.name}" (${ind.code})?`)) return;
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete_global_industry', id: ind.id }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) router.refresh();
  }

  async function saveGlobalSubsector(e: React.FormEvent) {
    e.preventDefault();
    if (!subModal) return;
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'save_global_subsector',
        id: subModal.sub?.id || undefined,
        industryLineId: subModal.line.id,
        code: subCode,
        name: subName,
        description: subDesc,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setSubModal(null);
      router.refresh();
    }
  }

  async function archiveGlobalSubsector(sub: any) {
    if (!window.confirm(`Archive Sub-Sector "${sub.name}" (${sub.code})?`)) return;
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete_global_subsector', id: sub.id }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) router.refresh();
  }

  function openAttachDrawer(opts?: {
    platformUserId?: string;
    name?: string;
    email?: string;
    lockIdentity?: boolean;
  }) {
    const emailNorm = (opts?.email || '').trim().toLowerCase();
    const existingTenantIds = new Set(
      allTenantUsers
        .filter((u: any) => String(u.email).toLowerCase() === emailNorm)
        .map((u: any) => String(u.tenant_id))
    );
    const preferredTenant = tenants.find((t: any) => !existingTenantIds.has(String(t.id))) || tenants[0];
    setAttachModal({
      platformUserId: opts?.platformUserId,
      lockIdentity: Boolean(opts?.lockIdentity),
    });
    setAttName(opts?.name || '');
    setAttEmail(opts?.email || '');
    setAttTenantId(preferredTenant?.id || '');
    setAttRole('admin');
    setAttComplimentary(true);
    setAttPassword('');
  }

  async function submitAttachToTenant(e: React.FormEvent) {
    e.preventDefault();
    if (!attTenantId) return;
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'attach_user_to_tenant',
        platformUserId: attachModal?.platformUserId || undefined,
        name: attName,
        email: attEmail,
        tenantId: attTenantId,
        role: attRole,
        complimentary: attComplimentary,
        password: attPassword || undefined,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      if (body.tempPassword) {
        setProvisionSecretBanner(
          `Attached ${attEmail} to workspace — Temporary SSO Password: ${body.tempPassword}`
        );
      }
      setAttachModal(null);
      setAttPassword('');
      router.refresh();
    }
  }

  async function updateTenantMembership(
    userId: string,
    tenantId: string,
    patch: { role?: string; status?: string; complimentary?: boolean }
  ) {
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'update_tenant_membership',
        userId,
        tenantId,
        ...patch,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) router.refresh();
  }

  async function detachFromTenant(m: any) {
    if (!window.confirm(`Detach "${m.name}" (${m.email}) from workspace "${m.tenant_name || m.tenant_id}"?`)) return;
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'detach_user_from_tenant',
        userId: m.id,
        tenantId: m.tenant_id,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) router.refresh();
  }

  async function promoteToPlatform(identity: { name: string; email: string }) {
    if (
      !window.confirm(
        `Promote "${identity.name}" (${identity.email}) into the SaaS Platform Control Plane as a Least-Privilege Support Viewer? Their existing SSO password will carry over.`
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'promote_to_platform_user',
        name: identity.name,
        email: identity.email,
        role: 'platform_support_viewer',
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      if (body.tempPassword) {
        setProvisionSecretBanner(`Promoted ${identity.email} to Platform Operator — Temporary Password: ${body.tempPassword}`);
      }
      router.refresh();
    }
  }

  // Global Identity Directory (unifies Plane 1 platform_users + Plane 2 tenant users by email)
  const identities = useMemo(() => {
    const map = new Map<
      string,
      { key: string; name: string; email: string; platformOp: any | null; memberships: any[] }
    >();
    for (const op of operators) {
      const key = String(op.email || '').trim().toLowerCase();
      if (!key) continue;
      map.set(key, {
        key,
        name: op.name,
        email: op.email,
        platformOp: op,
        memberships: [],
      });
    }
    for (const tu of allTenantUsers) {
      const key = String(tu.email || '').trim().toLowerCase();
      if (!key) continue;
      const entry = map.get(key);
      if (entry) {
        entry.memberships.push(tu);
      } else {
        map.set(key, {
          key,
          name: tu.name,
          email: tu.email,
          platformOp: null,
          memberships: [tu],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const rank = (x: { platformOp: any; memberships: any[] }) =>
        x.platformOp && x.memberships.length > 0 ? 0 : x.platformOp ? 1 : 2;
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
      return String(a.name).localeCompare(String(b.name));
    });
  }, [operators, allTenantUsers]);

  const dualPlaneCount = useMemo(
    () => identities.filter(i => i.platformOp && i.memberships.length > 0).length,
    [identities]
  );
  const platOnlyCount = useMemo(
    () => identities.filter(i => i.platformOp && i.memberships.length === 0).length,
    [identities]
  );
  const teamOnlyCount = useMemo(
    () => identities.filter(i => !i.platformOp && i.memberships.length > 0).length,
    [identities]
  );

  const filteredIdentities = useMemo(() => {
    const qNorm = dirQuery.trim().toLowerCase();
    return identities.filter(i => {
      if (dirPlaneFilter === 'dual' && !(i.platformOp && i.memberships.length > 0)) return false;
      if (dirPlaneFilter === 'platform_only' && !(i.platformOp && i.memberships.length === 0)) return false;
      if (dirPlaneFilter === 'team_only' && !(!i.platformOp && i.memberships.length > 0)) return false;
      if (dirTenantFilter !== 'all' && !i.memberships.some(m => String(m.tenant_id) === dirTenantFilter)) {
        return false;
      }
      if (qNorm) {
        const hay = [
          i.name,
          i.email,
          i.platformOp?.role || '',
          ...i.memberships.map(m => `${m.tenant_name} ${m.tenant_id} ${m.role}`),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(qNorm)) return false;
      }
      return true;
    });
  }, [identities, dirPlaneFilter, dirTenantFilter, dirQuery]);

  // Grouped permissions for visual RBAC clarity
  const groupedPerms = useMemo(() => {
    const groups: Record<string, typeof PLATFORM_PERMISSION_LABELS> = {};
    for (const p of PLATFORM_PERMISSION_LABELS) {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    }
    return Object.entries(groups);
  }, []);

  // Compute live effective permissions in ACL drawer
  const aclDraftEffective = useMemo(() => {
    if (!aclOperator) return new Set<PlatformPermission>();
    const ovList = Object.entries(aclDraft)
      .filter(([, eff]) => eff === 'allow' || eff === 'deny')
      .map(([permission_key, effect]) => ({ permission_key, effect: effect as 'allow' | 'deny' }));
    return evaluatePlatformPermissions(aclOperator.role as PlatformRole, ovList);
  }, [aclOperator, aclDraft]);

  const createSelectedCount = Object.values(opCreateChecks).filter(Boolean).length;

  return (
    <>
      {provisionSecretBanner && (
        <div className="banner warn" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>{provisionSecretBanner}</span>
          <button className="btn btn-sm" onClick={() => setProvisionSecretBanner(null)}>Dismiss</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div className="tabs">
          <button className={'tab' + (tab === 'tenants' ? ' on' : '')} onClick={() => setTab('tenants')}>
            Tenants &amp; Support <span className="c">{tenants.length}</span>
          </button>
          <button className={'tab' + (tab === 'operators' ? ' on' : '')} onClick={() => setTab('operators')}>
            Platform Admins &amp; ACLs <span className="c">{operators.length}</span>
          </button>
          <button className={'tab' + (tab === 'directory' ? ' on' : '')} onClick={() => setTab('directory')}>
            All Users &amp; Memberships <span className="c">{identities.length}</span>
          </button>
          <button className={'tab' + (tab === 'industries' ? ' on' : '')} onClick={() => setTab('industries')}>
            Global Industries &amp; Shields <span className="c">{globalIndustries.length}</span>
          </button>
          {perms.has('platform:audit.view') && (
            <button className={'tab' + (tab === 'audit' ? ' on' : '')} onClick={() => setTab('audit')}>
              Platform Audit Log <span className="c">{auditLog.length}</span>
            </button>
          )}
        </div>

        {tab === 'tenants' && perms.has('platform:tenants.provision') && (
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
            + Provision New Workspace
          </button>
        )}
        {tab === 'operators' && perms.has('platform:users.manage') && (
          <button className="btn btn-primary btn-sm" onClick={openAddOperator}>
            + Add Least-Privilege Platform Operator
          </button>
        )}
        {tab === 'directory' && perms.has('platform:users.manage') && (
          <button className="btn btn-primary btn-sm" onClick={() => openAttachDrawer({ lockIdentity: false })}>
            + Attach / Add User to Workspace
          </button>
        )}
        {tab === 'industries' && perms.has('platform:industries.global_manage') && (
          <button className="btn btn-primary btn-sm" onClick={() => openIndustryDrawer()}>
            + Add Global Industry Line
          </button>
        )}
      </div>

      {/* TAB 1: TENANTS & SUPPORT IMPERSONATION */}
      {tab === 'tenants' && (
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 940 }}>
            <thead>
              <tr>
                <th>Workspace</th>
                <th>Group Terminology</th>
                <th>Domain &amp; Sender</th>
                <th>Plan</th>
                <th>Seats</th>
                <th>Members</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 14, height: 14, background: t.accent, display: 'inline-block', border: '1px solid var(--ink)' }} />
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {t.name} {t.id === activeTenantId && <Pill kind="acc">Active Workspace</Pill>}
                        </div>
                        <div className="sub">{t.id} · Created {fmtDate(t.created_at)}</div>
                      </div>
                    </div>
                  </td>
                  <td><Pill kind="line">{t.group_label || 'Portfolio Groups'}</Pill></td>
                  <td>
                    <div className="code">{t.custom_domain || '—'}</div>
                    <div className="sub">
                      {t.email_sender || 'Default SMTP'} {t.email_sender_verified ? '✓ Verified' : '(Unverified)'}
                    </div>
                  </td>
                  <td className="kicker" style={{ color: 'var(--ink)' }}>{t.plan || 'professional'}</td>
                  <td className="num">{t.paid_seats_used} / {t.seats_purchased}</td>
                  <td className="num">{t.member_count}</td>
                  <td>
                    <Pill kind={t.status === 'suspended' ? 'overdue' : 'verified'}>{t.status || 'active'}</Pill>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm" onClick={() => openTenant(t)}>Configure</button>
                      {perms.has('platform:impersonate') && (
                        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => setImpTarget(t)}>
                          60-Min Support Session →
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: PLATFORM OPERATORS & SEPARATED LEAST-PRIVILEGE PLATFORM ACL MATRIX */}
      {tab === 'operators' && (
        <Frame>
          <div className="panel-head">
            <h2>SaaS Platform Operators (`platform_users` — Isolated from Tenant `/team`)</h2>
            <span className="kicker">Least-Privilege RBAC · Attach to Any Team as Complimentary ($0)</span>
          </div>
          {!perms.has('platform:users.manage') && (
            <div className="banner dashed" style={{ margin: '12px 16px 0' }}>
              Read-only view: your current operator account does not hold <code>platform:users.manage</code>. Sign in as a Platform Super-Admin (<code>platform@safetyalchemist.com</code> or <code>dana@safetyalchemist.com</code>) to add operators or modify ACLs.
            </div>
          )}
          <div className="tbl-wrap" style={{ border: 'none' }}>
            <table className="tbl" style={{ minWidth: 1080 }}>
              <thead>
                <tr>
                  <th>Operator</th>
                  <th>Base Platform Role</th>
                  <th>Effective Privilege Posture &amp; Overrides</th>
                  <th>Attached Team Workspaces</th>
                  <th>Status</th>
                  <th>Manage User, Team Links &amp; ACL</th>
                </tr>
              </thead>
              <tbody>
                {operators.map(op => {
                  const effSet = evaluatePlatformPermissions(op.role as PlatformRole, op.acl_overrides || []);
                  const totalPerms = PLATFORM_PERMISSION_LABELS.length;
                  const isFullRoot = effSet.size === totalPerms;
                  const linked: any[] =
                    op.linked_memberships ||
                    allTenantUsers.filter(
                      (tu: any) => String(tu.email).toLowerCase() === String(op.email).toLowerCase()
                    );
                  return (
                    <tr key={op.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {op.name} {op.id === currentOperatorId && <Pill kind="acc">You</Pill>}
                        </div>
                        <div className="sub">{op.email}</div>
                      </td>
                      <td>
                        {perms.has('platform:users.manage') ? (
                          <select
                            className="select"
                            style={{ height: 32, fontSize: 12, width: 205 }}
                            value={op.role}
                            disabled={busy}
                            onChange={e => updateOperatorRoleStatus(op.id, e.target.value, op.status)}
                          >
                            <option value="platform_super_admin">Platform Super-Admin</option>
                            <option value="platform_ops_admin">Platform Ops Admin</option>
                            <option value="platform_compliance_editor">Master Compliance Editor</option>
                            <option value="platform_support_viewer">Platform Support Viewer</option>
                          </select>
                        ) : (
                          <Pill kind="ink">{ROLE_TITLES[op.role as PlatformRole] || op.role}</Pill>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Pill kind={isFullRoot ? 'ink' : 'verified'}>
                              {effSet.size} / {totalPerms} Effective {isFullRoot ? '(Full Root)' : '· Least-Privilege'}
                            </Pill>
                            {(op.acl_overrides || []).length === 0 && (
                              <span className="sub">Inheriting role defaults</span>
                            )}
                          </div>
                          {(op.acl_overrides || []).length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {op.acl_overrides.map((ov: any) => (
                                <Pill key={ov.permission_key} kind={ov.effect === 'allow' ? 'verified' : 'overdue'}>
                                  {ov.effect === 'allow' ? '+ ALLOW' : '✕ DENY'}: {ov.permission_key.replace('platform:', '')}
                                </Pill>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        {linked.length === 0 ? (
                          <span className="sub">Control Plane Only</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {linked.map((m: any) => {
                              const isFree =
                                Boolean(m.is_complimentary_seat) || m.role === 'admin' || m.role === 'viewer';
                              return (
                                <div
                                  key={`${m.tenant_id}:${m.id}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    flexWrap: 'wrap',
                                    padding: '3px 7px',
                                    border: '1px solid var(--div)',
                                    background: '#fff',
                                    fontSize: 11.5,
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 9,
                                      height: 9,
                                      background: m.tenant_accent || 'var(--ink)',
                                      display: 'inline-block',
                                    }}
                                  />
                                  <strong>{m.tenant_name}</strong>
                                  <span className="sub">· {TEAM_ROLE_TITLES[m.role] || m.role}</span>
                                  <Pill kind={isFree ? 'verified' : 'line'}>
                                    {m.is_complimentary_seat ? '$0 Complimentary' : isFree ? '$0 Free Role' : 'Paid Seat'}
                                  </Pill>
                                  {m.status === 'suspended' && <Pill kind="overdue">suspended</Pill>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td>
                        <Pill kind={op.status === 'active' ? 'verified' : 'overdue'}>{op.status}</Pill>
                      </td>
                      <td>
                        {perms.has('platform:users.manage') ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="btn btn-primary btn-sm" onClick={() => openOperatorAcl(op)}>
                              ACL ({effSet.size}/{totalPerms})
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() =>
                                openAttachDrawer({
                                  platformUserId: op.id,
                                  name: op.name,
                                  email: op.email,
                                  lockIdentity: true,
                                })
                              }
                            >
                              + Attach to Team
                            </button>
                            <button className="btn btn-sm" onClick={() => openEditOperator(op)}>
                              Edit / Password
                            </button>
                            {op.id !== currentOperatorId && (
                              <>
                                <button
                                  className="btn btn-sm"
                                  disabled={busy}
                                  onClick={() =>
                                    updateOperatorRoleStatus(op.id, op.role, op.status === 'active' ? 'suspended' : 'active')
                                  }
                                >
                                  {op.status === 'active' ? 'Suspend' : 'Reactivate'}
                                </button>
                                <button
                                  className="btn btn-sm"
                                  style={{ color: 'var(--bad)' }}
                                  disabled={busy}
                                  onClick={() => deleteOperator(op)}
                                >
                                  Remove
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="sub">Read-only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Frame>
      )}

      {/* TAB 2B: GLOBAL CROSS-TENANT IDENTITY & WORKSPACE DIRECTORY */}
      {tab === 'directory' && (
        <Frame>
          <div className="panel-head" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2>All Users &amp; Workspace Memberships (`platform_users` ∪ `users`)</h2>
              <div className="sub" style={{ marginTop: 2 }}>
                Every Platform Operator and Team User across all workspaces · Unified Email SSO · Complimentary Platform Seats consume 0 client seats.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                className="select"
                style={{ height: 32, fontSize: 12, width: 210 }}
                value={dirTenantFilter}
                onChange={e => setDirTenantFilter(e.target.value)}
              >
                <option value="all">All Workspaces ({tenants.length})</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.id})
                  </option>
                ))}
              </select>
              <input
                className="input"
                style={{ height: 32, fontSize: 12, width: 230 }}
                value={dirQuery}
                onChange={e => setDirQuery(e.target.value)}
                placeholder="Search name, email, workspace..."
              />
            </div>
          </div>

          <div
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--div)',
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              background: 'var(--bg)',
            }}
          >
            <button
              type="button"
              className={'btn btn-sm ' + (dirPlaneFilter === 'all' ? 'btn-primary' : '')}
              onClick={() => setDirPlaneFilter('all')}
            >
              All Identities ({identities.length})
            </button>
            <button
              type="button"
              className={'btn btn-sm ' + (dirPlaneFilter === 'dual' ? 'btn-primary' : '')}
              onClick={() => setDirPlaneFilter('dual')}
            >
              Dual-Plane: Platform + Team ({dualPlaneCount})
            </button>
            <button
              type="button"
              className={'btn btn-sm ' + (dirPlaneFilter === 'platform_only' ? 'btn-primary' : '')}
              onClick={() => setDirPlaneFilter('platform_only')}
            >
              Platform Plane Only ({platOnlyCount})
            </button>
            <button
              type="button"
              className={'btn btn-sm ' + (dirPlaneFilter === 'team_only' ? 'btn-primary' : '')}
              onClick={() => setDirPlaneFilter('team_only')}
            >
              Team Workspaces Only ({teamOnlyCount})
            </button>
          </div>

          <div className="tbl-wrap" style={{ border: 'none' }}>
            <table className="tbl" style={{ minWidth: 1040 }}>
              <thead>
                <tr>
                  <th>Person / SSO Email</th>
                  <th>Platform Control Plane (`platform_users`)</th>
                  <th>Attached Team Workspaces &amp; Seat Billing (`users`)</th>
                  <th>Cross-Workspace Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredIdentities.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 24 }} className="sub">
                      No users match the current filter.
                    </td>
                  </tr>
                )}
                {filteredIdentities.map(idn => {
                  const isDual = Boolean(idn.platformOp && idn.memberships.length > 0);
                  return (
                    <tr key={idn.key}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600 }}>{idn.name}</span>
                          {idn.platformOp?.id === currentOperatorId && <Pill kind="acc">You</Pill>}
                          {isDual && <Pill kind="ink">Dual-Plane SSO</Pill>}
                        </div>
                        <div className="sub">{idn.email}</div>
                      </td>

                      <td>
                        {idn.platformOp ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Pill kind="ink">
                              {ROLE_TITLES[idn.platformOp.role as PlatformRole] || idn.platformOp.role}
                            </Pill>
                            <Pill kind={idn.platformOp.status === 'active' ? 'verified' : 'overdue'}>
                              {idn.platformOp.status}
                            </Pill>
                            {perms.has('platform:users.manage') && (
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{ padding: '2px 7px', fontSize: 11 }}
                                onClick={() => openOperatorAcl(idn.platformOp)}
                              >
                                ACL
                              </button>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span className="sub">Workspace Only</span>
                            {perms.has('platform:users.manage') && (
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{ padding: '2px 8px', fontSize: 11 }}
                                disabled={busy}
                                onClick={() => promoteToPlatform({ name: idn.name, email: idn.email })}
                              >
                                + Promote to Platform
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      <td>
                        {idn.memberships.length === 0 ? (
                          <span className="sub">Not attached to any Team Workspace</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {idn.memberships.map((m: any) => {
                              const isComp = Boolean(m.is_complimentary_seat);
                              const isFreeRole = m.role === 'admin' || m.role === 'viewer';
                              return (
                                <div
                                  key={`${m.tenant_id}:${m.id}`}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 8,
                                    flexWrap: 'wrap',
                                    padding: '5px 8px',
                                    border: '1px solid var(--div)',
                                    background: m.status === 'suspended' ? 'var(--bg)' : '#fff',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                    <span
                                      style={{
                                        width: 10,
                                        height: 10,
                                        background: m.tenant_accent || 'var(--ink)',
                                        display: 'inline-block',
                                        border: '1px solid var(--ink)',
                                      }}
                                    />
                                    <strong style={{ fontSize: 12.5 }}>{m.tenant_name}</strong>
                                    <span className="mono sub">({m.tenant_id})</span>
                                    {m.status === 'suspended' && <Pill kind="overdue">suspended</Pill>}
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    {perms.has('platform:users.manage') ? (
                                      <>
                                        <select
                                          className="select"
                                          style={{ height: 27, fontSize: 11.5, width: 132, padding: '0 6px' }}
                                          value={m.role}
                                          disabled={busy}
                                          onChange={e =>
                                            updateTenantMembership(m.id, m.tenant_id, { role: e.target.value })
                                          }
                                        >
                                          <option value="owner">Owner</option>
                                          <option value="admin">Team Admin</option>
                                          <option value="supervisor">Supervisor</option>
                                          <option value="consultant">Consultant</option>
                                          <option value="underwriting">Underwriting</option>
                                          <option value="viewer">Viewer</option>
                                        </select>
                                        <button
                                          type="button"
                                          className="btn btn-sm"
                                          style={{ padding: '2px 7px', fontSize: 11 }}
                                          disabled={busy}
                                          title="Click to toggle between Complimentary ($0, 0 seats) and standard Client Seat billing"
                                          onClick={() =>
                                            updateTenantMembership(m.id, m.tenant_id, { complimentary: !isComp })
                                          }
                                        >
                                          {isComp
                                            ? '✓ $0 Complimentary'
                                            : isFreeRole
                                              ? '$0 Free Role'
                                              : 'Paid Client Seat'}
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-sm"
                                          style={{ padding: '2px 7px', fontSize: 11, color: 'var(--bad)' }}
                                          disabled={busy}
                                          title="Detach from this workspace"
                                          onClick={() => detachFromTenant(m)}
                                        >
                                          Detach
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <Pill kind="line">{TEAM_ROLE_TITLES[m.role] || m.role}</Pill>
                                        <Pill kind={isComp || isFreeRole ? 'verified' : 'line'}>
                                          {isComp ? '$0 Complimentary' : isFreeRole ? '$0 Free Role' : 'Paid Seat'}
                                        </Pill>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      <td>
                        {perms.has('platform:users.manage') ? (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() =>
                              openAttachDrawer({
                                platformUserId: idn.platformOp?.id,
                                name: idn.name,
                                email: idn.email,
                                lockIdentity: true,
                              })
                            }
                          >
                            + Attach to Workspace
                          </button>
                        ) : (
                          <span className="sub">Read-only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Frame>
      )}

      {/* TAB 3: GLOBAL 5 SHIELD + 7 SPECIALTY + EXTENSIBLE INDUSTRY BUILDER */}
      {tab === 'industries' && (
        <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
          {globalIndustries.map((ind: any) => (
            <Frame key={ind.id} className={ind.is_core_shield ? 'strong' : ''}>
              <div className="panel-head" style={{ gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div className="kicker">{ind.is_core_shield ? 'Core Shield Line' : 'Specialty Industry Line'} · {ind.code}</div>
                  <h3>{ind.shield_brand ? `${ind.shield_brand} — ${ind.name}` : ind.name}</h3>
                </div>
                {perms.has('platform:industries.global_manage') && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button className="btn btn-sm" onClick={() => openIndustryDrawer(ind)}>Edit</button>
                    <button className="btn btn-sm" onClick={() => openSubsectorDrawer(ind)}>+ Sub-Sector</button>
                    <button
                      className="btn btn-sm"
                      style={{ color: 'var(--bad)' }}
                      disabled={busy}
                      onClick={() => archiveGlobalIndustry(ind)}
                    >
                      Archive
                    </button>
                  </div>
                )}
              </div>
              <div className="panel-body" style={{ gap: 10 }}>
                {ind.federal_baseline && (
                  <div style={{ fontSize: 12 }}>
                    <strong>Federal Baseline:</strong> {ind.federal_baseline}
                  </div>
                )}
                {ind.state_overlay_notes && (
                  <div style={{ fontSize: 12, color: 'var(--n7)', lineHeight: 1.45 }}>
                    <strong>State Plan Overlays:</strong> {ind.state_overlay_notes}
                  </div>
                )}
                {ind.special_rule_alert && (
                  <div className="banner warn" style={{ padding: '8px 10px', fontSize: 11.5 }}>
                    {ind.special_rule_alert}
                  </div>
                )}
                <div>
                  <div className="kicker" style={{ marginBottom: 6 }}>Sub-Sectors ({(ind.subsectors || []).length})</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {(ind.subsectors || []).map((sub: any) => (
                      <span
                        key={sub.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          border: '1px solid var(--div)',
                          padding: '2px 7px',
                          fontSize: 11.5,
                          background: '#fff',
                        }}
                      >
                        <span
                          style={{ cursor: perms.has('platform:industries.global_manage') ? 'pointer' : 'default' }}
                          onClick={() => perms.has('platform:industries.global_manage') && openSubsectorDrawer(ind, sub)}
                          title={perms.has('platform:industries.global_manage') ? 'Click to edit sub-sector' : undefined}
                        >
                          <strong className="mono">{sub.code}</strong>: {sub.name.split('(')[0].trim()}
                        </span>
                        {perms.has('platform:industries.global_manage') && (
                          <button
                            type="button"
                            onClick={() => archiveGlobalSubsector(sub)}
                            title="Archive sub-sector"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--bad)',
                              cursor: 'pointer',
                              padding: '0 2px',
                              fontWeight: 700,
                            }}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Frame>
          ))}
        </div>
      )}

      {/* TAB 4: APPEND-ONLY PLATFORM AUDIT LOG */}
      {tab === 'audit' && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>UTC Timestamp</th>
                <th>Platform Operator</th>
                <th>Action</th>
                <th>Target Tenant</th>
                <th>Entity</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map(row => (
                <tr key={row.id}>
                  <td className="code">{row.at}</td>
                  <td>{row.actor_name || row.actor_platform_user_id || 'System'}</td>
                  <td><Pill kind="ink">{row.action}</Pill></td>
                  <td className="code">{row.target_tenant_id || '—'}</td>
                  <td className="code">{row.entity}:{row.entity_id}</td>
                  <td style={{ fontSize: 11.5, fontFamily: 'var(--mono)', maxWidth: 360, wordBreak: 'break-all' }}>
                    {typeof row.detail === 'string' ? row.detail : row.detail ? JSON.stringify(row.detail) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DRAWER: CONFIGURE TENANT */}
      {selected && (
        <>
          <div className="drawer-bg" onClick={() => setSelected(null)} />
          <aside className="drawer" role="dialog" aria-label="Configure Tenant">
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Tenant {selected.id}</div>
                <h2>{selected.name}</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setSelected(null)}>×</button>
            </div>
            <form onSubmit={saveTenant} className="drawer-body">
              <label className="field">
                <span>Subscription Plan</span>
                <select className="select" value={ePlan} onChange={e => setEPlan(e.target.value)}>
                  <option value="solo">Solo ($79 / seat)</option>
                  <option value="professional">Professional ($69 / seat)</option>
                  <option value="enterprise">Enterprise / Captive</option>
                </select>
              </label>
              <label className="field">
                <span>Purchased Licensed Seats (currently using {selected.paid_seats_used})</span>
                <input className="input" type="number" min={1} max={500} value={eSeats} onChange={e => setESeats(Number(e.target.value))} required />
              </label>
              <label className="field">
                <span>Custom White-Label Domain</span>
                <input className="input" value={eDomain} onChange={e => setEDomain(e.target.value)} placeholder="portal.consultancy.com" />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={eSenderVerified} onChange={e => setESenderVerified(e.target.checked)} />
                <span>SPF / DKIM Verified Outbound Email Sender ({selected.email_sender || 'none'})</span>
              </label>
              <label className="field">
                <span>Account Status</span>
                <select className="select" value={eStatus} onChange={e => setEStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="suspended">Suspended (Blocks All Logins)</option>
                </select>
              </label>
              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>Save Tenant</button>
                <button type="button" className="btn" onClick={() => setSelected(null)}>Cancel</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* DRAWER: PROVISION NEW TENANT */}
      {creating && (
        <>
          <div className="drawer-bg" onClick={() => setCreating(false)} />
          <aside className="drawer" role="dialog" aria-label="Provision Consultancy">
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Multi-Tenant Provisioning</div>
                <h2>Provision New Workspace</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setCreating(false)}>×</button>
            </div>
            <form onSubmit={provisionTenant} className="drawer-body">
              <label className="field">
                <span>Organization Name</span>
                <input className="input" value={cName} onChange={e => setCName(e.target.value)} required placeholder="Golden State EHS Advisors" />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="field">
                  <span>Primary Owner Name</span>
                  <input className="input" value={cOwnerName} onChange={e => setCOwnerName(e.target.value)} required placeholder="Elena Rostova" />
                </label>
                <label className="field">
                  <span>Primary Owner Email</span>
                  <input className="input" type="email" value={cOwnerEmail} onChange={e => setCOwnerEmail(e.target.value)} required placeholder="elena@goldenstateehs.com" />
                </label>
              </div>
              <label className="field">
                <span>Starter Portfolio Group Preset</span>
                <select className="select" value={cPreset} onChange={e => setCPreset(e.target.value)}>
                  <option value="standard_consultancy">Standard Consultancy (Captive, Carrier, Direct)</option>
                  <option value="breckpoint_sig_rsa">Breckpoint SIG &quot;Gems&quot; + RSA (CAN, CAP, CCN, CFM, CLP, CRMBC, RSA)</option>
                  <option value="blank">Blank — Custom Groups</option>
                </select>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
                <label className="field">
                  <span>Custom Domain</span>
                  <input className="input" value={cDomain} onChange={e => setCDomain(e.target.value)} placeholder="app.goldenstateehs.com" />
                </label>
                <label className="field">
                  <span>Brand Accent</span>
                  <input className="input" value={cAccent} onChange={e => setCAccent(e.target.value)} style={{ fontFamily: 'var(--mono)' }} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
                <label className="field">
                  <span>Plan</span>
                  <select className="select" value={cPlan} onChange={e => setCPlan(e.target.value)}>
                    <option value="solo">Solo</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </label>
                <label className="field">
                  <span>Paid Seats</span>
                  <input className="input" type="number" min={1} max={100} value={cSeats} onChange={e => setCSeats(Number(e.target.value))} />
                </label>
              </div>
              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>Provision Workspace</button>
                <button type="button" className="btn" onClick={() => setCreating(false)}>Cancel</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* DRAWER: 60-MIN AUDITED SUPPORT SESSION */}
      {impTarget && (
        <>
          <div className="drawer-bg" onClick={() => setImpTarget(null)} />
          <aside className="drawer" role="dialog" aria-label="Start Audited Support Session">
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Time-Boxed Support Access (60 Min Max)</div>
                <h2>Enter {impTarget.name}</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setImpTarget(null)}>×</button>
            </div>
            <form onSubmit={launchSupportSession} className="drawer-body">
              <div className="banner warn">
                Every action during a Support Session is stamped with your Platform Operator ID in both `platform_audit_log` and the tenant&apos;s `audit_log`. Session auto-expires in 60 minutes.
              </div>
              <label className="field">
                <span>Mandatory Support Ticket / Business Reason (min 10 chars)</span>
                <textarea
                  className="input"
                  rows={3}
                  minLength={10}
                  required
                  value={impReason}
                  onChange={e => setImpReason(e.target.value)}
                  placeholder="Ticket #4821 — Assisting Owner with custom Gem group & RCA form configuration."
                />
              </label>
              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy || impReason.trim().length < 10}>
                  Start 60-Minute Support Session →
                </button>
                <button type="button" className="btn" onClick={() => setImpTarget(null)}>Cancel</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* DRAWER: ADD PLATFORM OPERATOR WITH LEAST-PRIVILEGE MATRIX */}
      {addingOp && (
        <>
          <div className="drawer-bg" onClick={() => setAddingOp(false)} />
          <aside className="drawer" role="dialog" aria-label="Add Platform Operator" style={{ maxWidth: 620, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Plane 1 · Least-Privilege Platform Operator Provisioning</div>
                <h2>Create Platform Operator</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setAddingOp(false)}>×</button>
            </div>
            <form onSubmit={createOperator} className="drawer-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="field">
                  <span>Full Name</span>
                  <input className="input" value={opName} onChange={e => setOpName(e.target.value)} required placeholder="Samir Patel" />
                </label>
                <label className="field">
                  <span>Work Email</span>
                  <input className="input" type="email" value={opEmail} onChange={e => setOpEmail(e.target.value)} required placeholder="samir@safetyalchemist.com" />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="field">
                  <span>Base Role Template</span>
                  <select className="select" value={opRole} onChange={e => syncCreateChecksToRole(e.target.value as PlatformRole)}>
                    <option value="platform_support_viewer">Support Viewer (Recommended Least-Privilege Base)</option>
                    <option value="platform_compliance_editor">Master Compliance Editor (Forms, Regs, Industries)</option>
                    <option value="platform_ops_admin">Platform Ops Admin (Tenants &amp; Support)</option>
                    <option value="platform_super_admin">Platform Super-Admin (All 10 Permissions)</option>
                  </select>
                </label>
                <label className="field">
                  <span>Initial Password (min 10 chars, or blank to generate)</span>
                  <input className="input" type="password" minLength={10} value={opPassword} onChange={e => setOpPassword(e.target.value)} placeholder="Auto-generate secure password" />
                </label>
              </div>

              <div className="frame" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div className="kicker">Least-Privilege Permission Assignment</div>
                    <div style={{ fontSize: 12, color: 'var(--n6)' }}>
                      Check only the exact capabilities this operator needs ({createSelectedCount} of {PLATFORM_PERMISSION_LABELS.length} selected).
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        const none: Record<string, boolean> = {};
                        for (const p of PLATFORM_PERMISSION_LABELS) none[p.key] = false;
                        setOpRole('platform_support_viewer');
                        setOpCreateChecks(none);
                      }}
                    >
                      Zero Permissions (Start Blank)
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => syncCreateChecksToRole(opRole)}
                    >
                      Reset to Role Base
                    </button>
                  </div>
                </div>

                {groupedPerms.map(([grp, items]) => (
                  <div key={grp} style={{ borderTop: '1px solid var(--div2)', paddingTop: 8 }}>
                    <div className="kicker" style={{ marginBottom: 6 }}>{grp}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                      {items.map(p => (
                        <label
                          key={p.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            padding: '6px 8px',
                            background: opCreateChecks[p.key] ? 'var(--a1)' : '#fff',
                            border: '1px solid var(--div2)',
                            cursor: 'pointer',
                            fontSize: 12.5,
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={Boolean(opCreateChecks[p.key])}
                              onChange={e => setOpCreateChecks(prev => ({ ...prev, [p.key]: e.target.checked }))}
                            />
                            <span>
                              <strong>{p.label}</strong> <span className="mono sub">({p.key})</span>
                            </span>
                          </span>
                          <Pill kind={opCreateChecks[p.key] ? 'verified' : 'line'}>
                            {opCreateChecks[p.key] ? 'GRANT' : 'DENY'}
                          </Pill>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Create Operator ({createSelectedCount} Permissions)
                </button>
                <button type="button" className="btn" onClick={() => setAddingOp(false)}>Cancel</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* DRAWER: EDIT PLATFORM OPERATOR PROFILE / PASSWORD */}
      {editingOp && (
        <>
          <div className="drawer-bg" onClick={() => setEditingOp(null)} />
          <aside className="drawer" role="dialog" aria-label="Edit Platform Operator">
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Platform Operator Account · {editingOp.id}</div>
                <h2>Edit {editingOp.name}</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setEditingOp(null)}>×</button>
            </div>
            <form onSubmit={submitEditOperator} className="drawer-body">
              <label className="field">
                <span>Full Name</span>
                <input className="input" value={editOpName} onChange={e => setEditOpName(e.target.value)} required />
              </label>
              <label className="field">
                <span>Work Email</span>
                <input className="input" type="email" value={editOpEmail} onChange={e => setEditOpEmail(e.target.value)} required />
              </label>
              <label className="field">
                <span>Base Platform Role</span>
                <select className="select" value={editOpRole} onChange={e => setEditOpRole(e.target.value as PlatformRole)}>
                  <option value="platform_super_admin">Platform Super-Admin</option>
                  <option value="platform_ops_admin">Platform Ops Admin</option>
                  <option value="platform_compliance_editor">Master Compliance Editor</option>
                  <option value="platform_support_viewer">Platform Support Viewer</option>
                </select>
              </label>
              <label className="field">
                <span>Operator Status</span>
                <select
                  className="select"
                  value={editOpStatus}
                  disabled={editingOp.id === currentOperatorId}
                  onChange={e => setEditOpStatus(e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended (Revokes Active Sessions)</option>
                </select>
              </label>
              <label className="field">
                <span>Reset Password (Optional · min 10 characters)</span>
                <input
                  className="input"
                  type="password"
                  minLength={10}
                  value={editOpPassword}
                  onChange={e => setEditOpPassword(e.target.value)}
                  placeholder="Leave blank to keep existing password"
                />
              </label>
              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>Save Operator</button>
                <button type="button" className="btn" onClick={() => setEditingOp(null)}>Cancel</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* DRAWER: PER-OPERATOR LEAST-PRIVILEGE PLATFORM ACL MATRIX */}
      {aclOperator && (
        <>
          <div className="drawer-bg" onClick={() => setAclOperator(null)} />
          <aside className="drawer" role="dialog" aria-label="Platform Operator ACL Matrix" style={{ maxWidth: 660, width: '100%' }}>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Least-Privilege RBAC Matrix · {aclOperator.email}</div>
                <h2>{aclOperator.name}</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setAclOperator(null)}>×</button>
            </div>
            <form onSubmit={saveOperatorAcl} className="drawer-body">
              <div className="frame" style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    Effective Privileges: {aclDraftEffective.size} / {PLATFORM_PERMISSION_LABELS.length} Granted
                  </div>
                  <div className="sub">
                    Base Role: <strong>{ROLE_TITLES[aclOperator.role as PlatformRole] || aclOperator.role}</strong> · Explicit DENY always overrides ALLOW.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      const next: Record<string, 'inherit' | 'allow' | 'deny'> = {};
                      for (const p of PLATFORM_PERMISSION_LABELS) {
                        if (aclOperator.id === currentOperatorId && p.key === 'platform:users.manage') {
                          next[p.key] = 'allow';
                        } else {
                          next[p.key] = aclDraftEffective.has(p.key) ? 'allow' : 'deny';
                        }
                      }
                      setAclDraft(next);
                    }}
                  >
                    Pin Explicit Least-Privilege
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      const next: Record<string, 'inherit' | 'allow' | 'deny'> = {};
                      for (const p of PLATFORM_PERMISSION_LABELS) {
                        next[p.key] = aclOperator.id === currentOperatorId && p.key === 'platform:users.manage' ? 'allow' : 'deny';
                      }
                      setAclDraft(next);
                    }}
                  >
                    Deny All (Zero-Trust Start)
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      const next: Record<string, 'inherit' | 'allow' | 'deny'> = {};
                      for (const p of PLATFORM_PERMISSION_LABELS) next[p.key] = 'inherit';
                      setAclDraft(next);
                    }}
                  >
                    Reset to Role Defaults
                  </button>
                </div>
              </div>

              {groupedPerms.map(([grp, items]) => (
                <div key={grp} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="kicker" style={{ marginTop: 4 }}>{grp}</div>
                  {items.map(p => {
                    const roleHas = (PLATFORM_ROLE_DEFAULTS[aclOperator.role as PlatformRole] || []).includes(p.key);
                    const cur = aclDraft[p.key] || 'inherit';
                    const isGranted = aclDraftEffective.has(p.key);
                    const selfLockGuard = aclOperator.id === currentOperatorId && p.key === 'platform:users.manage';
                    return (
                      <div key={p.key} style={{ border: '1px solid var(--div)', background: '#fff', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 220 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Pill kind={isGranted ? 'verified' : 'overdue'}>{isGranted ? 'GRANTED' : 'BLOCKED'}</Pill>
                              <span style={{ fontWeight: 600, fontSize: 13 }}>{p.label}</span>
                            </div>
                            <div className="sub" style={{ marginTop: 2 }}>
                              <code>{p.key}</code> · Role Default: {roleHas ? 'Allowed' : 'Not Granted'}
                            </div>
                          </div>
                          <div style={{ display: 'inline-flex', gap: 4 }}>
                            {(['inherit', 'allow', 'deny'] as const).map(mode => (
                              <button
                                key={mode}
                                type="button"
                                disabled={selfLockGuard && mode === 'deny'}
                                onClick={() => setAclDraft(prev => ({ ...prev, [p.key]: mode }))}
                                className={'btn btn-sm ' + (cur === mode ? 'btn-primary' : '')}
                                style={{
                                  padding: '4px 9px',
                                  fontSize: 11.5,
                                  ...(cur === mode && mode === 'deny' ? { background: 'var(--bad)', borderColor: 'var(--bad)', color: '#fff' } : {}),
                                }}
                              >
                                {mode === 'inherit' ? `Inherit (${roleHas ? 'On' : 'Off'})` : mode === 'allow' ? '✓ Allow' : '✕ Deny'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>Save Platform ACL Overrides</button>
                <button type="button" className="btn" onClick={() => setAclOperator(null)}>Cancel</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* DRAWER: ADD / EDIT GLOBAL INDUSTRY LINE */}
      {industryModal && (
        <>
          <div className="drawer-bg" onClick={() => setIndustryModal(null)} />
          <aside className="drawer" role="dialog" aria-label="Global Industry Line">
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Global Industry Taxonomy</div>
                <h2>{industryModal.id ? `Edit ${industryModal.name}` : 'Add Industry / Shield Line'}</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setIndustryModal(null)}>×</button>
            </div>
            <form onSubmit={saveGlobalIndustry} className="drawer-body">
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 10 }}>
                <label className="field">
                  <span>Code</span>
                  <input
                    className="input mono"
                    value={indCode}
                    disabled={Boolean(industryModal.id)}
                    onChange={e => setIndCode(e.target.value.toUpperCase())}
                    required
                    placeholder="AVIATION"
                  />
                </label>
                <label className="field">
                  <span>Industry Line Name</span>
                  <input className="input" value={indName} onChange={e => setIndName(e.target.value)} required placeholder="Aviation, Hangar & Ground Support" />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
                <label className="field">
                  <span>Shield Brand Label (Optional)</span>
                  <input className="input" value={indBrand} onChange={e => setIndBrand(e.target.value)} placeholder="AeroShield" />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, fontSize: 12.5 }}>
                  <input type="checkbox" checked={indCore} onChange={e => setIndCore(e.target.checked)} />
                  Core Shield Line
                </label>
              </div>
              <label className="field">
                <span>Federal Baseline Standards</span>
                <input className="input" value={indFed} onChange={e => setIndFed(e.target.value)} placeholder="29 CFR Part 1910 & FAA Ground Safety" />
              </label>
              <label className="field">
                <span>State Plan Overlay Notes</span>
                <textarea className="input" rows={3} value={indStateNotes} onChange={e => setIndStateNotes(e.target.value)} placeholder="Cal/OSHA Title 8 & WA DOSH state-specific triggers..." />
              </label>
              <label className="field">
                <span>Special Regulatory / Rider Alert (Optional)</span>
                <input className="input" value={indAlert} onChange={e => setIndAlert(e.target.value)} />
              </label>
              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>Save Global Industry</button>
                <button type="button" className="btn" onClick={() => setIndustryModal(null)}>Cancel</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* DRAWER: ADD / EDIT SUB-SECTOR ON GLOBAL INDUSTRY */}
      {subModal && (
        <>
          <div className="drawer-bg" onClick={() => setSubModal(null)} />
          <aside className="drawer" role="dialog" aria-label="Global Sub-Sector">
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">{subModal.line.shield_brand || subModal.line.name}</div>
                <h2>{subModal.sub ? `Edit ${subModal.sub.name}` : 'Add Global Sub-Sector'}</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setSubModal(null)}>×</button>
            </div>
            <form onSubmit={saveGlobalSubsector} className="drawer-body">
              <label className="field">
                <span>Sub-Sector Code</span>
                <input
                  className="input mono"
                  value={subCode}
                  disabled={Boolean(subModal.sub)}
                  onChange={e => setSubCode(e.target.value.toUpperCase())}
                  required
                  placeholder={`${subModal.line.code}-SPECIALTY`}
                />
              </label>
              <label className="field">
                <span>Sub-Sector Name</span>
                <input className="input" value={subName} onChange={e => setSubName(e.target.value)} required placeholder="Cold Chain & Automated Fulfillment" />
              </label>
              <label className="field">
                <span>Operational Hazards &amp; Focus Description</span>
                <textarea className="input" rows={3} value={subDesc} onChange={e => setSubDesc(e.target.value)} />
              </label>
              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {subModal.sub ? 'Save Sub-Sector' : 'Add Sub-Sector'}
                </button>
                <button type="button" className="btn" onClick={() => setSubModal(null)}>Cancel</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {/* DRAWER: ATTACH PLATFORM OPERATOR OR USER TO TEAM WORKSPACE */}
      {attachModal && (() => {
        const emailNorm = attEmail.trim().toLowerCase();
        const existingLinks = emailNorm
          ? allTenantUsers.filter((u: any) => String(u.email).toLowerCase() === emailNorm)
          : [];
        const hasKnownIdentity = Boolean(
          emailNorm &&
            (operators.some((op: any) => String(op.email).toLowerCase() === emailNorm) || existingLinks.length > 0)
        );
        return (
          <>
            <div className="drawer-bg" onClick={() => setAttachModal(null)} />
            <aside className="drawer" role="dialog" aria-label="Attach User to Team Workspace" style={{ maxWidth: 580, width: '100%' }}>
              <div className="drawer-head">
                <div style={{ flex: 1 }}>
                  <div className="kicker">Cross-Plane Identity &amp; Workspace Membership</div>
                  <h2>{attachModal.lockIdentity ? `Manage Team Links · ${attName}` : 'Attach / Add User to Workspace'}</h2>
                </div>
                <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setAttachModal(null)}>×</button>
              </div>
              <form onSubmit={submitAttachToTenant} className="drawer-body">
                {existingLinks.length > 0 && (
                  <div className="frame" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="kicker">Currently Attached Team Workspaces ({existingLinks.length})</div>
                    {existingLinks.map((m: any) => {
                      const isComp = Boolean(m.is_complimentary_seat);
                      const isFreeRole = m.role === 'admin' || m.role === 'viewer';
                      return (
                        <div
                          key={`${m.tenant_id}:${m.id}`}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                            padding: '6px 8px',
                            border: '1px solid var(--div)',
                            background: '#fff',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                background: m.tenant_accent || 'var(--ink)',
                                display: 'inline-block',
                              }}
                            />
                            <strong style={{ fontSize: 12.5 }}>{m.tenant_name}</strong>
                            {m.status === 'suspended' && <Pill kind="overdue">suspended</Pill>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <select
                              className="select"
                              style={{ height: 28, fontSize: 11.5, width: 132 }}
                              value={m.role}
                              disabled={busy}
                              onChange={e => updateTenantMembership(m.id, m.tenant_id, { role: e.target.value })}
                            >
                              <option value="owner">Owner</option>
                              <option value="admin">Team Admin</option>
                              <option value="supervisor">Supervisor</option>
                              <option value="consultant">Consultant</option>
                              <option value="underwriting">Underwriting</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{ padding: '2px 7px', fontSize: 11 }}
                              disabled={busy}
                              onClick={() => updateTenantMembership(m.id, m.tenant_id, { complimentary: !isComp })}
                            >
                              {isComp ? '✓ $0 Complimentary' : isFreeRole ? '$0 Free Role' : 'Paid Seat'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{ padding: '2px 7px', fontSize: 11, color: 'var(--bad)' }}
                              disabled={busy}
                              onClick={() => detachFromTenant(m)}
                            >
                              Detach
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label className="field">
                    <span>Full Name</span>
                    <input
                      className="input"
                      value={attName}
                      disabled={Boolean(attachModal.lockIdentity)}
                      onChange={e => setAttName(e.target.value)}
                      required
                      placeholder="Dana Mercer"
                    />
                  </label>
                  <label className="field">
                    <span>Work Email (Unified SSO Key)</span>
                    <input
                      className="input"
                      type="email"
                      value={attEmail}
                      disabled={Boolean(attachModal.lockIdentity)}
                      onChange={e => setAttEmail(e.target.value)}
                      required
                      placeholder="dana@safetyalchemist.com"
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label className="field">
                    <span>Target Team Workspace</span>
                    <select
                      className="select"
                      value={attTenantId}
                      onChange={e => setAttTenantId(e.target.value)}
                      required
                    >
                      {tenants.map((t: any) => {
                        const already = existingLinks.some((m: any) => String(m.tenant_id) === String(t.id));
                        return (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.id}){already ? ' — Already Attached (Update)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  <label className="field">
                    <span>Workspace Team Role</span>
                    <select className="select" value={attRole} onChange={e => setAttRole(e.target.value)}>
                      <option value="admin">Team Admin (Recommended)</option>
                      <option value="consultant">Field Consultant</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="underwriting">Underwriting</option>
                      <option value="viewer">Read-Only Viewer</option>
                      <option value="owner">Workspace Owner (Max 2 / Tenant)</option>
                    </select>
                  </label>
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    border: '1px solid var(--ink)',
                    background: attComplimentary ? 'var(--a1)' : '#fff',
                    cursor: 'pointer',
                    fontSize: 12.5,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={attComplimentary}
                    onChange={e => setAttComplimentary(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      Flag as Complimentary Platform-Attached Seat ($0 · 0 Client Seats Consumed)
                    </div>
                    <div className="sub" style={{ marginTop: 2 }}>
                      When enabled, attaching this user as Consultant, Supervisor, Underwriting, or Owner will NOT consume any of the client&apos;s purchased seats (`is_complimentary_seat = 1`).
                    </div>
                  </div>
                </label>

                {hasKnownIdentity ? (
                  <div className="banner dashed" style={{ fontSize: 12 }}>
                    Unified SSO active: existing password for <code>{attEmail}</code> carries over automatically. They can switch directly into this workspace from the left sidebar switcher without logging in again.
                  </div>
                ) : (
                  <label className="field">
                    <span>Initial Password (Optional · min 10 chars, or leave blank to auto-generate)</span>
                    <input
                      className="input"
                      type="password"
                      minLength={10}
                      value={attPassword}
                      onChange={e => setAttPassword(e.target.value)}
                      placeholder="Auto-generate secure temporary password"
                    />
                  </label>
                )}

                <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                  <button type="submit" className="btn btn-primary" disabled={busy || !attTenantId}>
                    Attach to Workspace
                  </button>
                  <button type="button" className="btn" onClick={() => setAttachModal(null)}>Close</button>
                </div>
              </form>
            </aside>
          </>
        );
      })()}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
