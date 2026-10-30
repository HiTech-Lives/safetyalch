import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import TimesheetsManager from '@/components/TimesheetsManager';
import { getSession } from '@/lib/session';
import { listTimesheetsAndExpenses } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function TimesheetsOfficePage() {
  const s = await getSession();
  const { timesheets, expenses } = await listTimesheetsAndExpenses(s);

  return (
    <>
      <PageHeader
        title="Timesheets, Expenses & Billing CSV"
        subtitle="Review weekly consultant timesheets, policyholder signatures, and AI OCR receipts · Export Payroll CSV & Billing CSV"
      >
        <Link href="/field/jobs" className="btn">
          Open Mobile Timesheet &amp; Receipt Scanner →
        </Link>
      </PageHeader>
      <div className="content">
        <TimesheetsManager timesheets={timesheets} expenses={expenses} />
      </div>
    </>
  );
}

