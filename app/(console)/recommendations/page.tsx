import { PageHeader } from '@/components/ui';
import RecBoard from '@/components/RecBoard';
import { getSession } from '@/lib/session';
import { listRecs } from '@/lib/queries';
import { recState } from '@/lib/format';

export default async function RecommendationsPage({ searchParams }: { searchParams: Promise<{ tab?: string; open?: string; member?: string }> }) {
  const sp = await searchParams;
  const s = await getSession();
  const recs = (await listRecs(s)).map(r => ({ ...r, state: recState(r.status, r.due_on) }));
  return (
    <>
      <PageHeader title="Recommendations" subtitle="Every recommendation, tracked to Corrected or Risk Assumed" />
      <div className="content">
        <RecBoard recs={recs} initialTab={sp.tab ?? 'Open'} initialOpen={sp.open ?? null} initialMember={sp.member ?? null} />
        <p className="note">
          Priority sets the due date: High 7 days, Med 30, Low 60. Admins and Owners change status and add notes. A recommendation&apos;s wording belongs to the
          Consultant who wrote it; revisions are logged and print on both PDFs.
        </p>
      </div>
    </>
  );
}
