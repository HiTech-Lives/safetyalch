import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader, Frame, Pill } from '@/components/ui';
import ExportButtons from '@/components/ExportButtons';
import { getSession } from '@/lib/session';
import { getInspection } from '@/lib/queries';
import { fmtDate, fmtShort, recState, STATE_LABEL, PRIORITY_DAYS, MATURITY } from '@/lib/format';

export default async function InspectionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  const data = await getInspection(s, id);
  if (!data) notFound();
  const { insp, tallies, findings, maturity } = data;
  const locked = !insp.submitted_at;
  const baseline = insp.scale === 'maturity';
  const total = Number(insp.question_count);

  const cells = locked
    ? [['Questions', total], ['Status', 'In progress']]
    : baseline
      ? [['Items', total], ['Sections', maturity.length], ['N/A', tallies.na ?? 0], ['Due dates', 'None']]
      : [['Questions', total, 'var(--ink)'], ['Safe', tallies.safe ?? 0, 'var(--ok)'], ['Unsafe', tallies.unsafe ?? 0, 'var(--bad)'], ['N/A', tallies.na ?? 0, 'var(--n7)']];

  return (
    <>
      <PageHeader title={insp.id + ' · ' + insp.member} subtitle={insp.form_name + ' · ' + insp.site + ' · ' + insp.jurisdiction} />
      <div className="content">
        <Link href="/inspections" style={{ fontSize: 12.5 }}>← All inspections</Link>
        <div className="detail">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
            <div className="stats">
              {cells.map(([k, v, c]) => (
                <div key={String(k)} className="frame stat">
                  <div className="kicker">{k}</div>
                  <div className="v" style={{ fontSize: 26, color: c as string | undefined }}>{v}</div>
                </div>
              ))}
            </div>
            {locked && (
              <div className="banner dashed" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span>In progress on {insp.consultant}&apos;s device. An inspection is locked to one device until it is submitted; results appear here after sync.</span>
                <Link href={`/field/${insp.id}`} className="btn btn-primary btn-sm">Resume &amp; Submit in Field App →</Link>
              </div>
            )}
            {!locked && baseline && (
              <div className="frame strong">
                <div className="panel-head"><h2>Maturity profile</h2><span style={{ color: 'var(--n6)' }}>Absent · Written · Practiced · Owned. No due dates.</span></div>
                {maturity.map((m: any) => {
                  const lv = Math.round(Number(m.avg_level ?? 0));
                  return (
                    <div key={m.section_no} className="row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto 86px', gap: 14, alignItems: 'center', cursor: 'default' }}>
                      <span style={{ fontSize: 13 }}>{m.name}</span>
                      <span className={'maturity' + (lv === 3 ? ' owned' : '')}>{[0, 1, 2, 3].map(j => <span key={j} className={j <= lv ? 'on' : ''} />)}</span>
                      <span className="kicker" style={{ color: 'var(--ink)', textAlign: 'right' }}>{MATURITY[lv]}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {findings.length > 0 && (
              <div className="frame strong">
                <div className="panel-head"><h2>Findings</h2></div>
                {findings.map((f: any) => {
                  const st = recState(f.status, f.due_on);
                  return (
                    <Link key={f.id} href={'/recommendations?tab=All&open=' + f.id} className="row" style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '14px 18px' }}>
                      <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                        <span className="code">{f.id}</span>
                        <span className="kicker">Q {f.question_id} · {f.section_name}</span>
                        <span style={{ marginLeft: 'auto' }}><Pill kind={st}>{STATE_LABEL[st]}</Pill></span>
                      </span>
                      <span style={{ fontSize: 13.5, lineHeight: 1.45 }}>{f.text}</span>
                      {f.original_text && (
                        <span className="kicker" style={{ color: 'var(--n6)' }}>
                          Wording revised{f.revised_by_name ? ' by ' + f.revised_by_name : ''}{f.revised_at ? ' on ' + fmtDate(f.revised_at) : ''}. Original text on file.
                        </span>
                      )}
                      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <Pill kind="line">{f.reg_code ?? 'No citation mapped'}</Pill>
                        <span className="kicker" style={{ color: 'var(--n7)' }}>{f.priority} · {PRIORITY_DAYS[f.priority as keyof typeof PRIORITY_DAYS]}d · due {fmtShort(f.due_on)}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          <Frame>
            <div className="panel-head"><h2>Record</h2></div>
            <dl className="facts" style={{ margin: '4px 4px 10px' }}>
              {[
                ['Inspection', insp.id], ['Date', fmtDate(insp.started_at)], ['Consultant', insp.consultant], ['Member contact', insp.contact],
                ['Site', insp.site + ' · ' + insp.jurisdiction], ['Form', insp.form_code + ' · ' + insp.form_name + ' v' + insp.form_version],
                ['Status', locked ? 'In progress' : 'Submitted · immutable until ' + (Number(insp.started_at.slice(0, 4)) + 7)],
              ].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
            {!locked && <ExportButtons id={insp.id} baseline={baseline} />}
          </Frame>
        </div>
      </div>
    </>
  );
}
