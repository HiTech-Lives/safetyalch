import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader, SearchForm } from '@/components/ui';
import FormSectionView from '@/components/FormSectionView';
import { getSession, can } from '@/lib/session';
import { getForm } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function FormDetail({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ s?: string; q?: string }> }) {
  const { code } = await params;
  const sp = await searchParams;
  const [s, data] = await Promise.all([
    getSession(),
    getForm(code.toUpperCase(), sp.s ? Number(sp.s) : undefined),
  ]);
  if (!data) notFound();
  const { form, sections, current, questions, total } = data;
  const needle = (sp.q ?? '').toLowerCase();
  const shown = questions.filter((x: any) => !needle || (x.question_text + ' ' + (x.recommendation ?? '')).toLowerCase().includes(needle));
  const canEdit = can.editFormsAndRegs(s);

  return (
    <>
      <PageHeader title={form.code + ' · ' + form.name} subtitle={form.industry + ' · ' + total + ' questions · v' + form.version + (canEdit ? ' · click any question to edit' : '')}>
        <SearchForm defaultValue={sp.q} keep={{ s: current.section_no }} />
      </PageHeader>
      <div className="content">
        <Link href="/forms" style={{ fontSize: 12.5 }}>← All forms</Link>
        <div className="split">
          <div className="frame" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'thin' }}>
            <div className="kicker" style={{ padding: '11px 16px', borderBottom: '1px solid var(--div)' }}>Sections</div>
            {sections.map((x: any) => {
              const on = x.section_no === current.section_no;
              return (
                <Link key={x.section_no} href={'/forms/' + form.code + '?s=' + x.section_no} className="row"
                  style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, borderLeft: '4px solid ' + (on ? 'var(--acc)' : 'transparent'), background: on ? 'var(--a1)' : '#fff' }}>
                  <span className="kicker" style={{ width: 20 }}>{x.section_no}</span>
                  <span style={{ flex: 1, lineHeight: 1.3 }}>{x.name}</span>
                  <span className="kicker">{x.n}</span>
                </Link>
              );
            })}
          </div>
          <FormSectionView form={form} current={current} questions={shown} canEdit={canEdit} />
        </div>
      </div>
    </>
  );
}
