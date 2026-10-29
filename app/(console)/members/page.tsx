import { PageHeader } from '@/components/ui';
import MembersManager from '@/components/MembersManager';
import { getSession, can } from '@/lib/session';
import { listMembers, listFieldStaff } from '@/lib/queries';

export default async function MembersPage() {
  const s = await getSession();
  const [members, fieldStaff] = await Promise.all([listMembers(s), listFieldStaff(s)]);
  const unassigned = members.filter(m => m.team.length === 0);
  return (
    <>
      <PageHeader title="Members & sites" subtitle={members.length + ' Members · jurisdiction follows each site'} />
      <div className="content">
        {unassigned.length > 0 && s.role !== 'supervisor' && (
          <div className="banner warn">
            {unassigned.length} Member{unassigned.length === 1 ? ' has' : 's have'} no Consultant assigned: {unassigned.map(m => m.name).join(', ')}. Consultants only see
            Members assigned to them, so these are invisible in the field.
          </div>
        )}
        <MembersManager
          members={members}
          fieldStaff={fieldStaff}
          canCreate={can.createMember(s)}
          canAssign={can.assignMembers(s)}
        />
      </div>
    </>
  );
}
