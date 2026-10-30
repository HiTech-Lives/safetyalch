import { PageHeader } from '@/components/ui';
import AssignmentsManager from '@/components/AssignmentsManager';
import { getSession } from '@/lib/session';
import { listStaffWithCertifications, listWorkJobs } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function AssignmentsPage() {
  const s = await getSession();
  const [data, allJobs] = await Promise.all([
    listStaffWithCertifications(s),
    listWorkJobs(s),
  ]);

  return (
    <>
      <PageHeader
        title="Assignments & Qualification Staffing"
        subtitle="Who is qualified, free, and whose certifications last the whole job (CSP · CIH · ALCM · ARM · OSHA 500/510)"
      />
      <div className="content">
        <AssignmentsManager
          staff={data.staff}
          unassignedJobs={data.unassignedJobs}
          unassignedVisits={data.unassignedVisits}
          allCerts={data.allCerts}
          allJobs={allJobs}
        />
      </div>
    </>
  );
}

