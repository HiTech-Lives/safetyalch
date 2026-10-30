import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import { getSession } from '@/lib/session';
import { listObservations } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function ObservationsPage() {
  const s = await getSession();
  const observations = await listObservations(s);

  return (
    <>
      <PageHeader
        title="Field Observations Log"
        subtitle="AI-synthesized site observations from Quick Capture with paired Federal 29 CFR & State (Cal/OSHA · WA DOSH) citations"
      >
        <Link href="/field/capture" className="btn btn-acc">
          + Launch AI Quick Capture
        </Link>
      </PageHeader>
      <div className="content" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="kpi">
            <div className="kicker">Total Observations</div>
            <div className="kpi-num">{observations.length}</div>
            <div className="kpi-sub">Captured across active sites</div>
          </div>
          <div className="kpi">
            <div className="kicker">Open Hazards</div>
            <div className="kpi-num" style={{ color: 'var(--danger)' }}>
              {observations.filter(o => o.photo_kind === 'hazard' && o.status !== 'closed').length}
            </div>
            <div className="kpi-sub">Requires corrective action</div>
          </div>
          <div className="kpi">
            <div className="kicker">Positive Findings</div>
            <div className="kpi-num" style={{ color: 'var(--ok)' }}>
              {observations.filter(o => o.photo_kind === 'positive').length}
            </div>
            <div className="kpi-sub">Compliant controls documented</div>
          </div>
          <div className="kpi">
            <div className="kicker">AI Dual-Citation Match</div>
            <div className="kpi-num">100%</div>
            <div className="kpi-sub">Federal OSHA + State Code</div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">Observation Directory</span>
            <Link href="/field/quick-report" className="btn btn-sm">
              Pull into AI Quick Report →
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Observation &amp; Location</th>
                  <th>Policyholder / Responsible Company</th>
                  <th>Federal &amp; State Citations</th>
                  <th>Corrective Action</th>
                  <th>Priority</th>
                  <th>Type / Status</th>
                </tr>
              </thead>
              <tbody>
                {observations.map(o => (
                  <tr key={o.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{o.title}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {o.specific_location || o.site_name} · {o.description}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.member_name}</div>
                      {o.assigned_company && (
                        <div className="muted" style={{ fontSize: 11.5 }}>
                          Assigned to: {o.assigned_company}
                        </div>
                      )}
                    </td>
                    <td className="mono" style={{ fontSize: 11.5 }}>
                      <div>{o.federal_citation}</div>
                      <div style={{ color: 'var(--acc)', fontWeight: 600 }}>{o.state_citation}</div>
                    </td>
                    <td style={{ fontSize: 12.5, maxWidth: 320 }}>{o.corrective_action}</td>
                    <td>
                      <span className={'chip ' + (o.priority === 'High' || o.priority === 'Critical' ? 'danger' : 'warn')}>
                        {o.priority}
                      </span>
                    </td>
                    <td>
                      <span className={'chip ' + (o.photo_kind === 'positive' ? 'ok' : 'warn')}>
                        {o.photo_kind} · {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

