import type { Metadata } from 'next';
import Link from 'next/link';
import { Frame, Pill } from '@/components/ui';

export const metadata: Metadata = {
  title: 'The Safety Alchemist | Multi-Tenant EHS & OSHA Compliance Inspection Platform',
  description:
    'White-labeled safety inspection software for EHS consultancies, loss-control teams, agriculture, construction, hospitality, and warehousing. 15 pre-built OSHA, Cal/OSHA, WA DOSH & OR-OSHA forms (903 questions), 7-year immutable audit retention, and passwordless Member Client Portals.',
  keywords: [
    'EHS inspection software',
    'safety consultant platform',
    'white-label OSHA audit software',
    'Cal/OSHA Title 8 inspection app',
    'H-2A housing inspection checklist',
    'IIPP compliance software',
    'loss control inspection software',
    'warehouse safety audit',
    'construction safety inspection software',
    'multi-tenant safety management system',
  ],
  alternates: { canonical: 'https://safetyalchemist.com/' },
  openGraph: {
    title: 'The Safety Alchemist — Precision Safety Inspection & Compliance Platform',
    description:
      'Run field inspections across 15 calibrated industry forms, auto-cite state & federal OSHA regulations, enforce 7-year immutable retention, and track every finding to Corrected or Risk Assumed.',
    url: 'https://safetyalchemist.com/',
    siteName: 'The Safety Alchemist',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Safety Alchemist | Multi-Tenant EHS & OSHA Inspection Software',
    description:
      'Built for safety consultancies, loss-control groups, and multi-site employers. 15 industry forms, 903 calibrated questions, free Admin seats, and passwordless client portals.',
  },
};

const FORM_CATALOG = [
  { code: 'BSA', name: 'Baseline Safety Assessment', industry: 'Cross-Industry', qs: 53, scale: '4-Level Maturity (Absent → Owned)', focus: '12-month safety program roadmap without punitive due dates' },
  { code: 'IIP', name: 'Injury & Illness Prevention Program', industry: 'Cross-Industry', qs: 59, scale: 'Safe / Unsafe / N/A', focus: 'Cal/OSHA Title 8 §3203 & federal written program verification' },
  { code: 'GEN', name: 'General Industry Walk-Through', industry: 'Manufacturing & Industrial', qs: 66, scale: 'Safe / Unsafe / N/A', focus: '29 CFR 1910 egress, machine guarding, LOTO, HazCom, electrical' },
  { code: 'WHS', name: 'Warehouse & Distribution Center', industry: 'Logistics & Cold Storage', qs: 62, scale: 'Safe / Unsafe / N/A', focus: 'Rack integrity, dock locks, PIT/forklift lanes, charging stations' },
  { code: 'CFA', name: 'Construction Field Audit', industry: 'Commercial & Civil Construction', qs: 68, scale: 'Safe / Unsafe / N/A', focus: '29 CFR 1926 fall protection, trenching, scaffolding, temp power' },
  { code: 'AGF', name: 'Agricultural Field Operations', industry: 'Agriculture & Row Crops', qs: 64, scale: 'Safe / Unsafe / N/A', focus: 'Heat illness (95°F high-heat), PTO guarding, WPS pesticide safety, field sanitation' },
  { code: 'PHP', name: 'Packing House & Processing', industry: 'Food Processing & Ag', qs: 63, scale: 'Safe / Unsafe / N/A', focus: 'Conveyor nip points, ammonia/cold rooms, lockout, wet-floor drainage' },
  { code: 'DRY', name: 'Dairy & Livestock Facility', industry: 'Dairy & Animal Ag', qs: 59, scale: 'Safe / Unsafe / N/A', focus: 'Parlor crowd gates, manure lagoon fencing, confined spaces, silage bunkers' },
  { code: 'H2A', name: 'H-2A Worker Housing Inspection', industry: 'Employer-Provided Housing', qs: 58, scale: 'Safe / Unsafe / N/A', focus: 'DOL ETA / OSHA 1910.142 sq-ft per occupant, screens, water, fire exits' },
  { code: 'HHR', name: 'Hotel & Resort Operations', industry: 'Hospitality & Lodging', qs: 61, scale: 'Safe / Unsafe / N/A', focus: 'Housekeeping ergonomics, laundry chemical feed, pool mechanical rooms' },
  { code: 'HFA', name: 'Restaurant & Food Service', industry: 'Food & Beverage', qs: 58, scale: 'Safe / Unsafe / N/A', focus: 'Ansul hood suppression, Class K extinguishers, slicer guards, walk-in coolers' },
  { code: 'HGC', name: 'Golf Course & Grounds Maintenance', industry: 'Turf, Parks & Clubs', qs: 59, scale: 'Safe / Unsafe / N/A', focus: 'ROPS on mowers, turf chemical mixing/storage, reel grinder guarding' },
  { code: 'FIR', name: 'Fire Prevention & Life Safety', industry: 'Focused Audit', qs: 58, scale: 'Safe / Unsafe / N/A', focus: 'Extinguisher hydro-test, 18-in sprinkler clearance, exit discharge, hot work' },
  { code: 'ELC', name: 'Electrical Safety & LOTO', industry: 'Focused Audit', qs: 58, scale: 'Safe / Unsafe / N/A', focus: '36-in panel clearance, arc-flash labels, GFCI, cord strain relief, LOTO' },
  { code: 'FLK', name: 'Powered Industrial Trucks (Forklifts)', industry: 'Focused Audit', qs: 57, scale: 'Safe / Unsafe / N/A', focus: '1910.178 pre-shift logs, data plates, eyewash at battery charging, LPG cages' },
];

