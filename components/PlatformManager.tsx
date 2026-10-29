'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pill } from './ui';
import { fmtDate } from '@/lib/format';

export default function PlatformManager({
  tenants,
  activeTenantId,
}: {
  tenants: any[];
  activeTenantId: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Edit tenant state
  const [ePlan, setEPlan] = useState('professional');
  const [eStatus, setEStatus] = useState('active');
  const [eSeats, setESeats] = useState(4);
  const [eDomain, setEDomain] = useState('');

  // Create tenant state
  const [cName, setCName] = useState('');
  const [cOwnerName, setCOwnerName] = useState('');
  const [cOwnerEmail, setCOwnerEmail] = useState('');
  const [cDomain, setCDomain] = useState('');
  const [cAccent, setCAccent] = useState('#1f4f6e');
  const [cPlan, setCPlan] = useState('professional');
  const [cSeats, setCSeats] = useState(4);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  function openTenant(t: any) {
    setSelected(t);
    setEPlan(t.plan || 'professional');
    setEStatus(t.status || 'active');
    setESeats(Number(t.seats_purchased) || 1);
    setEDomain(t.custom_domain || '');
  }

  async function switchIntoTenant(tenantId: string) {
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'impersonate_tenant', tenantId }),
    });
    const body = await res.json();
    setBusy(false);
    if (res.ok) {
      router.push(body.redirectTo || '/today');
      router.refresh();
    } else {
      notify(body.error);
    }
  }

  async function saveTenant(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'update_tenant',
        tenantId: selected.id,
        plan: ePlan,
        status: eStatus,
        seatsPurchased: eSeats,
        customDomain: eDomain,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setSelected(null);
      router.refresh();
    }
  }

  async function provisionTenant(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'provision_tenant',
        name: cName,
        ownerName: cOwnerName,
        ownerEmail: cOwnerEmail,
        customDomain: cDomain,
        accent: cAccent,
        plan: cPlan,
        seatsPurchased: cSeats,
      }),
    });
    const body = await res.json();
    setBusy(false);
    notify(res.ok ? body.message : body.error);
    if (res.ok) {
      setCreating(false);
      setCName(''); setCOwnerName(''); setCOwnerEmail(''); setCDomain('');
      router.refresh();
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="kicker">Tenant Consultancies &amp; Subscriptions ({tenants.length})</div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ Provision New Consultancy</button>
      </div>

      <div className="tbl-wrap">
        <table className="tbl" style={{ minWidth: 920 }}>
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Custom Domain</th>
              <th>Plan</th>
              <th>Paid Seats</th>
              <th>Members</th>
              <th>Inspections</th>
              <th>Open Recs</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(t => (
              <tr key={t.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 14, height: 14, background: t.accent, display: 'inline-block', border: '1px solid var(--ink)' }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {t.name} {t.id === activeTenantId && <Pill kind="acc">Current</Pill>}
                      </div>
                      <div className="sub">{t.id} · Created {fmtDate(t.created_at)}</div>
                    </div>
                  </div>
                </td>
                <td className="code">{t.custom_domain || '—'}</td>
                <td className="kicker" style={{ color: 'var(--ink)' }}>{t.plan || 'professional'}</td>
                <td className="num">{t.paid_seats_used} / {t.seats_purchased}</td>
                <td className="num">{t.member_count}</td>
                <td className="num">{t.inspection_count}</td>
                <td className="num" style={{ color: Number(t.open_recs) > 0 ? 'var(--bad)' : undefined }}>{t.open_recs}</td>
                <td>
                  <Pill kind={t.status === 'suspended' ? 'overdue' : 'verified'}>{t.status || 'active'}</Pill>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm" onClick={() => openTenant(t)}>Configure</button>
                    <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => switchIntoTenant(t.id)}>
                      Switch Console →
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <>
          <div className="drawer-bg" onClick={() => setSelected(null)} />
          <aside className="drawer" role="dialog" aria-label="Configure Tenant">
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Tenant {selected.id}</div>
                <h2>{selected.name}</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setSelected(null)} aria-label="Close">×</button>
            </div>
            <form onSubmit={saveTenant} className="drawer-body">
              <label className="field">
                <span>Subscription Plan</span>
                <select className="select" value={ePlan} onChange={e => setEPlan(e.target.value)}>
                  <option value="solo">Solo ($79 / seat)</option>
                  <option value="professional">Professional ($69 / seat)</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </label>
              <label className="field">
                <span>Purchased Paid Seats (currently using {selected.paid_seats_used})</span>
                <input className="input" type="number" min={1} max={500} value={eSeats} onChange={e => setESeats(Number(e.target.value))} required />
              </label>
              <label className="field">
                <span>Custom White-Label Domain</span>
                <input className="input" value={eDomain} onChange={e => setEDomain(e.target.value)} placeholder="portal.consultancy.com" />
              </label>
              <label className="field">
                <span>Account Status</span>
                <select className="select" value={eStatus} onChange={e => setEStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="suspended">Suspended</option>
                </select>
              </label>
              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>Save Tenant</button>
                <button type="button" className="btn" onClick={() => setSelected(null)}>Cancel</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {creating && (
        <>
          <div className="drawer-bg" onClick={() => setCreating(false)} />
          <aside className="drawer" role="dialog" aria-label="Provision Consultancy">
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                <div className="kicker">Multi-Tenant Provisioning</div>
                <h2>Provision New Consultancy</h2>
              </div>
              <button className="btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => setCreating(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={provisionTenant} className="drawer-body">
              <label className="field">
                <span>Organization Name</span>
                <input className="input" value={cName} onChange={e => setCName(e.target.value)} required placeholder="Golden State EHS Advisors" />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="field">
                  <span>Primary Owner Name</span>
                  <input className="input" value={cOwnerName} onChange={e => setCOwnerName(e.target.value)} required placeholder="Elena Rostova" />
                </label>
                <label className="field">
                  <span>Primary Owner Email</span>
                  <input className="input" type="email" value={cOwnerEmail} onChange={e => setCOwnerEmail(e.target.value)} required placeholder="elena@goldenstateehs.com" />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
                <label className="field">
                  <span>Custom Domain</span>
                  <input className="input" value={cDomain} onChange={e => setCDomain(e.target.value)} placeholder="app.goldenstateehs.com" />
                </label>
                <label className="field">
                  <span>Brand Accent</span>
                  <input className="input" value={cAccent} onChange={e => setCAccent(e.target.value)} style={{ fontFamily: 'var(--mono)' }} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
                <label className="field">
                  <span>Plan</span>
                  <select className="select" value={cPlan} onChange={e => setCPlan(e.target.value)}>
                    <option value="solo">Solo</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </label>
                <label className="field">
                  <span>Paid Seats</span>
                  <input className="input" type="number" min={1} max={100} value={cSeats} onChange={e => setCSeats(Number(e.target.value))} />
                </label>
              </div>
              <div className="drawer-foot" style={{ padding: '12px 0 0', borderTop: 'none' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>Provision Consultancy</button>
                <button type="button" className="btn" onClick={() => setCreating(false)}>Cancel</button>
              </div>
            </form>
          </aside>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

