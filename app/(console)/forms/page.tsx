import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import CloneFormDrawer from '@/components/CloneFormDrawer';
import FormsCatalogManager from '@/components/FormsCatalogManager';
import { getOptionalSession, getOptionalPlatformSession, can } from '@/lib/session';
import { listForms, listBookRecommendations, listIndustryCatalog, listRegs } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function FormsPage() {
  const [s, ps] = await Promise.all([getOptionalSession(), getOptionalPlatformSession()]);
  if (!s && !ps) redirect('/login?next=/forms');

  const canMaster = Boolean(ps?.permissions.has('platform:forms.master_manage'));
  const canTenant = Boolean(s && can.editFormsAndRegs(s));

  const [forms, bookRecs, industries, regs] = await Promise.all([
    listForms(s?.tenantId, { includeArchived: canMaster || canTenant }),
    listBookRecommendations(s?.tenantId ?? null),
    listIndustryCatalog(s?.tenantId ?? null),
    listRegs(s?.tenantId ?? null),
  ]);

  const activeForms = forms.filter((f: any) => !f.is_archived);
  const totalQuestions = activeForms.reduce((a: number, f: any) => a + Number(f.n), 0);

  return (
    <>
      <PageHeader
        title="Forms, Written Policies & Book of Recommendations"
        subtitle={`${activeForms.length} active templates · ${totalQuestions} items · ${bookRecs.length} standardized Book of Recommendations entries`}
      >
        {(canMaster || canTenant) && (
          <CloneFormDrawer
            forms={activeForms}
            canMaster={canMaster}
            canTenant={canTenant}
            hasTeamWorkspace={Boolean(s)}
          />
        )}
      </PageHeader>
      <div className="content">
        <FormsCatalogManager
          forms={forms}
          bookRecommendations={bookRecs}
          industries={industries.filter((i: any) => !i.disabled_for_tenant)}
          regs={regs}
          canMaster={canMaster}
          canTenant={canTenant}
          hasTeamWorkspace={Boolean(s)}
        />
      </div>
    </>
  );
}