const DEMOGRAPHICS = [
  {
    kicker: 'EHS & LOSS-CONTROL CONSULTANCIES',
    title: 'Independent Safety Consultancies & Fractional EHS Firms',
    body: 'Deliver every inspection report, corrective-action email, and client dashboard under your own brand, custom domain, and WCAG AA-guarded accent color. Add unlimited back-office Admins for scheduling and QA wording review at $0.',
    metrics: '100% White-Labeled · Free Admin Seats · Crew Supervision',
  },
  {
    kicker: 'INSURANCE CAPTIVES & ASSOCIATIONS',
    title: 'Workers’ Comp Captives, Trade Associations & Pool Administrators',
    body: 'Track loss-control visits across ratusan of Member companies and multi-state sites. Enforce calibrated 7 / 30 / 60-day abatement windows, flag repeat findings across visits automatically, and preserve a 7-year tamper-proof audit trail.',
    metrics: 'Multi-Jurisdiction (FED, CA, WA, OR, NV) · Repeat-Finding Engine',
  },
  {
    kicker: 'AGRICULTURE, DAIRY & H-2A EMPLOYERS',
    title: 'Growers, Packing Houses, Dairies & H-2A Housing Operators',
    body: 'Purpose-built templates for Field Ag (AGF), Packing Houses (PHP), Dairies (DRY), and DOL/OSHA H-2A Worker Housing (H2A) with built-in numeric threshold checks (ft², foot-candles, °F, inches) that auto-score Safe vs. Unsafe.',
    metrics: 'Auto-Evaluated Measurements · State-Plan Citations First',
  },
  {
    kicker: 'CONSTRUCTION, WAREHOUSING & HOSPITALITY',
    title: 'Multi-Site Contractors, 3PL Logistics & Hospitality Groups',
    body: 'Site managers never need a username or password. When an inspector submits a report, the site contact receives a secure magic link to upload abatement proof photos or sign a formal Risk Assumed declaration in writing.',
    metrics: 'Passwordless Member Portal · Zero Client Seat Fees',
  },
];

