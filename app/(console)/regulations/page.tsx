import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import RegTable from '@/components/RegTable';
import { getOptionalSession, getOptionalPlatformSession, can } from '@/lib/session';
import { listRegs, listJurisdictionPortals, listIndustryCatalog } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function RegulationsPage() {
  const [s, ps] = await Promise.all([getOptionalSession(), getOptionalPlatformSession()]);
  if (!s && !ps) redirect('/login?next=/regulations');

  const [regs, portals, industries] = await Promise.all([
    listRegs(s?.tenantId ?? null),
    listJurisdictionPortals(),
    listIndustryCatalog(s?.tenantId ?? null),
  ]);

  const canGlobal = Boolean(ps?.permissions.has('platform:regulations.global_manage'));
  const canSupplemental = Boolean(s && (can.manageSupplementalRegs(s) || can.editFormsAndRegs(s)));

  return (
    <>
      <PageHeader
        title="56-Jurisdiction Regulation Engine & Citations"
        subtitle="Real-time retrievable statutory portals across all 50 States, D.C. & 5 Territories, Shield Industry overlays, and 7-year immutable citation library"
      />
      <div className="content">
        <RegTable
          regs={regs}
          portals={portals}
          industries={industries}
          canGlobal={canGlobal}
          canSupplemental={canSupplemental}
          hasTeamWorkspace={Boolean(s)}
        />
        <p className="note">
          Entries are never edited in place once verified. A regulatory change creates a new entry and marks the prior
          clause superseded, preserving exact verbatim text on historical inspection reports across the full 7-year
          retention period.
        </p>
      </div>
    </>
  );
}
