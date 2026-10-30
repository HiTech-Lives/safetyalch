import Link from 'next/link';
import { getQuickReportById } from '@/lib/queries';
import { guardAccent } from '@/lib/color';

export const dynamic = 'force-dynamic';

export default async function QuickReportPrintablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getQuickReportById(id);

  if (!report) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <h1>Quick Report Not Found</h1>
        <Link href="/work-queue" className="btn">
          ← Return to Work Queue
        </Link>
      </div>
    );
  }

  const accent = guardAccent(report.tenant?.accent || '#4b2454');
  const s = report.sections || {};

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '28px 24px 64px', ['--acc' as string]: accent }}>
      <div
        className="no-print"
        style={{
          maxWidth: 880,
          margin: '0 auto 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/work-queue" className="btn btn-sm">
            ← Work Queue
          </Link>
          <Link href="/field/quick-report" className="btn btn-sm">
            ← Quick Report Builder
          </Link>
        </div>
        <span className="chip ok">
          Consultant Verified by {report.verified_by_name} · Ready for Carrier / Captive Delivery
        </span>
      </div>

      <article
        className="card"
        style={{
          maxWidth: 880,
          margin: '0 auto',
          background: '#fff',
          border: '2px solid var(--ink)',
          padding: 36,
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '3px solid var(--acc)',
            paddingBottom: 18,
            marginBottom: 24,
          }}
        >
          <div>
            <div className="kicker" style={{ color: 'var(--acc)' }}>
              {report.tenant?.name} · Loss Control Deliverable
            </div>
            <h1 style={{ font: '700 28px var(--fh)', textTransform: 'uppercase', margin: '4px 0' }}>
              {report.title}
            </h1>
            <div className="mono muted" style={{ fontSize: 12 }}>
              Report ID: {report.id} · Carrier Ref: {report.carrier_ref || 'GSC-WC-26-0412'} · Date: {report.incident_date}
            </div>
          </div>
          <img
            src={report.tenant?.logo_key || '/brand/logo.png'}
            alt={report.tenant?.name}
            style={{ height: 42 }}
          />
        </header>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 14,
            padding: 16,
            background: 'var(--bg-soft)',
            border: '1px solid var(--line)',
            marginBottom: 24,
          }}
        >
          <div>
            <div className="kicker">Policyholder / Insured</div>
            <div style={{ fontWeight: 700 }}>{report.member_name}</div>
            <div className="muted" style={{ fontSize: 12 }}>{report.site_address || report.site_name}</div>
          </div>
          <div>
            <div className="kicker">Program / Source</div>
            <div style={{ fontWeight: 600 }}>{report.program_title || 'Captive Risk Control Program'}</div>
            <div className="muted" style={{ fontSize: 12 }}>Requested by: {report.requested_by || 'Program Manager'}</div>
          </div>
          <div>
            <div className="kicker">Consultant Verification</div>
            <div style={{ fontWeight: 600 }}>{report.verified_by_name}</div>
            <div className="mono muted" style={{ fontSize: 11 }}>
              Verified {report.verified_at}
            </div>
          </div>
        </section>

        {(
          [
            ['what_happened', '1. What Happened / Executive Summary'],
            ['sequence_of_events', '2. Sequence of Events'],
            ['contributing_factors', '3. Contributing Factors & Applicable Standards'],
            ['root_cause', '4. Root Cause Analysis'],
            ['overall_exposure', '5. Overall Exposure Assessment'],
            ['findings_and_recommendations', '6. Findings & Corrective Action Recommendations'],
            ['program_manager_summary', '7. Summary for the Program Manager'],
          ] as [string, string][]
        ).map(([k, heading]) =>
          s[k] ? (
            <section key={k} style={{ marginBottom: 20 }}>
              <h2
                style={{
                  font: '700 16px var(--fh)',
                  textTransform: 'uppercase',
                  letterSpacing: '.04em',
                  borderBottom: '1px solid var(--line)',
                  paddingBottom: 6,
                  marginBottom: 8,
                }}
              >
                {heading}
              </h2>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>{s[k]}</p>
            </section>
          ) : null
        )}

        {Array.isArray(report.photos) && report.photos.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h2
              style={{
                font: '700 16px var(--fh)',
                textTransform: 'uppercase',
                letterSpacing: '.04em',
                borderBottom: '1px solid var(--line)',
                paddingBottom: 6,
                marginBottom: 12,
              }}
            >
              8. Field Photo Evidence Log ({report.photos.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {report.photos.map((p: any, i: number) => (
                <div
                  key={i}
                  style={{
                    padding: 12,
                    border: '1px solid var(--line)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {p.label} · <span className="muted">{p.location}</span>
                    </div>
                    <div style={{ fontSize: 12.5, marginTop: 4 }}>{p.caption}</div>
                  </div>
                  <span className={'chip ' + (p.kind === 'positive' ? 'ok' : p.kind === 'hazard' ? 'danger' : '')}>
                    {p.kind}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer
          style={{
            marginTop: 32,
            paddingTop: 14,
            borderTop: '2px solid var(--ink)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11.5,
          }}
          className="mono muted"
        >
          <span>Signed &amp; Verified by: {report.verified_by_name}</span>
          <span>7-Year Immutable Loss Control Record · {report.tenant?.name}</span>
        </footer>
      </article>
    </div>
  );
}