const FAQS = [
  {
    q: 'What is The Safety Alchemist and how is it different from generic checklist apps?',
    a: 'The Safety Alchemist is a multi-tenant occupational safety inspection and compliance platform built specifically for EHS consultancies, insurance loss-control teams, and multi-site employers. Unlike generic form builders, it ships with 15 calibrated industry forms (903 questions), jurisdiction-aware regulation auto-citation (State Plan first, Federal OSHA fallback), database-enforced 7-year immutability triggers, and passwordless Member Client Portals.',
  },
  {
    q: 'How does per-inspector seat pricing work, and are Admin and Client users really free?',
    a: 'You only pay for seats that can conduct and submit a field inspection (Owners, Supervisors, and Consultants). Back-office Admins who manage scheduling, members, billing requests, and report wording QA are 100% free. Member client contacts who receive reports and submit abatement proof via magic link are also unlimited and free.',
  },
  {
    q: 'How does the 7-year immutable compliance record work?',
    a: 'Once an inspection is submitted from the Field App, MySQL 8 database triggers lock the inspection and its answers against any update or deletion for the 7-year retention period. Recommendation events are strictly append-only, and verified regulation citations can never be edited in place—only superseded by a new regulation ID so historical reports always display the exact legal text printed on the day of the audit.',
  },
  {
    q: 'Which OSHA and State-Plan jurisdictions are supported?',
    a: 'Every Member site carries its own jurisdiction code (e.g., CA for Cal/OSHA Title 8, WA for WA L&I DOSH, OR for OR-OSHA, NV for Nevada OSHA, and FED for Federal OSHA 29 CFR 1910/1926). When a Consultant marks a question Unsafe, the platform automatically resolves the state-specific citation first and falls back to the Federal OSHA standard if no state-specific rule applies.',
  },
  {
    q: 'How does the passwordless Member Client Portal work?',
    a: 'When an inspection report is issued or a finding needs follow-up, the primary Member contact receives a white-labeled email with a cryptographic magic link. Opening the link displays their open findings, allowing them to upload a correction photo and note (moving the finding to Pending Review) or formally sign a Risk Assumed statement in writing.',
  },
  {
    q: 'What is the Baseline Safety Assessment (BSA) form?',
    a: 'The Baseline Safety Assessment (BSA) is a 53-question diagnostic scored on a 4-level maturity scale—Absent, Written, Practiced, and Owned—rather than Safe/Unsafe. It produces a 12-month Development Plan PDF with no punitive due dates, ideal for onboarding new client organizations.',
  },
];

