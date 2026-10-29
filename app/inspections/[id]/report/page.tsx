import { notFound } from 'next/navigation';
import { Pill } from '@/components/ui';
import PrintReportBar from '@/components/PrintReportBar';
import { getInspectionReportData } from '@/lib/queries';
import { guardAccent } from '@/lib/color';
import { fmtDate, fmtShort, recState, STATE_LABEL, PRIORITY_DAYS, MATURITY } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function InspectionReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const data = await getInspectionReportData(id);
  if (!data) notFound();

  const { insp, tenant, tallies, sections, answers, findings, maturity } = data;
  const baseline = insp.scale === 'maturity';
  const type = sp.type || (baseline ? 'development' : 'full');
  const accent = tenant?.brand_scopes?.reports ? guardAccent(tenant.accent) : '#4b2454';
  const logoSrc = tenant?.logo_key || '/brand/logo.png';
  const retentionYear = Number(String(insp.started_at).slice(0, 4)) + 7;

  return (
    <div style={{ minHeight: '100vh', background: '#fff', color: 'var(--ink)', ['--acc' as string]: accent }}>
      <style>{`@media print { .no-print { display: none !important; } body { background: #fff !important; } }`}</style>
      <PrintReportBar id={insp.id} type={type} baseline={baseline} />

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '36px 28px 64px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* White-Labeled Report Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingBottom: 16, borderBottom: '3px solid var(--acc)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src={logoSrc} alt={tenant.name} style={{ height: 42 }} />
            <div>
              <div style={{ font: '700 22px/1.1 var(--fh)', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--a7)' }}>
                {tenant.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--n6)' }}>{tenant.custom_domain || tenant.email_sender || 'Occupational Safety & Compliance Report'}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="pill" style={{ background: 'var(--acc)', fontSize: 10.5, padding: '4px 10px' }}>
              {type === 'development' ? '12-Month Development Plan' : type === 'recommendations' ? 'Recommendation Report' : 'Full Inspection Report'}
            </span>
            <div className="kicker" style={{ marginTop: 6 }}>
              Record {insp.id} · Form {insp.form_code} v{insp.form_version}
            </div>
          </div>
        </header>

        {/* Inspection Metadata Block */}
        <dl className="frame facts" style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <div><dt>Member</dt><dd><strong>{insp.member}</strong> ({insp.member_city || insp.industry})</dd></div>
          <div><dt>Inspection Date</dt><dd>{fmtDate(insp.started_at)}</dd></div>
          <div><dt>Site &amp; Jurisdiction</dt><dd>{insp.site} · <strong>{insp.jurisdiction}</strong></dd></div>
          <div><dt>Lead Consultant</dt><dd>{insp.consultant}</dd></div>
          <div><dt>Template</dt><dd>{insp.form_code} · {insp.form_name}</dd></div>
          <div><dt>Primary Contact</dt><dd>{insp.contact || '—'} ({insp.contact_email || '—'})</dd></div>
          <div><dt>Record Status</dt><dd>{insp.submitted_at ? `Submitted · Immutable through ${retentionYear}` : 'In Progress Draft'}</dd></div>
          <div><dt>Total Items</dt><dd>{insp.question_count} questions ({tallies.safe ?? 0} Safe · {tallies.unsafe ?? 0} Unsafe · {tallies.na ?? 0} N/A)</dd></div>
        </dl>

        {/* BSA Maturity Profile & 12-Month Development Plan */}
        {baseline && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="frame strong">
              <div className="panel-head">
                <h2>Baseline Safety Maturity Profile</h2>
                <span className="kicker">0 Absent · 1 Written · 2 Practiced · 3 Owned (No punitive due dates)</span>
              </div>
              {maturity.map((m: any) => {
                const lv = Math.round(Number(m.avg_level ?? 0));
                return (
                  <div key={m.section_no} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto 90px', gap: 14, alignItems: 'center', padding: '11px 18px', borderTop: '1px solid var(--div2)' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>{m.section_no}. {m.name}</span>
                    <span className={'maturity' + (lv === 3 ? ' owned' : '')}>{[0, 1, 2, 3].map(j => <span key={j} className={j <= lv ? 'on' : ''} />)}</span>
                    <span className="kicker" style={{ color: 'var(--ink)', textAlign: 'right' }}>{MATURITY[lv]}</span>
                  </div>
                );
              })}
            </div>

            <div className="frame">
              <div className="panel-head">
                <h2>12-Month Phased Development Roadmap</h2>
                <span className="kicker">Prioritized by current maturity level</span>
              </div>
              {answers.filter((a: any) => a.value === 'absent' || a.value === 'written').map((a: any) => (
                <div key={a.question_id} style={{ padding: '12px 18px', borderTop: '1px solid var(--div2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="code">Q {a.question_id} · {a.question_key}</span>
                    <Pill kind={a.value === 'absent' ? 'unassigned' : 'acc'}>
                      {a.value === 'absent' ? 'Months 1–3 (Foundation: Absent → Written)' : 'Months 4–9 (Execution: Written → Practiced)'}
                    </Pill>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{a.question_text}</div>
                  {a.recommendation && <div style={{ fontSize: 12.5, color: 'var(--n7)' }}><strong>Recommended Next Step:</strong> {a.recommendation}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Findings & Citations Section */}
        {!baseline && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ margin: 0, font: '700 18px var(--fh)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
              Findings &amp; Regulatory Citations ({findings.length})
            </h2>
            {findings.length === 0 && (
              <div className="frame" style={{ padding: 18, fontSize: 13.5, color: 'var(--ok)' }}>
                No Unsafe findings were recorded during this inspection.
              </div>
            )}
            {findings.map((f: any) => {
              const st = recState(f.status, f.due_on);
              return (
                <div key={f.id} className="frame" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8, pageBreakInside: 'avoid' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <span className="code">{f.id}</span>
                    <span className="kicker">Q {f.q_label} · {f.section_name}</span>
                    {!!f.is_repeat && <Pill kind="overdue">Repeat Finding</Pill>}
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <Pill kind="ink">{f.priority} · {PRIORITY_DAYS[f.priority as keyof typeof PRIORITY_DAYS]}d · Due {fmtShort(f.due_on)}</Pill>
                      <Pill kind={st}>{STATE_LABEL[st]}</Pill>
                    </span>
                  </div>
                  <div style={{ fontSize: 14.5, lineHeight: 1.5, fontWeight: 500 }}>{f.text}</div>
                  {f.original_text && (
                    <div className="kicker" style={{ color: 'var(--n6)' }}>
                      Wording revised{f.revised_by_name ? ' by ' + f.revised_by_name : ''}{f.revised_at ? ' on ' + fmtDate(f.revised_at) : ''}. Original consultant wording retained on file.
                    </div>
                  )}
                  {f.reg_code && (
                    <div style={{ marginTop: 4, padding: '10px 12px', background: 'var(--bg)', borderLeft: '3px solid var(--acc)', fontSize: 12.5, lineHeight: 1.5 }}>
                      <div style={{ fontWeight: 600 }}>
                        {f.reg_code} · {f.reg_title} ({f.reg_agency})
                        {f.reg_verified_on ? ` · Verified ${fmtDate(f.reg_verified_on)}` : ' · Summary (unverified)'}
                      </div>
                      <div style={{ marginTop: 4, color: 'var(--n7)' }}>{f.reg_verbatim || f.reg_summary}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* Full Question-by-Question Checklist (only on type=full) */}
        {type === 'full' && !baseline && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ margin: 0, font: '700 18px var(--fh)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
              Complete Inspection Checklist ({answers.length} Questions)
            </h2>
            {sections.map((sec: any) => {
              const secAnswers = answers.filter((a: any) => a.section_no === sec.section_no);
              return (
                <div key={sec.section_no} className="frame" style={{ pageBreakInside: 'avoid' }}>
                  <div className="panel-head">
                    <h2>Section {sec.section_no} · {sec.name}</h2>
                    <span className="kicker">{secAnswers.length} items</span>
                  </div>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>Item</th>
                        <th>Question</th>
                        <th style={{ width: 120 }}>Measurement</th>
                        <th style={{ width: 95 }}>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secAnswers.map((a: any) => (
                        <tr key={a.question_id}>
                          <td className="code">{a.question_id}</td>
                          <td>
                            <div>{a.question_text}</div>
                            {a.na_reason && <div className="sub">N/A reason: {a.na_reason}</div>}
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {a.measured_value !== null && a.measured_value !== undefined
                              ? `${a.measured_value} ${a.measure_unit || ''}`
                              : a.threshold !== null
                                ? `Req: ${a.comparison === 'min' ? '≥' : '≤'} ${Number(a.threshold)} ${a.measure_unit || ''}`
                                : '—'}
                          </td>
                          <td>
                            {a.value === 'safe' && <Pill kind="verified">Safe</Pill>}
                            {a.value === 'unsafe' && <Pill kind="overdue">Unsafe</Pill>}
                            {a.value === 'na' && <Pill kind="line">N/A</Pill>}
                            {!a.value && <span className="kicker">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </section>
        )}

        {/* Legal & Retention Disclaimer Footer */}
        <footer style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--ink)', fontSize: 11.5, lineHeight: 1.55, color: 'var(--n6)' }}>
          <strong>Advisory &amp; 7-Year Immutability Notice:</strong> This report reflects conditions observed at {insp.site} on {fmtDate(insp.started_at)} by {tenant.name}. Regulatory citations are mapped to {insp.jurisdiction} standards (with Federal OSHA fallback where applicable). Upon submission, inspection answers and verified citations are cryptographically and database-locked for 7 years ({retentionYear}). Responsibility for workplace safety and hazard abatement remains solely with the employer ({insp.member}).
        </footer>
      </div>
    </div>
  );
}

