import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import TaxonomyManager from '@/components/TaxonomyManager';
import { getSession, can } from '@/lib/session';
import { listTenantTaxonomy, listIndustryCatalog, listMembers } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function TaxonomySettingsPage() {
  const s = await getSession();
  if (!can.manageTaxonomy(s)) redirect('/today');

  const [taxonomy, industries, members] = await Promise.all([
    listTenantTaxonomy(s.tenantId),
    listIndustryCatalog(s.tenantId),
    listMembers(s),
  ]);

  return (
    <>
      <PageHeader
        title="Groups, Industries & Company Hierarchy"
        subtitle="Customize portfolio group terminology ('Gems', 'Programs', 'Captives', 'Client Portfolios'), industry lines, sub-sectors, and parent/subsidiary corporate links for your workspace"
      />
      <div className="content">
        <TaxonomyManager taxonomy={taxonomy} industries={industries} members={members} />
      </div>
    </>
  );
}