export default function PublicLandingPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'The Safety Alchemist',
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'EHS & Occupational Safety Compliance Software',
        operatingSystem: 'Web, iOS, iPadOS, Android (PWA)',
        url: 'https://safetyalchemist.com',
        description:
          'Multi-tenant EHS safety inspection, OSHA/State-Plan citation, and corrective-action tracking platform for safety consultancies, loss-control groups, and multi-site employers.',
        offers: {
          '@type': 'Offer',
          price: '79.00',
          priceCurrency: 'USD',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: '79.00',
            priceCurrency: 'USD',
            unitText: 'per active field inspector seat / month (Admins & Member Client Portals free)',
          },
        },
        featureList: [
          '15 pre-built industry safety forms (903 calibrated questions)',
          'Jurisdiction-aware regulation citations (Cal/OSHA, WA DOSH, OR-OSHA, NV OSHA, Federal OSHA)',
          'Database-enforced 7-year immutable inspection & citation retention',
          'Passwordless white-labeled Member Client Portal for photo abatement & Risk Assumed sign-off',
          'Baseline Safety Assessment (BSA) 4-level maturity model & 12-month development plan',
          'Calibrated 7-day (High), 30-day (Med), and 60-day (Low) corrective-action SLA engine',
        ],
      },
      {
        '@type': 'Organization',
        name: 'The Safety Alchemist',
        url: 'https://safetyalchemist.com',
        logo: 'https://safetyalchemist.com/brand/logo.png',
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQS.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--ink)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Top Marketing Navigation */}
      <header style={{ background: 'var(--ink)', color: '#fff', borderBottom: '1px solid rgba(255,255,255,.15)', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
            <img src="/brand/logo.png" alt="The Safety Alchemist" style={{ height: 30, filter: 'brightness(0) invert(1)' }} />
            <span style={{ font: '700 18px var(--fh)', letterSpacing: '.05em', textTransform: 'uppercase' }}>The Safety Alchemist</span>
          </Link>
          <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 13, color: 'rgba(255,255,255,.78)', marginLeft: 12 }}>
            <a href="#demographics" style={{ color: 'inherit' }}>Who We Serve</a>
            <a href="#forms" style={{ color: 'inherit' }}>15 Industry Forms</a>
            <a href="#architecture" style={{ color: 'inherit' }}>7-Year Compliance</a>
            <a href="#pricing" style={{ color: 'inherit' }}>Seat Pricing</a>
            <a href="#faq" style={{ color: 'inherit' }}>FAQ</a>
          </nav>
          <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Link href="/portal" className="btn btn-sm" style={{ background: 'transparent', borderColor: 'rgba(255,255,255,.35)', color: '#fff' }}>
              Member Client Portal
            </Link>
            <Link href="/field" className="btn btn-sm" style={{ background: 'transparent', borderColor: 'rgba(255,255,255,.35)', color: '#fff' }}>
              Field Inspector App
            </Link>
            <Link href="/login" className="btn btn-sm" style={{ background: '#fff', color: 'var(--ink)' }}>
              Staff Sign In
            </Link>
            <Link href="/signup" className="btn btn-primary btn-sm" style={{ background: 'var(--sand)', borderColor: 'var(--sand)', color: 'var(--ink)' }}>
              Start Your Consultancy →
            </Link>
          </div>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        {/* Hero Section */}
        <section style={{ borderBottom: '1px solid var(--div)', background: 'linear-gradient(180deg, #fff 0%, var(--bg) 100%)', padding: '56px 24px 48px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 32, alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Pill kind="solid">Multi-Tenant EHS SaaS</Pill>
                <Pill kind="acc">OSHA · Cal/OSHA · WA DOSH · OR-OSHA · NV OSHA</Pill>
              </div>
              <h1 style={{ margin: 0, font: '700 clamp(34px, 4.5vw, 52px)/1.03 var(--fh)', letterSpacing: '.02em', textTransform: 'uppercase' }}>
                Turn Field Safety Walks Into Defensible, 7-Year Immutable Compliance Records.
              </h1>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: 'var(--n7)', maxWidth: 640 }}>
                Purpose-built for <strong>safety consultancies</strong>, <strong>workers&apos; comp captives</strong>, and <strong>multi-site employers</strong> across Agriculture, Construction, Warehousing, Dairy, H-2A Housing, and Hospitality. Conduct calibrated mobile inspections, auto-cite state &amp; federal regulations, and close findings through a passwordless, white-labeled Member Client Portal.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, paddingTop: 4 }}>
                <Link href="/signup" className="btn btn-primary" style={{ height: 44, padding: '0 22px', fontSize: 13 }}>
                  Launch Your Consultancy Account
                </Link>
                <Link href="/today" className="btn" style={{ height: 44, padding: '0 20px', fontSize: 13 }}>
                  Explore Live Staff Console →
                </Link>
                <Link href="/portal" className="btn" style={{ height: 44, padding: '0 18px', fontSize: 13 }}>
                  View Member Client Portal
                </Link>
              </div>
              <div className="kicker" style={{ color: 'var(--n6)' }}>
                Pay only per field inspector · Unlimited free Admin seats · Unlimited free Member Client Portals
              </div>
            </div>

            {/* Interactive Platform Surface Directory Card */}
            <Frame className="strong" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--ink)', paddingBottom: 10 }}>
                <span style={{ font: '700 14px var(--fh)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Platform Surface Directory · Live Demo</span>
                <Pill kind="verified">4 Distinct Surfaces</Pill>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--n6)', lineHeight: 1.5 }}>
                The Safety Alchemist separates public onboarding, tenant staff operations, mobile field capture, and client hazard abatement into dedicated interfaces:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Link href="/today" className="frame" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--ink)' }}>
                  <div>
                    <div className="kicker" style={{ color: 'var(--acc)' }}>1 · Tenant Staff Console (/today)</div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 2 }}>Owner, Admin, Supervisor &amp; Consultant Workspace</div>
                    <div className="sub">Schedule visits, review Member fixes, revise wording, manage seats &amp; white-label brand.</div>
                  </div>
                  <span style={{ font: '700 13px var(--fh)' }}>OPEN →</span>
                </Link>
                <Link href="/field" className="frame" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--ink)' }}>
                  <div>
                    <div className="kicker" style={{ color: 'var(--ok)' }}>2 · Field Inspector App (/field)</div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 2 }}>Phone &amp; Tablet Inspection Runner</div>
                    <div className="sub">Arrival prep, Safe/Unsafe/Maturity scoring, threshold auto-checks, repeat flags &amp; lock.</div>
                  </div>
                  <span style={{ font: '700 13px var(--fh)' }}>LAUNCH →</span>
                </Link>
                <Link href="/portal" className="frame" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--ink)' }}>
                  <div>
                    <div className="kicker" style={{ color: 'var(--warn7)' }}>3 · Customer Member Portal (/portal)</div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 2 }}>Passwordless White-Labeled Client Dashboard</div>
                    <div className="sub">Clients view inspection PDFs, upload abatement photos, or sign Risk Assumed declarations.</div>
                  </div>
                  <span style={{ font: '700 13px var(--fh)' }}>VIEW →</span>
                </Link>
                <Link href="/platform" className="frame" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--ink)' }}>
                  <div>
                    <div className="kicker">4 · SaaS Operator Console (/platform)</div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 2 }}>Multi-Tenant Super-Admin &amp; Master Library</div>
                    <div className="sub">Provision consultancies, monitor seat utilization, and govern master forms &amp; regulations.</div>
                  </div>
                  <span style={{ font: '700 13px var(--fh)' }}>MANAGE →</span>
                </Link>
              </div>
            </Frame>
          </div>
        </section>

        {/* Key Platform Benchmarks */}
        <section style={{ borderBottom: '1px solid var(--div)', background: '#fff', padding: '28px 24px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }} className="stats">
            {[
              ['15', 'Calibrated Industry Forms', 'Cross-industry, Ag, Dairy, H-2A, Construction, Warehouse & Hospitality'],
              ['903', 'Field-Tested Questions', 'Calibrated 14% High (7d) · 62% Med (30d) · 24% Low (60d) priority distribution'],
              ['249', 'Shared Core Questions (SHR-*)', 'Cross-form repeat-finding detection when the same hazard recurs on a site'],
              ['7 Years', 'Immutable Record Retention', 'Database-level triggers prevent post-submission tampering of answers or citations'],
              ['$0', 'Admin & Client Portal Seats', 'Only pay per active field inspector; back-office staff and client contacts are free'],
            ].map(([v, k, h]) => (
              <div key={k} className="frame stat">
                <div className="kicker">{k}</div>
                <div className="v">{v}</div>
                <div className="h">{h}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Demographic Targeting Section */}
        <section id="demographics" style={{ padding: '52px 24px', borderBottom: '1px solid var(--div)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <div className="kicker">Built for High-Compliance Industries &amp; Advisory Firms</div>
              <h2 style={{ margin: '4px 0 0', font: '700 30px/1.1 var(--fh)', textTransform: 'uppercase', letterSpacing: '.02em' }}>
                Engineered for Every Link in the Safety &amp; Loss-Control Chain
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
              {DEMOGRAPHICS.map(d => (
                <Frame key={d.title} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="kicker" style={{ color: 'var(--a7)' }}>{d.kicker}</div>
                  <h3 style={{ margin: 0, font: '700 20px/1.15 var(--fh)', textTransform: 'uppercase' }}>{d.title}</h3>
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: 'var(--n7)', flex: 1 }}>{d.body}</p>
                  <div style={{ paddingTop: 10, borderTop: '1px solid var(--div2)', font: '600 10px var(--mono)', color: 'var(--ink)', textTransform: 'uppercase' }}>
                    {d.metrics}
                  </div>
                </Frame>
              ))}
            </div>
          </div>
        </section>

        {/* 15 Industry Inspection Forms Catalog */}
        <section id="forms" style={{ padding: '52px 24px', background: '#fff', borderBottom: '1px solid var(--div)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
              <div>
                <div className="kicker">Standardized Inspection Library · 903 Questions</div>
                <h2 style={{ margin: '4px 0 0', font: '700 30px/1.1 var(--fh)', textTransform: 'uppercase', letterSpacing: '.02em' }}>
                  15 Ready-to-Run OSHA &amp; State-Plan Inspection Templates
                </h2>
              </div>
              <Link href="/forms" className="btn btn-sm">Inspect All 903 Questions in Console →</Link>
            </div>
            <div className="tbl-wrap">
              <table className="tbl" style={{ minWidth: 880 }}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Form Name</th>
                    <th>Target Industry / Demographic</th>
                    <th>Items</th>
                    <th>Scoring Scale</th>
                    <th>Regulatory &amp; Operational Focus</th>
                  </tr>
                </thead>
                <tbody>
                  {FORM_CATALOG.map(f => (
                    <tr key={f.code}>
                      <td><Pill kind="solid">{f.code}</Pill></td>
                      <td style={{ fontWeight: 600 }}>{f.name}</td>
                      <td>{f.industry}</td>
                      <td className="num">{f.qs}</td>
                      <td><Pill kind={f.code === 'BSA' ? 'acc' : 'line'}>{f.scale}</Pill></td>
                      <td style={{ fontSize: 12.5, color: 'var(--n7)' }}>{f.focus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Loss Control Operating System Section */}
        <section id="loss-control-os" style={{ padding: '52px 24px', background: '#fff', borderBottom: '1px solid var(--div)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div>
              <div className="kicker">Every Assignment from the Day It Comes In to the Day It Is Billed</div>
              <h2 style={{ margin: '4px 0 0', font: '700 30px/1.1 var(--fh)', textTransform: 'uppercase', letterSpacing: '.02em' }}>
                Complete Loss Control &amp; EHS Consulting Operating System
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
              <Frame style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="kicker" style={{ color: 'var(--acc)' }}>1 · Work Queue &amp; AI Email Intake</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Paste a Carrier Email → Click &ldquo;Read it&rdquo; → Dispatched</div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--n6)', lineHeight: 1.55 }}>
                  Extracts Carrier Reference, Service Type, Insured, Broker/Program Manager, Site Contact, Approved Fee, and Due Date while keeping the original email side-by-side. Tracks jobs from <code>Received → Scheduled → Visit Done → In QC → Delivered → Billed</code>.
                </p>
                <Link href="/work-queue" className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--acc)', marginTop: 4 }}>
                  Open Work Queue &amp; AI Intake →
                </Link>
              </Frame>

              <Frame style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="kicker" style={{ color: 'var(--acc)' }}>2 · 3-Tier Captives, Brokers &amp; Draw-Down Budgets</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Carrier/Captive → Referral Broker → Policyholder</div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--n6)', lineHeight: 1.55 }}>
                  Manage annual draw-down retainers, fixed-deliverable contracts, and T&amp;M engagements. Track <strong>In Force $</strong>, <strong>Spent to Date</strong>, <strong>Planned</strong>, and line-item Service Plans in real time.
                </p>
                <Link href="/engagements" className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--acc)', marginTop: 4 }}>
                  Explore Engagements &amp; Program Budgets →
                </Link>
              </Frame>

              <Frame style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="kicker" style={{ color: 'var(--acc)' }}>3 · Qualification-Aware Staffing</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Who Is Qualified, Free &amp; Certified for the Whole Job</div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--n6)', lineHeight: 1.55 }}>
                  Filter field staff by required credentials (<code>CSP</code>, <code>CIH</code>, <code>ALCM</code>, <code>ARM</code>, <code>CSR</code>, <code>OSHA 500/510</code>, <code>First Aid/CPR</code>) and verify certification expiration dates cover the entire assignment window.
                </p>
                <Link href="/assignments" className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--acc)', marginTop: 4 }}>
                  Open Qualification Staffing →
                </Link>
              </Frame>

              <Frame style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="kicker" style={{ color: 'var(--acc)' }}>4 · Mobile Route &amp; Passwordless Visit Confirmation</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Multi-Stop Navigation &amp; 1-Tap Site Contact Confirm</div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--n6)', lineHeight: 1.55 }}>
                  Site contacts confirm visits from their email with zero login (<em>&ldquo;Someone will be there&rdquo;</em>, <em>&ldquo;Tell us who to meet&rdquo;</em>, or <em>&ldquo;Time does not work&rdquo;</em>), updating the inspector&rsquo;s mobile route card live.
                </p>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <Link href="/field/route" className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--acc)' }}>
                    Inspector Route →
                  </Link>
                  <Link href="/confirm-visit/demo-confirm-s13" className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
                    No-Login Confirm Demo ↗
                  </Link>
                </div>
              </Frame>

              <Frame style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="kicker" style={{ color: 'var(--acc)' }}>5 · AI Quick Capture &amp; &ldquo;In the Truck&rdquo; Quick Reports</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Numbered Photos + Voice Dictation → Narrative Report</div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--n6)', lineHeight: 1.55 }}>
                  Capture photos and voice memos once on the site walk; AI pairs Federal <code>29 CFR</code> + State (<code>Cal/OSHA Title 8</code> / <code>WA DOSH</code>) citations and drafts complete Post-Incident Reviews ready for consultant verification.
                </p>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <Link href="/field/capture" className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--acc)' }}>
                    AI Quick Capture →
                  </Link>
                  <Link href="/field/quick-report" className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
                    AI Quick Report →
                  </Link>
                </div>
              </Frame>

              <Frame style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="kicker" style={{ color: 'var(--acc)' }}>6 · Receipt OCR, Timesheets &amp; Multi-Cloud AI</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>AWS Bedrock (Qwen / Nova), Azure AI &amp; 1-Click Billing CSV</div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--n6)', lineHeight: 1.55 }}>
                  Snap hotel/meal receipts with AI OCR, collect policyholder &amp; employee signatures on weekly timesheets, export 1-row-per-site Billing CSVs, and route AI tasks to cost-efficient AWS Bedrock Qwen or Azure AI models.
                </p>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <Link href="/timesheets" className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--acc)' }}>
                    Timesheets &amp; Billing CSV →
                  </Link>
                  <Link href="/settings/ai" className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
                    AWS / Azure Model Router →
                  </Link>
                </div>
              </Frame>
            </div>
          </div>
        </section>

        {/* Architectural Advantage & Comparison */}
        <section id="architecture" style={{ padding: '52px 24px', borderBottom: '1px solid var(--div)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div>
              <div className="kicker">Why Consultancies Switch to The Safety Alchemist</div>
              <h2 style={{ margin: '4px 0 0', font: '700 30px/1.1 var(--fh)', textTransform: 'uppercase', letterSpacing: '.02em' }}>
                Purpose-Built Compliance Architecture vs. Generic Form Builders
              </h2>
            </div>
            <div className="tbl-wrap">
              <table className="tbl" style={{ minWidth: 820 }}>
                <thead>
                  <tr>
                    <th>Capability</th>
                    <th>The Safety Alchemist</th>
                    <th>Generic Checklist Apps</th>
                    <th>Word / Excel / PDFs</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Back-Office Admin & Client Portal Licensing', '100% Free (Pay only per Field Inspector)', 'Charged per user seat', 'Manual email attachments'],
                    ['Jurisdiction-Aware Regulation Citations', 'Auto-resolves State Plan (CA/WA/OR/NV) + Fed fallback', 'Manual copy-paste or static text', 'Manual lookup every report'],
                    ['7-Year Audit Immutability & Citation Retention', 'Enforced by MySQL triggers + regulation superseding', 'Editable anytime; overwrites history', 'Uncontrolled file versions'],
                    ['Consultant Wording Ownership & QA Audit Trail', 'Original text preserved + "Revised by" attribution', 'Silent overwrites', 'No version attribution'],
                    ['Client Abatement & "Risk Assumed" Workflow', 'Passwordless Magic Link + formal written Risk Assumed', 'Requires client paid login', 'Lost in email threads'],
                    ['Cross-Form Repeat-Finding Detection', '249 shared question keys (SHR-*) flag repeat site hazards', 'Isolated per template', 'None'],
                  ].map(([cap, sa, gen, doc]) => (
                    <tr key={cap}>
                      <td style={{ fontWeight: 600 }}>{cap}</td>
                      <td style={{ color: 'var(--ok)', fontWeight: 600 }}>✓ {sa}</td>
                      <td style={{ color: 'var(--n6)' }}>{gen}</td>
                      <td style={{ color: 'var(--n6)' }}>{doc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Transparent Seat Pricing */}
        <section id="pricing" style={{ padding: '52px 24px', background: '#fff', borderBottom: '1px solid var(--div)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div>
              <div className="kicker">Predictable Per-Inspector Economics</div>
              <h2 style={{ margin: '4px 0 0', font: '700 30px/1.1 var(--fh)', textTransform: 'uppercase', letterSpacing: '.02em' }}>
                You Only Pay for People Who Run Inspections in the Field
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
              <Frame style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="kicker">Solo Consultant</div>
                <div style={{ font: '700 34px/1 var(--fh)' }}>$79 <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--n6)' }}>/ inspector seat / mo</span></div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--n6)' }}>For independent safety consultants and fractional EHS advisors.</p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, flex: 1 }}>
                  <li>1 Owner / Field Inspector seat</li>
                  <li>All 15 industry forms (903 questions)</li>
                  <li>Unlimited Members, sites &amp; magic-link portals</li>
                  <li>Full white-label PDF reports &amp; custom accent</li>
                </ul>
                <Link href="/signup?plan=solo" className="btn">Start Solo Account →</Link>
              </Frame>

              <Frame className="strong" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="kicker" style={{ color: 'var(--acc)' }}>Multi-Inspector Consultancy</span>
                  <Pill kind="acc">Most Popular</Pill>
                </div>
                <div style={{ font: '700 34px/1 var(--fh)' }}>$69 <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--n6)' }}>/ inspector seat / mo</span></div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--n6)' }}>For regional safety firms, loss-control groups, and multi-site teams.</p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, flex: 1 }}>
                  <li>Up to 2 Owners + unlimited Supervisors &amp; Consultants</li>
                  <li><strong>Unlimited Free Admin seats</strong> (console dispatch &amp; QA)</li>
                  <li>Supervisor crew scoping &amp; shared co-attendee visits</li>
                  <li>Custom domain white-labeling &amp; custom form cloning</li>
                </ul>
                <Link href="/signup?plan=professional" className="btn btn-primary">Provision Consultancy →</Link>
              </Frame>

              <Frame style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="kicker">Enterprise / Captive / Association</div>
                <div style={{ font: '700 34px/1 var(--fh)' }}>Custom <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--n6)' }}>10+ field seats</span></div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--n6)' }}>For workers&apos; comp captives, trade associations, and national EHS teams.</p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, flex: 1 }}>
                  <li>Dedicated multi-tenant hierarchy &amp; custom S3 bucket</li>
                  <li>Custom proprietary form templates &amp; state citations</li>
                  <li>7-year archival SLA &amp; dedicated onboarding</li>
                  <li>SSO &amp; custom SMTP relay integration</li>
                </ul>
                <Link href="/signup?plan=enterprise" className="btn">Configure Enterprise Tenant →</Link>
              </Frame>
            </div>
          </div>
        </section>

        {/* Structured FAQ for SEO & AI / GEO Engines */}
        <section id="faq" style={{ padding: '52px 24px' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div className="kicker">Frequently Asked Questions</div>
              <h2 style={{ margin: '4px 0 0', font: '700 30px/1.1 var(--fh)', textTransform: 'uppercase', letterSpacing: '.02em' }}>
                Compliance, Licensing &amp; Technical Architecture
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {FAQS.map(f => (
                <Frame key={f.q} style={{ padding: '16px 20px' }}>
                  <h3 style={{ margin: '0 0 6px', font: '700 17px/1.25 var(--fh)', letterSpacing: '.02em', textTransform: 'uppercase' }}>{f.q}</h3>
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--n7)' }}>{f.a}</p>
                </Frame>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ background: 'var(--ink)', color: 'rgba(255,255,255,.7)', padding: '36px 24px', borderTop: '1px solid rgba(255,255,255,.15)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 24, alignItems: 'center' }}>
          <div>
            <div style={{ font: '700 16px var(--fh)', color: '#fff', letterSpacing: '.05em', textTransform: 'uppercase' }}>The Safety Alchemist</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Multi-Tenant EHS Inspection, Regulation Citation &amp; Abatement Platform · 7-Year Immutable Compliance Architecture
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12.5 }}>
            <Link href="/signup" style={{ color: '#fff' }}>New Consultancy Signup</Link>
            <Link href="/login" style={{ color: '#fff' }}>Staff Sign In</Link>
            <Link href="/portal" style={{ color: '#fff' }}>Member Client Portal</Link>
            <Link href="/field" style={{ color: '#fff' }}>Field Inspector App</Link>
            <Link href="/today" style={{ color: '#fff' }}>Staff Console</Link>
            <Link href="/platform" style={{ color: '#fff' }}>Platform Super-Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
