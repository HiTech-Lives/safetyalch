import { PageHeader } from '@/components/ui';
import RegTable from '@/components/RegTable';
import { getSession, can } from '@/lib/session';
import { listRegs } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function RegulationsPage() {
  const [s, regs] = await Promise.all([getSession(), listRegs()]);
  return (
    <>
      <PageHeader title="Regulation library" subtitle="Cited by jurisdiction and topic" />
      <div className="content">
        <RegTable regs={regs} canEdit={can.editFormsAndRegs(s)} />
        <p className="note">
          Entries are never edited in place once verified. A change creates a new entry and marks the old one superseded, so every citation in a submitted report
          still points at the exact text that was printed for the full 7-year retention period.
        </p>
      </div>
    </>
  );
}
