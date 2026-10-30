import { PageHeader } from '@/components/ui';
import EngagementsManager from '@/components/EngagementsManager';
import { getSession } from '@/lib/session';
import { listEngagements, listSourcesAndReferrals, listMembers } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function EngagementsPage() {
  const s = await getSession();
  const [engagements, { sources, referrals }, members] = await Promise.all([
    listEngagements(s),
    listSourcesAndReferrals(s),
    listMembers(s),
  ]);

  return (
    <>
      <PageHeader
        title="Engagements & Program Budgets"
        subtitle="3-tier loss control hierarchy (Carrier/Captive → Broker/Program Manager → Policyholder) and annual draw-down service plans"
      />
      <div className="content">
        <EngagementsManager
          engagements={engagements}
          sources={sources}
          referrals={referrals}
          members={members}
        />
      </div>
    </>
  );
}

