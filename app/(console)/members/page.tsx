import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import MembersManager from '@/components/MembersManager';
import { getSession, can } from '@/lib/session';
import {
  listMembers,
  listFieldStaff,
  listTenantTaxonomy,
  listIndustryCatalog,
  listJurisdictionPortals,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const s = await getSession();
  const [members, fieldStaff, taxonomy, industries, portals] = await Promise.all([
    listMembers(s),
    listFieldStaff(s),
    listTenantTaxonomy(s.tenantId),
    listIndustryCatalog(s.tenantId),
    listJurisdictionPortals(),
  ]);
  const unassigned = members.filter(m => m.team.length === 0);
  const statePortals = portals.filter((p: any) => p.plan_type !== 'master_repo');

  return (
    <>
      <PageHeader
        title={`Members, ${taxonomy.groupLabel} & Sites`}
        subtitle={`${members.length} Members · Filter by ${taxonomy.groupLabel}, Shield Industry, Watch-List Tier & 56 Jurisdictions`}
      >
        {can.manageTaxonomy(s) && (
          <Link href="/settings/taxonomy" className="btn btn-sm">
            Customize {taxonomy.groupLabel} &amp; Hierarchy →
          </Link>
        )}
      </PageHeader>
      <div className="content">
        {unassigned.length > 0 && s.role !== 'supervisor' && (
          <div className="banner warn">
            {unassigned.length} Member{unassigned.length === 1 ? ' has' : 's have'} no Consultant assigned:{' '}
            {unassigned.map(m => m.name).join(', ')}. Consultants only see Members assigned to them, so these are
            invisible in the field.
          </div>
        )}
        <MembersManager
          members={members}
          fieldStaff={fieldStaff}
          taxonomy={taxonomy}
          industries={industries.filter((i: any) => !i.disabled_for_tenant)}
          portals={statePortals}
          canCreate={can.createMember(s)}
          canAssign={can.assignMembers(s)}
        />
      </div>
    </>
  );
}
