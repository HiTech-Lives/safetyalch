import { PageHeader } from '@/components/ui';
import WorkQueueManager from '@/components/WorkQueueManager';
import { getSession } from '@/lib/session';
import {
  listWorkJobs,
  listEngagements,
  listSourcesAndReferrals,
  listMembers,
  listFieldStaff,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function WorkQueuePage() {
  const s = await getSession();
  const [jobs, engagements, { sources }, members, staff] = await Promise.all([
    listWorkJobs(s),
    listEngagements(s),
    listSourcesAndReferrals(s),
    listMembers(s),
    listFieldStaff(s),
  ]);

  return (
    <>
      <PageHeader
        title="Work Queue"
        subtitle="Every assignment from the day it comes in to the day it is billed · AI Email Intake · QC · 1-Click Billing"
      />
      <div className="content">
        <WorkQueueManager
          jobs={jobs}
          engagements={engagements}
          sources={sources}
          members={members}
          staff={staff}
        />
      </div>
    </>
  );
}

