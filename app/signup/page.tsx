'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Frame, Pill } from '@/components/ui';
import { contrastOnWhite, guardAccent } from '@/lib/color';

const ACCENTS = ['#4b2454', '#1f4f6e', '#7a3b1d', '#3d3d6b', '#1f4a3a'];
const JURISDICTIONS = ['CA', 'WA', 'OR', 'NV', 'FED', 'AZ', 'TX', 'UT'];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Step 1: Organization & Owner
  const [orgName, setOrgName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 2: White-Label Brand & Seats
  const [customDomain, setCustomDomain] = useState('');
  const [emailSender, setEmailSender] = useState('');
  const [accent, setAccent] = useState('#1f4f6e');
  const [plan, setPlan] = useState('professional');
  const [seats, setSeats] = useState(3);

  // Step 3: Optional First Member & Site
  const [firstMemberName, setFirstMemberName] = useState('');
  const [firstMemberIndustry, setFirstMemberIndustry] = useState('Warehouse');
  const [firstMemberCity, setFirstMemberCity] = useState('');
  const [firstSiteName, setFirstSiteName] = useState('Primary Facility');
  const [firstSiteJur, setFirstSiteJur] = useState('CA');
  const [firstContactName, setFirstContactName] = useState('');
  const [firstContactEmail, setFirstContactEmail] = useState('');

  const ratio = contrastOnWhite(accent);
  const guarded = guardAccent(accent);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'signup',
        orgName,
        ownerName,
        email,
        password,
        customDomain,
        emailSender,
        accent,
        plan,
        seats,
        firstMemberName,
        firstMemberIndustry,
        firstMemberCity,
        firstSiteName,
        firstSiteJur,
        firstContactName,
        firstContactEmail,
      }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(body.error || 'Could not provision consultancy.');
      return;
    }
    router.push(body.redirectTo || '/today');
    router.refresh();
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', ['--acc' as string]: guarded }}>
      <header style={{ background: 'var(--ink)', color: '#fff', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
          <img src="/brand/logo.png" alt="The Safety Alchemist" style={{ height: 28, filter: 'brightness(0) invert(1)' }} />
          <span style={{ font: '700 17px var(--fh)', letterSpacing: '.05em', textTransform: 'uppercase' }}>The Safety Alchemist</span>
        </Link>
        <Link href="/login" style={{ color: '#fff', fontSize: 12.5 }}>Already have an account? Sign in →</Link>
      </header>

      <div style={{ flex: 1, maxWidth: 760, width: '100%', margin: '0 auto', padding: '40px 24px' }}>
        <Frame className="strong" style={{ padding: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div className="kicker">Multi-Tenant Provisioning · Step {step} of 3</div>
              <h1 style={{ margin: '4px 0 0', font: '700 26px/1.1 var(--fh)', textTransform: 'uppercase' }}>
                {step === 1 ? '1 · Consultancy & Owner Account' : step === 2 ? '2 · White-Label Identity & Seats' : '3 · First Member & Site (Optional)'}
              </h1>
            </div>
            <Pill kind="acc">15 Forms Included</Pill>
          </div>

          {err && <div className="banner warn" style={{ marginBottom: 14 }}>{err}</div>}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {step === 1 && (
              <>
                <label className="field">
                  <span>Consultancy / Organization Name</span>
                  <input className="input" value={orgName} onChange={e => setOrgName(e.target.value)} required placeholder="Cascade Loss Control & EHS" />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label className="field">
                    <span>Your Full Name (Primary Owner)</span>
                    <input className="input" value={ownerName} onChange={e => setOwnerName(e.target.value)} required placeholder="Alex Rivera, CSP" />
                  </label>
                  <label className="field">
                    <span>Work Email</span>
                    <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="alex@cascadesafety.com" />
                  </label>
                </div>
                <label className="field">
                  <span>Password (minimum 6 characters)</span>
                  <input className="input" type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} required />
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!orgName.trim() || !ownerName.trim() || !email.trim() || password.length < 6}
                    onClick={() => setStep(2)}
                  >
                    Next: Brand &amp; Seats →
                  </button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label className="field">
                    <span>Custom Domain (optional)</span>
                    <input className="input" value={customDomain} onChange={e => setCustomDomain(e.target.value)} placeholder="portal.cascadesafety.com" />
                  </label>
                  <label className="field">
                    <span>Outbound Report Sender Email</span>
                    <input className="input" value={emailSender} onChange={e => setEmailSender(e.target.value)} placeholder="reports@cascadesafety.com" />
                  </label>
                </div>

                <div className="field">
                  <span>White-Label Brand Accent (WCAG AA Guarded)</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {ACCENTS.map(h => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setAccent(h)}
                        style={{
                          width: 36,
                          height: 36,
                          background: h,
                          border: h === accent ? '2px solid var(--ink)' : '1px solid var(--div)',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                    <input className="input" value={accent} onChange={e => setAccent(e.target.value)} style={{ width: 110, fontFamily: 'var(--mono)' }} />
                    <span className="kicker" style={{ color: ratio >= 4.5 ? 'var(--ok)' : 'var(--warn7)' }}>
                      Contrast {ratio.toFixed(1)}:1 ({ratio >= 4.5 ? 'Passes AA' : 'Auto-guarded to ' + guarded})
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12 }}>
                  <label className="field">
                    <span>Subscription Tier</span>
                    <select className="select" value={plan} onChange={e => setPlan(e.target.value)}>
                      <option value="solo">Solo Consultant ($79 / seat)</option>
                      <option value="professional">Multi-Inspector Consultancy ($69 / seat)</option>
                      <option value="enterprise">Enterprise / Captive (10+ seats)</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Paid Inspector Seats</span>
                    <input className="input" type="number" min={1} max={100} value={seats} onChange={e => setSeats(Number(e.target.value))} />
                  </label>
                </div>
                <div className="banner dashed" style={{ fontSize: 12 }}>
                  Back-office Admin seats and Member Client Portals are always $0 and do not consume paid inspector seats.
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <button type="button" className="btn" onClick={() => setStep(1)}>← Back</button>
                  <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>Next: First Member →</button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div style={{ fontSize: 12.5, color: 'var(--n6)' }}>
                  Optionally onboard your first client Member now so you can immediately schedule or run an inspection, or leave blank to add Members later.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px', gap: 10 }}>
                  <label className="field">
                    <span>First Member Company Name</span>
                    <input className="input" value={firstMemberName} onChange={e => setFirstMemberName(e.target.value)} placeholder="Pacific Cold Logistics" />
                  </label>
                  <label className="field">
                    <span>Industry</span>
                    <input className="input" value={firstMemberIndustry} onChange={e => setFirstMemberIndustry(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>City, State</span>
                    <input className="input" value={firstMemberCity} onChange={e => setFirstMemberCity(e.target.value)} placeholder="Portland, OR" />
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
                  <label className="field">
                    <span>Primary Site Name</span>
                    <input className="input" value={firstSiteName} onChange={e => setFirstSiteName(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Site Jurisdiction</span>
                    <select className="select" value={firstSiteJur} onChange={e => setFirstSiteJur(e.target.value)}>
                      {JURISDICTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                    </select>
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label className="field">
                    <span>Site Contact Name</span>
                    <input className="input" value={firstContactName} onChange={e => setFirstContactName(e.target.value)} placeholder="Samira Vargas" />
                  </label>
                  <label className="field">
                    <span>Site Contact Email</span>
                    <input className="input" type="email" value={firstContactEmail} onChange={e => setFirstContactEmail(e.target.value)} placeholder="samira@pacificcold.com" />
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <button type="button" className="btn" onClick={() => setStep(2)}>← Back</button>
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    {busy ? 'Provisioning Consultancy…' : 'Launch Consultancy Console →'}
                  </button>
                </div>
              </>
            )}
          </form>
        </Frame>
      </div>
    </div>
  );
}

