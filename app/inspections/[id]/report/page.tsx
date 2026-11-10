import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pill } from '@/components/ui';
import PrintReportBar from '@/components/PrintReportBar';
import { getInspectionReportData, canActOn } from '@/lib/queries';
import { one, q, nowSql } from '@/lib/db';
import { sha256Hex } from '@/lib/security';
import {
  getOptionalSession,
  getOptionalPlatformSession,
  getOptionalPortalSession,
  can,
} from '@/lib/session';
import { guardAccent } from '@/lib/color';
import { fmtDate, fmtShort, recState, STATE_LABEL, PRIORITY_DAYS, MATURITY } from '@/lib/format';

export const dynamic = 'force-dynamic';

const AUTO_RATING_LABELS: Record<string, string> = {
  score_1: '1 — Excellent',
  score_2: '2 — Good',
  score_3: '3 — Satisfactory',
  score_4: '4 — Marginal',
  score_5: '5 — Poor / Unacceptable',
  na: 'N/A',
};

export default async function InspectionReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string; type?: string; share?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const data = await getInspectionReportData(id);
  if (!data) notFound();

  const { insp, tenant, tallies, sections, answers, findings, photos, maturity } = data;

  // ---------- 4-Way Report Auth Gate (v0.0.3 S4 Security Remediation) ----------
  const [teamSess, platSess, portalSess] = await Promise.all([
    getOptionalSession(),
    getOptionalPlatformSession(),
    getOptionalPortalSession(),
  ]);

  let authorized = false;
  let validShareToken: string | null = null;

  if (
    teamSess &&
    teamSess.tenantId === insp.tenant_id &&
    (await canActOn(teamSess, insp.consultant_id)) &&
    (!teamSess.groupScopes.length || (insp.group_id && teamSess.groupScopes.includes(insp.group_id)))
  ) {
    authorized = true;
  } else if (platSess && platSess.permissions.has('platform:tenants.view')) {
    authorized = true;
  } else if (
    portalSess &&
    portalSess.memberId === insp.member_id &&
    portalSess.tenantId === insp.tenant_id
  ) {
    authorized = true;
  } else if (sp.share && sp.share.length >= 24) {
    const shareRow = await one<{ id: string; report_mode: string }>(
      `SELECT id, report_mode
         FROM report_share_links
        WHERE token_hash = ?
          AND entity_type = 'inspection'
          AND entity_id = ?
          AND tenant_id = ?
          AND revoked_at IS NULL
          AND expires_at > ?`,
      [sha256Hex(sp.share), insp.id, insp.tenant_id, nowSql()]
    );
    if (shareRow) {
      authorized = true;
      validShareToken = sp.share;
      await q(
        'UPDATE report_share_links SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?',
        [nowSql(), shareRow.id]
      );
    }
  }

  if (!authorized) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="frame strong" style={{ maxWidth: 520, width: '100%', padding: 28, background: '#fff' }}>
          <div className="kicker" style={{ color: 'var(--bad)' }}>403 · Authentication Required</div>
          <h1 style={{ margin: '6px 0 12px', font: '700 24px/1.15 var(--fh)', textTransform: 'uppercase' }}>
            Protected Loss Control Report
          </h1>
          <p style={{ margin: '0 0 18px', fontSize: 13.5, lineHeight: 1.55, color: 'var(--n7)' }}>
            Printable inspection packets contain confidential policyholder safety findings and require an active Team Workspace session, Member Portal session, or valid expiring external share link.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href={`/login?next=${encodeURIComponent(`/inspections/${insp.id}/report`)}`} className="btn btn-primary">
              Staff / Admin Sign In →
            </Link>
            <Link href="/portal" className="btn">
              Member Client Portal →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const scale = insp.scale || 'safe_unsafe_na';
  const baseline = scale === 'maturity';
  const mode =
    sp.mode ||
    (sp.type === 'recommendations' ? 'response' : 'full');

  const accent = tenant?.brand_scopes?.reports ? guardAccent(tenant.accent) : '#4b2454';
  const logoSrc = tenant?.logo_key || '/brand/logo.png';
  const retentionYear = Number(String(insp.started_at).slice(0, 4)) + 7;
  const canShare = Boolean(teamSess && can.shareReports(teamSess));
  const backHref = portalSess && !teamSess ? '/portal/session' : `/inspections/${insp.id}`;
  const backLabel = portalSess && !teamSess ? 'Member Portal' : `Record ${insp.id}`;

  // ---------- Scale-Specific Score Aggregations ----------
  // 1. LCE 100-Point Evaluation
  const lceSections =
    scale === 'lce_100'
      ? sections.map((sec: any) => {
          const secAns = answers.filter((a: any) => a.section_no === sec.section_no);
          let earned = 0;
          let possible = 0;
          for (const a of secAns) {
            const maxPts = a.threshold !== null && a.threshold !== undefined ? Number(a.threshold) : 5;
            if (a.value === 'na') continue;
            possible += maxPts;
            if (a.value === 'points' && a.measured_value !== null && a.measured_value !== undefined) {
              earned += Number(a.measured_value);
            }
          }
          return {
            ...sec,
            earned: Math.round(earned * 10) / 10,
            possible: Math.round(possible * 10) / 10,
          };
        })
      : [];
  const lceTotalEarned = Math.round(lceSections.reduce((s: number, x: any) => s + x.earned, 0) * 10) / 10;
  const lceTotalPossible = Math.round(lceSections.reduce((s: number, x: any) => s + x.possible, 0) * 10) / 10;
  const lceNormalized =
    lceTotalPossible > 0 ? Math.round((lceTotalEarned / lceTotalPossible) * 1000) / 10 : 0;
  const lceBand =
    lceNormalized >= 85
      ? 'Preferred Risk (85–100)'
      : lceNormalized >= 70
        ? 'Standard / Acceptable Risk (70–84)'
        : 'Substandard / Watch-List Priority (<70)';

  // 2. Auto Fleet Supplement (1 Excellent .. 5 Poor)
  let autoSum = 0;
  let autoRatedCount = 0;
  if (scale === 'auto_sup_1_5') {
    for (const a of answers) {
      if (typeof a.value === 'string' && a.value.startsWith('score_')) {
        autoSum += Number(a.value.replace('score_', ''));
        autoRatedCount++;
      }
    }
  }
  const autoBand =
    autoRatedCount === 0
      ? 'Unrated'
      : autoSum <= 15
        ? 'Preferred Fleet Controls (9–15)'
        : autoSum <= 27
          ? 'Acceptable Fleet Controls (16–27)'
          : 'Elevated Fleet Exposure (28–45)';

  // 3. Construction Part II RCA (% Acceptable, >=2 employees & >=30 applicable rule)
  const rcaAcc = Number(tallies.acceptable ?? 0);
  const rcaNi = Number(tallies.needs_improvement ?? 0);
  const rcaApplicable = rcaAcc + rcaNi;
  const rcaPct = rcaApplicable > 0 ? Math.round((rcaAcc / rcaApplicable) * 1000) / 10 : 0;
  const rcaEmployees = Number(insp.meta?.employeesOnSite ?? insp.site_employees ?? 0);
  const rcaQualifies = rcaEmployees >= 2 && rcaApplicable >= 30;

  // ARU Cover Letter groupings
  const lossTrendFindings = findings.filter((f: any) => Number(f.is_loss_trend) === 1);
  const regularFindings = findings.filter((f: any) => Number(f.is_loss_trend) !== 1);
  const claimsSummary = insp.meta?.claimsSummary || {
    AL: '0 claims · $0 incurred',
    APD: '0 claims · $0 incurred',
    GL: '0 claims · $0 incurred',
    WC: '0 claims · $0 incurred',
  };
  const operationsDesc =
    insp.site_operations ||
    insp.member_operations ||
    `${insp.industry} operations conducted at ${insp.site} (${insp.jurisdiction}).`;
  const ccList =
    insp.meta?.ccList ||
    [insp.broker_name && `${insp.broker_name} (${insp.broker_firm || 'Broker'})`, tenant?.name]
      .filter(Boolean)
      .join(', ');

  const modeBadgeLabel =
    mode === 'letter'
      ? 'ARU Service Visit Cover Letter'
      : mode === 'photos'
        ? 'ARU Location Photo Appendix'
        : mode === 'response'
          ? '30-Day Captive Board Response Form'
          : baseline
            ? 'Baseline Maturity & 12-Month Roadmap'
            : scale === 'policy_gap'
              ? 'Written Policy Gap Analysis Report'
              : scale === 'lce_100'
                ? '100-Point Loss Control Evaluation'
                : scale === 'auto_sup_1_5'
                  ? 'Commercial Auto Fleet Supplement'
                  : scale === 'rca_percent'
                    ? 'Part II Construction Jobsite RCA'
                    : 'Full Field Inspection Report';

  return (
    <div style={{ minHeight: '100vh', background: '#fff', color: 'var(--ink)', ['--acc' as string]: accent }}>
      <style>{`@media print { .no-print { display: none !important; } body { background: #fff !important; } }`}</style>
      <PrintReportBar
        id={insp.id}
        entityType="inspection"
        mode={mode}
        baseline={baseline}
        canShare={canShare}
        shareToken={validShareToken}
        backHref={backHref}
        backLabel={backLabel}
      />

      <div style={{ maxWidth: 940, margin: '0 auto', padding: '36px 28px 64px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* White-Labeled Report Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingBottom: 16, borderBottom: '3px solid var(--acc)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src={logoSrc} alt={tenant?.name || 'Consultancy'} style={{ height: 42 }} />
            <div>
              <div style={{ font: '700 22px/1.1 var(--fh)', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--a7)' }}>
                {tenant?.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--n6)' }}>
                {tenant?.custom_domain || tenant?.email_sender || 'Occupational Safety & Risk Control Deliverable'}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="pill" style={{ background: 'var(--acc)', fontSize: 10.5, padding: '4px 10px' }}>
              {modeBadgeLabel}
            </span>
            <div className="kicker" style={{ marginTop: 6 }}>
              Record {insp.id} · {insp.form_code} v{insp.form_version}
              {insp.group_code ? ` · ${insp.group_code}` : ''}
            </div>
          </div>
        </header>

        {/* Shared Policyholder & Visit Metadata Block */}
        <dl className="frame facts" style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <dt>Member / Policyholder</dt>
            <dd>
              <strong>{insp.member}</strong> ({insp.member_city || insp.industry})
              {insp.group_name ? ` · ${insp.group_name}` : ''}
            </dd>
          </div>
          <div><dt>Service / Visit Date</dt><dd>{fmtDate(insp.started_at)}</dd></div>
          <div><dt>Site &amp; Jurisdiction</dt><dd>{insp.site} · <strong>{insp.jurisdiction}</strong></dd></div>
          <div><dt>Risk Control Consultant</dt><dd>{insp.consultant} ({insp.consultant_email})</dd></div>
          <div><dt>Template &amp; Scale</dt><dd>{insp.form_code} · {insp.form_name}</dd></div>
          <div><dt>Primary Contact</dt><dd>{insp.contact || '—'} ({insp.contact_email || '—'})</dd></div>
          <div><dt>Record Immutability</dt><dd>{insp.submitted_at ? `Submitted · Locked through ${retentionYear}` : 'In-Progress Draft'}</dd></div>
          <div>
            <dt>Summary Count</dt>
            <dd>
              {scale === 'policy_gap' && `${tallies.addressed ?? 0} Addressed · ${tallies.partial ?? 0} Partial · ${tallies.missing ?? 0} Missing · ${tallies.na ?? 0} N/A`}
              {scale === 'lce_100' && `${lceTotalEarned} / ${lceTotalPossible} pts (${lceNormalized}%) · ${findings.length} Recommendations`}
              {scale === 'auto_sup_1_5' && `${autoSum} / ${autoRatedCount * 5 || 45} Fleet Score · ${autoBand}`}
              {scale === 'rca_percent' && `${rcaAcc} Acceptable / ${rcaApplicable} Applicable (${rcaPct}%)`}
              {scale === 'maturity' && `${insp.question_count} Baseline Maturity Elements`}
              {scale === 'safe_unsafe_na' && `${tallies.safe ?? 0} Safe · ${tallies.unsafe ?? 0} Unsafe · ${tallies.na ?? 0} N/A`}
            </dd>
          </div>
        </dl>

        {/* =================================================================== */}
        {/* PACKET MODE 2: ARU VISIT / SERVICE COVER LETTER                      */}
        {/* =================================================================== */}
        {mode === 'letter' && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="frame" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, lineHeight: 1.6, fontSize: 13.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{insp.contact || 'Safety Director / Management'}</div>
                  <div>{insp.member}</div>
                  <div>{insp.site}{insp.site_address ? ` — ${insp.site_address}` : ''}</div>
                </div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--n6)' }}>
                  Date: {fmtDate(insp.started_at)}<br />
                  Jurisdiction: {insp.jurisdiction}<br />
                  {insp.watch_tier && insp.watch_tier !== 'none' ? `Watch-List Tier: ${String(insp.watch_tier).toUpperCase()}` : 'Routine Risk Control Service'}
                </div>
              </div>

              <p style={{ margin: 0 }}>
                Dear {insp.contact || 'Member Representative'},
              </p>
              <p style={{ margin: 0 }}>
                Thank you for your time and cooperation during the risk control consultation and site evaluation conducted on <strong>{fmtDate(insp.started_at)}</strong> at <strong>{insp.site}</strong>. This correspondence summarizes operational exposures reviewed, multi-line loss experience, and prioritized risk control recommendations requiring your 30-day response.
              </p>

              {/* Description of Operations */}
              <div style={{ padding: '12px 14px', background: 'var(--bg)', borderLeft: '3px solid var(--acc)' }}>
                <div className="kicker" style={{ marginBottom: 4 }}>Description of Operations</div>
                <div>{operationsDesc}</div>
              </div>

              {/* Multi-Line Loss / Claims Summary Table */}
              <div>
                <div className="kicker" style={{ marginBottom: 6 }}>Multi-Line Claims &amp; Loss Trend Summary</div>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 180 }}>Coverage Line</th>
                      <th>Loss Experience / Incurred Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td><strong>Auto Liability (AL)</strong></td><td>{claimsSummary.AL || '0 claims · $0 incurred'}</td></tr>
                    <tr><td><strong>Auto Physical Damage (APD)</strong></td><td>{claimsSummary.APD || '0 claims · $0 incurred'}</td></tr>
                    <tr><td><strong>General Liability (GL)</strong></td><td>{claimsSummary.GL || '0 claims · $0 incurred'}</td></tr>
                    <tr><td><strong>Workers&apos; Compensation (WC)</strong></td><td>{claimsSummary.WC || '0 claims · $0 incurred'}</td></tr>
                  </tbody>
                </table>
              </div>

              {/* Recommendations Related to Loss Trend */}
              <div>
                <h3 style={{ margin: '4px 0 8px', font: '700 15px var(--fh)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  A. Recommendations Directly Related to Loss Trend ({lossTrendFindings.length})
                </h3>
                {lossTrendFindings.length === 0 ? (
                  <div className="sub">No recommendations from this visit were flagged directly against historical loss drivers.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {lossTrendFindings.map((f: any, idx: number) => (
                      <div key={f.id} style={{ padding: 12, border: '1px solid var(--div)', pageBreakInside: 'avoid' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <strong>{f.rec_number || `LT-${idx + 1}`} · {f.title || f.section_name}</strong>
                          <span className="kicker">{f.trigger_type || 'Loss Trend'} · {f.scope === 'corporate' ? 'Corporate-Wide' : 'Site-Specific'} · {f.priority}</span>
                        </div>
                        <div style={{ marginTop: 4 }}>{f.text}</div>
                        {(f.reg_code || f.reg_source_url) && (
                          <div style={{ marginTop: 6, fontSize: 12 }}>
                            <strong>Resource Standard:</strong> {f.reg_code ? `${f.reg_code} — ${f.reg_title || ''}` : ''}{' '}
                            {f.reg_source_url && (
                              <a href={f.reg_source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--acc)', textDecoration: 'underline' }}>
                                {f.reg_source_url}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Additional Safety-Related Recommendations */}
              <div>
                <h3 style={{ margin: '4px 0 8px', font: '700 15px var(--fh)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  B. Additional Safety &amp; Regulatory Recommendations ({regularFindings.length})
                </h3>
                {regularFindings.length === 0 ? (
                  <div className="sub">No additional safety deficiencies were cited during this visit.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {regularFindings.map((f: any, idx: number) => (
                      <div key={f.id} style={{ padding: 12, border: '1px solid var(--div)', pageBreakInside: 'avoid' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <strong>{f.rec_number || `REC-${idx + 1}`} · {f.title || f.section_name}</strong>
                          <span className="kicker">{f.trigger_type || 'Regulatory'} · {f.scope === 'corporate' ? 'Corporate-Wide' : 'Site-Specific'} · Due {fmtShort(f.due_on)}</span>
                        </div>
                        <div style={{ marginTop: 4 }}>{f.text}</div>
                        {(f.reg_code || f.reg_source_url) && (
                          <div style={{ marginTop: 6, fontSize: 12 }}>
                            <strong>Resource Standard:</strong> {f.reg_code ? `${f.reg_code} — ${f.reg_title || ''}` : ''}{' '}
                            {f.reg_source_url && (
                              <a href={f.reg_source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--acc)', textDecoration: 'underline' }}>
                                {f.reg_source_url}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Future Service & Training Plan */}
              <div style={{ padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--div2)' }}>
                <div className="kicker" style={{ marginBottom: 4 }}>Planned Future Training &amp; Risk Control Services</div>
                <div>
                  {insp.meta?.futureTrainingNeeds ||
                    'Follow-up verification of open recommendations, supervisor hazard recognition coaching, and annual written program review.'}
                </div>
              </div>

              {/* Signature & CC Block */}
              <div style={{ marginTop: 10, paddingTop: 14, borderTop: '1px solid var(--div2)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div>Respectfully submitted,</div>
                  <div style={{ marginTop: 10, fontWeight: 700, fontSize: 15 }}>{insp.consultant}</div>
                  <div className="sub">Risk Control Consultant · {tenant?.name}</div>
                  <div className="sub">{insp.consultant_email}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--n6)', maxWidth: 360 }}>
                  <strong>cc:</strong> {ccList || 'Captive Program Manager / Broker of Record'}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* PACKET MODE 3: ARU 2-COLUMN LOCATION PHOTO PAGE                      */}
        {/* =================================================================== */}
        {mode === 'photos' && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, font: '700 18px var(--fh)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                Location Photo Documentation ({photos.length})
              </h2>
              <span className="kicker">{insp.site} · {fmtDate(insp.started_at)}</span>
            </div>
            {photos.length === 0 ? (
              <div className="frame" style={{ padding: 24, fontSize: 13.5, color: 'var(--n6)' }}>
                No field photographs have been attached to {insp.id} yet. Photos uploaded from the Field Runner or Member Portal automatically format into this 2-column appendix.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                {photos.map((p: any, idx: number) => (
                  <figure key={p.id || idx} className="frame" style={{ margin: 0, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, pageBreakInside: 'avoid' }}>
                    <div style={{ background: '#f5f4f0', border: '1px solid var(--div2)', minHeight: 200, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                      <img
                        src={p.storage_key}
                        alt={p.annotated_key || p.rec_title || `Photo ${idx + 1}`}
                        style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                    <figcaption style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                        <span className="code">Photo {idx + 1}{p.rec_number ? ` · ${p.rec_number}` : ''}</span>
                        <Pill kind={p.kind === 'correction' ? 'verified' : 'ink'}>{p.kind}</Pill>
                      </div>
                      {p.rec_title && <div style={{ fontWeight: 700 }}>{p.rec_title}</div>}
                      {p.annotated_key && <div style={{ color: 'var(--n7)' }}>{p.annotated_key}</div>}
                      <div className="kicker" style={{ marginTop: 4 }}>Captured {fmtDate(p.captured_at)}</div>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        )}

        {/* =================================================================== */}
        {/* PACKET MODE 4: 30-DAY CAPTIVE BOARD RECOMMENDATION RESPONSE FORM     */}
        {/* =================================================================== */}
        {mode === 'response' && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="frame strong" style={{ padding: '16px 18px', background: 'var(--bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <strong style={{ font: '700 15px var(--fh)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Mandatory 30-Day Member Recommendation Response Form
                </strong>
                <Pill kind="overdue">Return Within 30 Days of {fmtShort(insp.started_at)}</Pill>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--n7)', marginTop: 6, lineHeight: 1.5 }}>
                Please review each numbered recommendation below, mark your response status, note target completion or abatement details, and submit electronically via the Member Client Portal or return signed to {tenant?.name}.
              </div>
            </div>

            {findings.length === 0 ? (
              <div className="frame" style={{ padding: 20, fontSize: 13.5, color: 'var(--ok)' }}>
                ✓ Zero open recommendations were issued for {insp.id}. No 30-day response submission is required.
              </div>
            ) : (
              findings.map((f: any, idx: number) => {
                const isAgree = f.member_response === 'agree' || f.status === 'corrected' || f.status === 'pending';
                const isDisagree = f.member_response === 'disagree' || f.status === 'assumed';
                const isCorrected = f.status === 'corrected';
                const isPending = f.status === 'pending' || f.status === 'open';
                return (
                  <div key={f.id} className="frame" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, pageBreakInside: 'avoid' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <span className="code" style={{ fontWeight: 700 }}>{f.rec_number || `${String(insp.started_at).slice(5, 7)}/${String(insp.started_at).slice(2, 4)}*${String(idx + 1).padStart(2, '0')}`}</span>
                      <Pill kind="ink">{f.trigger_type || 'Regulatory'}</Pill>
                      <Pill kind={f.priority === 'High' ? 'overdue' : 'acc'}>
                        {f.priority} · Due {fmtShort(f.due_on)}
                      </Pill>
                      <span className="kicker">
                        Scope: {f.scope === 'corporate' ? 'Corporate / Multi-Site' : 'Site-Specific'}
                        {Number(f.is_loss_trend) === 1 ? ' · Loss Trend Driver' : ''}
                      </span>
                    </div>

                    {f.title && <div style={{ fontWeight: 700, fontSize: 15 }}>{f.title}</div>}
                    <div style={{ fontSize: 13.8, lineHeight: 1.55 }}>{f.text}</div>

                    {(f.reg_code || f.reg_source_url) && (
                      <div style={{ padding: '8px 12px', background: 'var(--bg)', borderLeft: '3px solid var(--acc)', fontSize: 12 }}>
                        <strong>Resource Standard:</strong>{' '}
                        {f.reg_code ? `${f.reg_code} · ${f.reg_title || ''} (${f.reg_agency || 'OSHA'})` : 'Official Standard'}{' '}
                        {f.reg_source_url && (
                          <>
                            —{' '}
                            <a href={f.reg_source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--acc)', textDecoration: 'underline' }}>
                              {f.reg_source_url}
                            </a>
                          </>
                        )}
                      </div>
                    )}

                    {/* 30-Day Board Checkboxes */}
                    <div style={{ marginTop: 4, padding: '10px 12px', border: '1px solid var(--ink)', background: '#faf9f6', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--mono)' }}>
                        <span>[{isAgree ? '✓' : ' '}] AGREE WITH RECOMMENDATION</span>
                        <span>[{isDisagree ? '✓' : ' '}] DISAGREE (EXPLAIN BELOW)</span>
                        <span>[{isCorrected ? '✓' : ' '}] CORRECTED / COMPLETED</span>
                        <span>[{!isCorrected && isPending ? '✓' : ' '}] IN PROGRESS / PENDING</span>
                      </div>
                      <div style={{ fontSize: 12.5, minHeight: 34, borderTop: '1px dashed var(--div)', paddingTop: 6 }}>
                        <strong>Member Response / Abatement Action:</strong>{' '}
                        {f.member_response_note || <span style={{ color: 'var(--n5)' }}>________________________________________________________________________________</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            <div className="frame" style={{ padding: 18, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, fontSize: 12.5, pageBreakInside: 'avoid' }}>
              <div>
                <div className="kicker">Authorized Member Representative Signature</div>
                <div style={{ marginTop: 22, borderBottom: '1px solid var(--ink)' }} />
              </div>
              <div>
                <div className="kicker">Printed Name &amp; Title</div>
                <div style={{ marginTop: 22, borderBottom: '1px solid var(--ink)' }}>{insp.contact || ''}</div>
              </div>
              <div>
                <div className="kicker">Date Signed</div>
                <div style={{ marginTop: 22, borderBottom: '1px solid var(--ink)' }} />
              </div>
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* PACKET MODE 1: FULL MULTI-SCALE SCORECARDS & CHECKLISTS              */}
        {/* =================================================================== */}
        {mode === 'full' && (
          <>
            {/* SCALE A: BSA MATURITY & 12-MONTH ROADMAP */}
            {scale === 'maturity' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="frame strong">
                  <div className="panel-head">
                    <h2>Baseline Safety Maturity Profile</h2>
                    <span className="kicker">0 Absent · 1 Written · 2 Practiced · 3 Owned</span>
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

            {/* SCALE B: WRITTEN POLICY GAP ANALYSIS */}
            {scale === 'policy_gap' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  <div className="frame stat"><div className="kicker">Addressed</div><div className="v" style={{ color: 'var(--ok)' }}>{tallies.addressed ?? 0}</div><div className="h">fully compliant elements</div></div>
                  <div className="frame stat"><div className="kicker">Partially Covered</div><div className="v" style={{ color: 'var(--warn)' }}>{tallies.partial ?? 0}</div><div className="h">requires policy revision</div></div>
                  <div className="frame stat"><div className="kicker">Not Addressed</div><div className="v" style={{ color: 'var(--bad)' }}>{tallies.missing ?? 0}</div><div className="h">missing statutory element</div></div>
                  <div className="frame stat"><div className="kicker">Not Applicable</div><div className="v">{tallies.na ?? 0}</div><div className="h">documented N/A</div></div>
                </div>

                <div className="frame strong">
                  <div className="panel-head">
                    <h2>Written Policy Gap Analysis &amp; Remediation Action Plan</h2>
                    <span className="kicker">{insp.form_code} · {answers.length} Statutory Elements</span>
                  </div>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th style={{ width: 64 }}>Item</th>
                        <th>Statutory Policy Requirement &amp; Remediation Guidance</th>
                        <th style={{ width: 135 }}>Gap Status</th>
                        <th style={{ width: 130 }}>Action Owner</th>
                        <th style={{ width: 105 }}>Target Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {answers.map((a: any) => (
                        <tr key={a.question_id}>
                          <td className="code">{a.question_id}</td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{a.question_text}</div>
                            {(a.value === 'partial' || a.value === 'missing') && a.recommendation && (
                              <div className="sub" style={{ marginTop: 4, color: 'var(--n7)' }}>
                                <strong>Remediation:</strong> {a.recommendation}
                              </div>
                            )}
                            {a.note && <div className="sub" style={{ marginTop: 2 }}>Auditor Note: {a.note}</div>}
                          </td>
                          <td>
                            {a.value === 'addressed' && <Pill kind="verified">Addressed</Pill>}
                            {a.value === 'partial' && <Pill kind="acc">Partially Covered</Pill>}
                            {a.value === 'missing' && <Pill kind="overdue">Not Addressed</Pill>}
                            {a.value === 'na' && <Pill kind="line">N/A</Pill>}
                            {!a.value && <span className="kicker">Unreviewed</span>}
                          </td>
                          <td style={{ fontSize: 12.5 }}>{a.action_owner || '—'}</td>
                          <td className="mono" style={{ fontSize: 12 }}>{a.target_date ? fmtShort(a.target_date) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* SCALE C: 100-POINT LOSS CONTROL EVALUATION (LCE-100) */}
            {scale === 'lce_100' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="frame strong" style={{ padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                  <div>
                    <div className="kicker">ARU 100-Point Loss Control Evaluation Composite</div>
                    <div style={{ font: '700 28px/1.1 var(--fh)', marginTop: 4 }}>
                      {lceTotalEarned} / {lceTotalPossible} Points ({lceNormalized}%)
                    </div>
                  </div>
                  <Pill kind={lceNormalized >= 85 ? 'verified' : lceNormalized >= 70 ? 'acc' : 'overdue'}>
                    {lceBand}
                  </Pill>
                </div>

                <div className="frame">
                  <div className="panel-head">
                    <h2>Section Point Allocation Summary</h2>
                    <span className="kicker">Earned vs. Applicable Maximum Points</span>
                  </div>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th style={{ width: 70 }}>Sec</th>
                        <th>Evaluation Category</th>
                        <th style={{ width: 120 }}>Earned Pts</th>
                        <th style={{ width: 120 }}>Max Applicable</th>
                        <th style={{ width: 100 }}>Section %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lceSections.map((s: any) => (
                        <tr key={s.section_no}>
                          <td className="code">{s.section_no}</td>
                          <td style={{ fontWeight: 600 }}>{s.name}</td>
                          <td className="mono">{s.earned}</td>
                          <td className="mono">{s.possible}</td>
                          <td className="mono">{s.possible > 0 ? `${Math.round((s.earned / s.possible) * 100)}%` : 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="frame">
                  <div className="panel-head">
                    <h2>Itemized LCE Scoring Breakdown</h2>
                  </div>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th style={{ width: 64 }}>Item</th>
                        <th>Evaluation Criterion</th>
                        <th style={{ width: 110 }}>Earned / Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {answers.map((a: any) => {
                        const maxPts = a.threshold !== null && a.threshold !== undefined ? Number(a.threshold) : 5;
                        return (
                          <tr key={a.question_id}>
                            <td className="code">{a.question_id}</td>
                            <td>
                              <div>{a.question_text}</div>
                              {a.note && <div className="sub">Note: {a.note}</div>}
                            </td>
                            <td className="mono">
                              {a.value === 'na'
                                ? 'N/A'
                                : a.measured_value !== null && a.measured_value !== undefined
                                  ? `${a.measured_value} / ${maxPts}`
                                  : `— / ${maxPts}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* SCALE D: ARU COMMERCIAL AUTO FLEET SUPPLEMENT (1–5) */}
            {scale === 'auto_sup_1_5' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="frame strong" style={{ padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div className="kicker">Commercial Auto Fleet Supplement (1 Excellent → 5 Poor)</div>
                    <div style={{ font: '700 24px/1.15 var(--fh)', marginTop: 4 }}>
                      Composite Fleet Rating: {autoSum} ({autoRatedCount} Controls Rated)
                    </div>
                    <div className="sub" style={{ marginTop: 4 }}>
                      <strong>Service Area Mileage Profile:</strong>{' '}
                      {insp.meta?.serviceAreaProfile || 'Local (<50 mi): 70% · Intermediate (50–200 mi): 25% · Long-Haul (>200 mi): 5%'}
                    </div>
                  </div>
                  <Pill kind={autoSum <= 15 ? 'verified' : autoSum <= 27 ? 'acc' : 'overdue'}>{autoBand}</Pill>
                </div>

                <div className="frame">
                  <div className="panel-head">
                    <h2>9-Area Commercial Fleet Controls Matrix</h2>
                    <span className="kicker">Ratings 4 or 5 require corrective action</span>
                  </div>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th style={{ width: 64 }}>Area</th>
                        <th>Fleet Safety Control Element</th>
                        <th style={{ width: 200 }}>Assigned Rating (1–5)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {answers.map((a: any) => (
                        <tr key={a.question_id}>
                          <td className="code">{a.question_id}</td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{a.question_text}</div>
                            {a.note && <div className="sub">Auditor Note: {a.note}</div>}
                          </td>
                          <td>
                            <Pill
                              kind={
                                a.value === 'score_1' || a.value === 'score_2'
                                  ? 'verified'
                                  : a.value === 'score_3'
                                    ? 'acc'
                                    : a.value === 'score_4' || a.value === 'score_5'
                                      ? 'overdue'
                                      : 'line'
                              }
                            >
                              {AUTO_RATING_LABELS[a.value] || 'Unrated'}
                            </Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* SCALE E: PART II CONSTRUCTION JOBSITE RCA (% ACCEPTABLE) */}
            {scale === 'rca_percent' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="frame strong" style={{ padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div className="kicker">Construction Part II Jobsite Risk Control Assessment (RCA)</div>
                    <div style={{ font: '700 28px/1.1 var(--fh)', marginTop: 4 }}>
                      {rcaPct}% Acceptable ({rcaAcc} Acceptable / {rcaApplicable} Applicable Items)
                    </div>
                    <div className="sub" style={{ marginTop: 4 }}>
                      Employees Observed on Jobsite: <strong>{rcaEmployees}</strong> · Qualification Rule (≥2 Employees &amp; ≥30 Applicable Items):{' '}
                      <strong>{rcaQualifies ? 'QUALIFIED SCORED RCA' : 'ADVISORY VISIT (Supervisor Override / Below Threshold)'}</strong>
                    </div>
                  </div>
                  <Pill kind={rcaPct >= 85 ? 'verified' : rcaPct >= 70 ? 'acc' : 'overdue'}>
                    {rcaPct >= 85 ? 'Satisfactory Jobsite (≥85%)' : rcaPct >= 70 ? 'Conditional Jobsite (70–84%)' : 'High-Hazard Jobsite (<70%)'}
                  </Pill>
                </div>

                <div className="frame">
                  <div className="panel-head">
                    <h2>11-Category Construction Hazard Summary</h2>
                  </div>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th style={{ width: 64 }}>Cat</th>
                        <th>Construction Trade / Hazard Category</th>
                        <th style={{ width: 100 }}>Acceptable</th>
                        <th style={{ width: 130 }}>Needs Improvement</th>
                        <th style={{ width: 80 }}>N/A</th>
                        <th style={{ width: 100 }}>Category %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sections.map((sec: any) => {
                        const sa = answers.filter((a: any) => a.section_no === sec.section_no);
                        const acc = sa.filter((a: any) => a.value === 'acceptable').length;
                        const ni = sa.filter((a: any) => a.value === 'needs_improvement').length;
                        const na = sa.filter((a: any) => a.value === 'na').length;
                        const app = acc + ni;
                        return (
                          <tr key={sec.section_no}>
                            <td className="code">{sec.section_no}</td>
                            <td style={{ fontWeight: 600 }}>{sec.name}</td>
                            <td className="mono">{acc}</td>
                            <td className="mono" style={{ color: ni > 0 ? 'var(--bad)' : undefined }}>{ni}</td>
                            <td className="mono">{na}</td>
                            <td className="mono">{app > 0 ? `${Math.round((acc / app) * 100)}%` : 'N/A'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="frame">
                  <div className="panel-head">
                    <h2>Complete 77-Item Jobsite RCA Checklist</h2>
                  </div>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th style={{ width: 64 }}>Item</th>
                        <th>Jobsite Inspection Item</th>
                        <th style={{ width: 150 }}>Evaluation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {answers.map((a: any) => (
                        <tr key={a.question_id}>
                          <td className="code">{a.question_id}</td>
                          <td>
                            <div>{a.question_text}</div>
                            {a.note && <div className="sub">Note: {a.note}</div>}
                          </td>
                          <td>
                            {a.value === 'acceptable' && <Pill kind="verified">Acceptable</Pill>}
                            {a.value === 'needs_improvement' && <Pill kind="overdue">Needs Improvement</Pill>}
                            {a.value === 'na' && <Pill kind="line">N/A</Pill>}
                            {!a.value && <span className="kicker">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* FINDINGS & REGULATORY CITATIONS (ALL NON-MATURITY SCALES) */}
            {!baseline && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h2 style={{ margin: 0, font: '700 18px var(--fh)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  Findings &amp; Real-Time Regulatory Citations ({findings.length})
                </h2>
                {findings.length === 0 && (
                  <div className="frame" style={{ padding: 18, fontSize: 13.5, color: 'var(--ok)' }}>
                    No deficient findings or corrective recommendations were issued during this assessment.
                  </div>
                )}
                {findings.map((f: any) => {
                  const st = recState(f.status, f.due_on);
                  return (
                    <div key={f.id} className="frame" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8, pageBreakInside: 'avoid' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <span className="code">{f.rec_number || f.id}</span>
                        <span className="kicker">Item {f.q_label} · {f.section_name}</span>
                        {f.trigger_type && <Pill kind="line">{f.trigger_type}</Pill>}
                        {!!f.is_repeat && <Pill kind="overdue">Repeat Finding</Pill>}
                        {Number(f.is_loss_trend) === 1 && <Pill kind="acc">Loss Trend</Pill>}
                        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                          <Pill kind="ink">{f.priority} · {PRIORITY_DAYS[f.priority as keyof typeof PRIORITY_DAYS]}d · Due {fmtShort(f.due_on)}</Pill>
                          <Pill kind={st}>{STATE_LABEL[st]}</Pill>
                        </span>
                      </div>
                      {f.title && <div style={{ fontSize: 15, fontWeight: 700 }}>{f.title}</div>}
                      <div style={{ fontSize: 14, lineHeight: 1.5 }}>{f.text}</div>
                      {f.original_text && (
                        <div className="kicker" style={{ color: 'var(--n6)' }}>
                          Wording revised{f.revised_by_name ? ' by ' + f.revised_by_name : ''}{f.revised_at ? ' on ' + fmtDate(f.revised_at) : ''}. Original consultant wording retained on file.
                        </div>
                      )}
                      {(f.reg_code || f.reg_source_url) && (
                        <div style={{ marginTop: 4, padding: '10px 12px', background: 'var(--bg)', borderLeft: '3px solid var(--acc)', fontSize: 12.5, lineHeight: 1.5 }}>
                          <div style={{ fontWeight: 600 }}>
                            {f.reg_code} · {f.reg_title} ({f.reg_agency})
                            {f.reg_verified_on ? ` · Verified ${fmtDate(f.reg_verified_on)}` : ' · Summary'}
                          </div>
                          {(f.reg_verbatim || f.reg_summary) && (
                            <div style={{ marginTop: 4, color: 'var(--n7)' }}>{f.reg_verbatim || f.reg_summary}</div>
                          )}
                          {f.reg_source_url && (
                            <div style={{ marginTop: 4 }}>
                              <strong>Official Live Source:</strong>{' '}
                              <a href={f.reg_source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--acc)', textDecoration: 'underline' }}>
                                {f.reg_source_url}
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            )}

            {/* SCALE F: STANDARD SAFE / UNSAFE / N/A CHECKLIST */}
            {scale === 'safe_unsafe_na' && (
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
          </>
        )}

        {/* Legal & Retention Disclaimer Footer */}
        <footer style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--ink)', fontSize: 11.5, lineHeight: 1.55, color: 'var(--n6)' }}>
          <strong>Advisory &amp; 7-Year Immutability Notice:</strong> This report reflects conditions and programs evaluated at {insp.site} on {fmtDate(insp.started_at)} by {tenant?.name}. Regulatory citations are mapped to {insp.jurisdiction} standards (with Federal OSHA fallback where applicable) and linked to live official government portals. Upon submission, assessment answers and verified citations are database-locked for 7 years ({retentionYear}). Responsibility for workplace safety and hazard abatement remains solely with the employer ({insp.member}).
        </footer>
      </div>
    </div>
  );
}
