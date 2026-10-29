import { PageHeader } from '@/components/ui';
import ScheduleManager from '@/components/ScheduleManager';
import { getSession } from '@/lib/session';
import { listVisits, listMembers, listForms, listFieldStaff } from '@/lib/queries';

export default async function SchedulePage() {
  const s = await getSession();
  const [visits, members, forms, fieldStaff] = await Promise.all([
    listVisits(s),
    listMembers(s),
    listForms(),
    listFieldStaff(s),
  ]);
  return (
    <>
      <PageHeader title="Schedule" subtitle="Assigned and self-scheduled visits · click any visit to assign or edit" />
      <div className="content">
        <ScheduleManager
          visits={visits}
          members={members}
          forms={forms}
          fieldStaff={fieldStaff}
          currentUserId={s.user.id}
          role={s.role}
        />
      </div>
    </>
  );
}
