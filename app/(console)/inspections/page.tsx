import Link from 'next/link';
import { PageHeader, Pill, SearchForm } from '@/components/ui';
import { getSession } from '@/lib/session';
import { listInspections } from '@/lib/queries';
import { fmtShort, shortName } from '@/lib/format';

export default async function InspectionsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const s = await getSession();
  const rows = await listInspections(s, q);
  return (
    <>
      <PageHeader title="Inspections" subtitle="Submitted inspections are read only and kept for 7 years">
        <SearchForm defaultValue={q} />
        <Link href="/field" className="btn btn-primary btn-sm">+ Launch Field App</Link>
      </PageHeader>
      <div className="content">
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 860 }}>
            <thead><tr><th>Date</th><th>Member · site</th><th>Form</th><th>Consultant</th><th>Unsafe</th><th>Recs</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map(i => {
                const done = !!i.submitted_at, baseline = i.scale === 'maturity';
                const href = '/inspections/' + i.id;
                return (
                  <tr key={i.id} className="click">
                    <td><Link href={href} style={{ display: 'block', font: '600 11px var(--mono)', color: 'var(--ink)' }}>{fmtShort(i.started_at)}</Link></td>
                    <td><Link href={href} style={{ display: 'block', color: 'var(--ink)', fontWeight: 500 }}>{i.member}<span className="sub">{i.site} · {i.jurisdiction}</span></Link></td>
                    <td><Link href={href} style={{ display: 'block', color: 'var(--ink)' }}><span className="code" style={{ marginRight: 6 }}>{i.form_code}</span>{i.form_name}</Link></td>
                    <td><Link href={href} style={{ display: 'block', color: 'var(--ink)' }}>{shortName(i.consultant)}</Link></td>
                    <td className="num"><Link href={href} style={{ display: 'block', color: 'var(--ink)' }}>{done && !baseline ? i.unsafe : '—'}</Link></td>
                    <td className="num"><Link href={href} style={{ display: 'block', color: 'var(--ink)' }}>{done && !baseline ? i.recs : '—'}</Link></td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Link href={href}><Pill kind={done ? 'submitted' : 'in_progress'}>{done ? 'Submitted' : 'In progress'}</Pill></Link>
                        {!done && (
                          <Link href={'/field/' + i.id} className="btn btn-sm">Resume →</Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
