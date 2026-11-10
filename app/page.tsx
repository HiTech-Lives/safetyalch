import type { Metadata } from 'next';
import Link from 'next/link';
import { Frame, Pill } from '@/components/ui';
import { APP_VERSION, APP_VERSION_TAG } from '@/lib/version';

export const metadata: Metadata = {
  title: `The Safety Alchemist ${APP_VERSION_TAG} | Multi-Tenant EHS, Captive Loss-Control & 56-State OSHA Platform`,
  description:
    'White-labeled EHS, captive loss-control, and OSHA compliance platform. 21 Master Inspection Forms, Written Policy Gap Analyses & Captive Scorecards (1,051 items), 56-Jurisdiction OSHA Engine with live .gov verification, 12 Shield & Specialty Industry Lines, Dual-Plane Least-Privilege RBAC, Unified SSO, and 7-year immutable retention.',
  keywords: [
    'EHS inspection software',
    'workers comp captive loss control platform',
    'white-label OSHA audit software',
    'Cal/OSHA Title 8 IIPP gap analysis',
    '56 state plan OSHA regulation engine',
    'H-2A housing inspection checklist',
    'construction RCA jobsite safety audit',
    'agriculture safety inspection software',
    'multi-tenant safety management system',
    'least-privilege RBAC compliance software',
  ],
  alternates: { canonical: 'https://safetyalchemist.com/' },
  openGraph: {
    title: `The Safety Alchemist ${APP_VERSION_TAG} — Precision EHS, Captive Loss-Control & 56-State Compliance Platform`,
    description:
      'Run inspections, written policy gap analyses, and captive scorecards across 21 master templates (1,051 items), verify live .gov citations across all 56 US jurisdictions, govern Dual-Plane Least-Privilege RBAC, and preserve a 7-year immutable audit trail.',
    url: 'https://safetyalchemist.com/',
    siteName: 'The Safety Alchemist',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `The Safety Alchemist ${APP_VERSION_TAG} | Multi-Tenant EHS & Captive Loss-Control Software`,
    description:
      '21 Master Forms & Written Policies (1,051 items), 56-State OSHA Engine, 12 Shield & Specialty Industries, Dual-Plane RBAC, Gemini 3.1 Pro / AWS Bedrock AI routing, and $0 Admin & Portal seats.',
  },
};

const FORM_CATALOG = [
  // v0.0.3 Written Policy Gap Analyses & Captive / ARU Scorecards
  { code: 'GAP-IIPP', name: 'Written IIPP Policy Gap Analysis', industry: 'Cal/OSHA §3203 & Fed Program', qs: 20, scale: 'Policy Gap (Compliant / Partial / Missing)', focus: '8-element written IIPP audit, responsible administrator, hazard inspections & training records', isNew: true },
  { code: 'GAP-HEAT', name: 'Outdoor & Indoor Heat Illness Policy Gap', industry: 'AgShield · BuildShield · Warehousing', qs: 16, scale: 'Policy Gap (Compliant / Partial / Missing)', focus: '80°F shade, 95°F high-heat buddy procedures, indoor §3396 cool-down & acclimatization', isNew: true },
  { code: 'GAP-HAZ', name: 'Hazard Communication & GHS Written Program', industry: 'Cross-Industry (29 CFR 1910.1200 / §5194)', qs: 14, scale: 'Policy Gap (Compliant / Partial / Missing)', focus: 'Chemical inventory, SDS accessibility, secondary container GHS labeling & non-routine tasks', isNew: true },
  { code: 'LCE-100', name: 'Captive Loss Control Evaluation (100-Pt)', industry: 'SIG Captives · Ag & Commercial Pools', qs: 12, scale: '100-Pt Weighted Captive Scorecard', focus: 'Management commitment, claims trending, return-to-work, fleet controls & facility walk', isNew: true },
  { code: 'AUTO-SUP', name: 'Fleet & Driver Supervision Assessment', industry: 'FleetShield · Commercial Auto & DOT', qs: 9, scale: '1–5 Fleet Supervision Rating', focus: 'MVR screening, telematics coaching, distracted-driving policy, DVIRs & post-accident review', isNew: true },
  { code: 'RCA-JOB', name: 'Residential & Commercial Construction Audit (RCA)', industry: 'BuildShield · ARU Construction Specific', qs: 77, scale: '0–100% Weighted Jobsite Scorecard', focus: '12-section construction scorecard: fall protection, scaffolding, trenching, cranes, silica & subs', isNew: true },
  // Core 15 Standardized Field Checklists (903 Items)
  { code: 'BSA', name: 'Baseline Safety Assessment', industry: 'Cross-Industry Onboarding', qs: 53, scale: '4-Level Maturity (Absent → Owned)', focus: '12-month safety program roadmap without punitive due dates' },
  { code: 'IIP', name: 'Injury & Illness Prevention Field Walk', industry: 'Cross-Industry', qs: 59, scale: 'Safe / Unsafe / N/A', focus: 'Cal/OSHA Title 8 §3203 & federal field verification of written safety practices' },
  { code: 'GEN', name: 'General Industry Walk-Through', industry: 'WorkShield · Manufacturing & Industrial', qs: 66, scale: 'Safe / Unsafe / N/A', focus: '29 CFR 1910 egress, machine guarding, LOTO, HazCom, electrical' },
  { code: 'WHS', name: 'Warehouse & Distribution Center', industry: 'WorkShield · Logistics & Cold Storage', qs: 62, scale: 'Safe / Unsafe / N/A', focus: 'Rack integrity, dock locks, PIT/forklift lanes, charging stations' },
  { code: 'CFA', name: 'Construction Field Audit', industry: 'BuildShield · Commercial & Civil', qs: 68, scale: 'Safe / Unsafe / N/A', focus: '29 CFR 1926 fall protection, trenching, scaffolding, temp power' },
  { code: 'AGF', name: 'Agricultural Field Operations', industry: 'AgShield · Row Crops & Orchards', qs: 64, scale: 'Safe / Unsafe / N/A', focus: 'Heat illness (95°F high-heat), PTO guarding, WPS pesticide safety, field sanitation' },
  { code: 'PHP', name: 'Packing House & Processing', industry: 'AgShield · Food Processing & Cold Rooms', qs: 63, scale: 'Safe / Unsafe / N/A', focus: 'Conveyor nip points, ammonia/cold rooms, lockout, wet-floor drainage' },
  { code: 'DRY', name: 'Dairy & Livestock Facility', industry: 'AgShield · Dairy & Animal Ag', qs: 59, scale: 'Safe / Unsafe / N/A', focus: 'Parlor crowd gates, manure lagoon fencing, confined spaces, silage bunkers' },
  { code: 'H2A', name: 'H-2A Worker Housing Inspection', industry: 'AgShield · Employer-Provided Housing', qs: 58, scale: 'Safe / Unsafe / N/A', focus: 'DOL ETA / OSHA 1910.142 sq-ft per occupant, screens, water, fire exits' },
  { code: 'HHR', name: 'Hotel & Resort Operations', industry: 'ServeShield · Hospitality & Lodging', qs: 61, scale: 'Safe / Unsafe / N/A', focus: 'Housekeeping ergonomics, laundry chemical feed, pool mechanical rooms' },
  { code: 'HFA', name: 'Restaurant & Food Service', industry: 'ServeShield · Food & Beverage', qs: 58, scale: 'Safe / Unsafe / N/A', focus: 'Ansul hood suppression, Class K extinguishers, slicer guards, walk-in coolers' },
  { code: 'HGC', name: 'Golf Course & Grounds Maintenance', industry: 'ServeShield · Turf, Parks & Clubs', qs: 59, scale: 'Safe / Unsafe / N/A', focus: 'ROPS on mowers, turf chemical mixing/storage, reel grinder guarding' },
  { code: 'FIR', name: 'Fire Prevention & Life Safety', industry: 'Focused Audit', qs: 58, scale: 'Safe / Unsafe / N/A', focus: 'Extinguisher hydro-test, 18-in sprinkler clearance, exit discharge, hot work' },
  { code: 'ELC', name: 'Electrical Safety & LOTO', industry: 'Focused Audit', qs: 58, scale: 'Safe / Unsafe / N/A', focus: '36-in panel clearance, arc-flash labels, GFCI, cord strain relief, LOTO' },
  { code: 'FLK', name: 'Powered Industrial Trucks (Forklifts)', industry: 'FleetShield · Material Handling', qs: 57, scale: 'Safe / Unsafe / N/A', focus: '1910.178 pre-shift logs, data plates, eyewash at battery charging, LPG cages' },
];

const V003_HIGHLIGHTS = [
  {
    kicker: 'NEW IN V0.0.3 · STATUTORY ENGINE',
    title: '56-Jurisdiction US OSHA Directory + Live .gov Verification',
    body: 'Covers all 22 Full State Plans, 7 Public-Sector State Plans, 27 Federal OSHA States/Territories, and 6 Master Repositories (eCFR, OSHA, NIOSH, MSHA, EPA, DOT/FMCSA) with real-time SSRF-guarded statutory live-fetch.',
    href: '/regulations',
    cta: 'Open 56-State Regulation Engine →',
  },
  {
    kicker: 'NEW IN V0.0.3 · INDUSTRY TAXONOMY',
    title: '5 Core Shield Lines + 7 Specialty Industries (32 Sub-Sectors)',
    body: 'Ships with AgShield, BuildShield, WorkShield, ServeShield, and FleetShield plus Healthcare, Municipal, Maritime, Energy/Utilities, Cannabis/CEA, Education, and Events—plus an extensible Platform & Tenant Industry Builder.',
    href: '/settings/taxonomy',
    cta: 'Explore Shield & Specialty Taxonomy →',
  },
  {
    kicker: 'NEW IN V0.0.3 · FORM & POLICY BUILDER',
    title: 'Create & Edit Master Forms, Written Policies & Scorecards',
    body: 'Platform Compliance Editors and Tenant Admins can author scratch forms, clone master templates, manage questions, and run 6 distinct scoring scales including Written Policy Gap Analysis, 100-Pt LCE, 1–5 Auto, and 0–100% RCA.',
    href: '/forms',
    cta: 'Open Forms & Policy Builder →',
  },
  {
    kicker: 'NEW IN V0.0.3 · ZERO-TRUST IDENTITY',
    title: 'Dual-Plane Least-Privilege RBAC, Unified SSO & User Directory',
    body: 'Strictly separates SaaS Platform Operators (platform_users) from Tenant Workspaces (users) with explicit ALLOW/DENY ACL matrices, a Global Cross-Tenant User Directory, $0 Complimentary Platform-Attached Seats, and 60-min Support Sessions.',
    href: '/platform',
    cta: 'Open Platform Control Plane →',
  },
  {
    kicker: 'NEW IN V0.0.3 · CAPTIVE GOVERNANCE',
    title: 'Customizable SIG "Gems", 3-Level Hierarchy & Watchlist',
    body: 'Each tenant customizes its own portfolio terminology (e.g., SIG Captive "Gems" CAN/CAP/CCN/CFM/CLP/CRMBC + Retail RSA or Consultancy Portfolios), 3-level Corporate → Regional → Site hierarchy, and 4-tier Green–Red Watchlist.',
    href: '/members',
    cta: 'Inspect Captive Hierarchy & Gems →',
  },
  {
    kicker: 'NEW IN V0.0.3 · EXECUTIVE DELIVERABLES & AI',
    title: '4 Audience Report Modes, Book of Recs & Gemini 3.1 Pro',
    body: 'Switch any report live between Full Consultation, 30-Day Board Mandate, Broker Summary, and Executive Redacted modes; issue encrypted share links; pull from the Book of Recommendations; and route AI tasks to Gemini 3.1 Pro, AWS Bedrock, or Azure.',
    href: '/settings/ai',
    cta: 'Configure Multi-Cloud AI Router →',
  },
];

const DEMOGRAPHICS = [
  {
    kicker: 'EHS & LOSS-CONTROL CONSULTANCIES',
    title: 'Independent Safety Consultancies & Fractional EHS Firms',
    body: 'Deliver every inspection report, written policy gap analysis, corrective-action notice, and client portal under your own brand, custom domain, and WCAG AA-guarded accent color. Add unlimited Team Admins and Read-Only Viewers at $0.',
    metrics: '100% White-Labeled · Custom Form Builder · $0 Admin & Viewer Seats',
  },
  {
    kicker: 'WORKERS’ COMP CAPTIVES & SIG POOLS',
    title: 'Self-Insured Groups (SIGs), Captive Pools & Underwriting Teams',
    body: 'Organize members by customizable Captive "Gems" or Retail RSA portfolios, track 4-tier Watchlist escalations, generate 30-Day Board-Action Mandates and 100-Point LCE scorecards, and preserve a 7-year tamper-proof audit trail.',
    metrics: '56 Jurisdictions · SIG Gems & Watchlist · 4 Report Audience Modes',
  },
  {
    kicker: 'AGRICULTURE, DAIRY & H-2A EMPLOYERS',
    title: 'Growers, Packing Houses, Dairies & H-2A Housing Operators',
    body: 'Purpose-built AgShield templates for Field Ag (AGF), Packing Houses (PHP), Dairies (DRY), H-2A Housing (H2A), and Outdoor/Indoor Heat Policy Gap (GAP-HEAT) with numeric threshold auto-checks (ft², foot-candles, °F, inches).',
    metrics: 'AgShield Sub-Sectors · Auto-Evaluated Measurements · State-Plan First',
  },
  {
    kicker: 'CONSTRUCTION, FLEET, WAREHOUSE & HOSPITALITY',
    title: 'Contractors (RCA), Fleet Operators, 3PLs & Hospitality Groups',
    body: 'Run weighted 77-item Construction Jobsite Scorecards (RCA-JOB) and Fleet Supervision Ratings (AUTO-SUP). Site managers respond via passwordless magic links to upload abatement photos or sign formal Risk Assumed declarations.',
    metrics: 'BuildShield & FleetShield · Passwordless Client Portal · Zero Client Fees',
  },
];

const FAQS = [
  {
    q: 'What is The Safety Alchemist and how is it different from generic checklist apps?',
    a: 'The Safety Alchemist is a multi-tenant occupational safety, captive loss-control, and regulatory compliance platform. Unlike generic form builders, v0.0.3 ships with 21 calibrated Master Templates (1,051 items across 6 scoring engines), a 56-Jurisdiction US State/Territory OSHA Engine with live .gov verification, 12 Shield & Specialty Industry Lines, Dual-Plane Least-Privilege RBAC, and database-enforced 7-year immutability triggers.',
  },
  {
    q: 'How are SaaS Platform Admins and Tenant Team Admins separated in v0.0.3?',
    a: 'Platform Operators (platform_users) and Tenant Staff (users) live in strictly isolated database tables, session cookies, and explicit ALLOW/DENY Least-Privilege ACL matrices—unified through a Single Entry Point SSO login (/login). Platform Super-Admins can view a Global Cross-Tenant User Directory, launch 60-minute ticketed Support Sessions, or attach operators to client workspaces as $0 Complimentary Seats that consume zero client licenses.',
  },
  {
    q: 'Can Platform Editors and Team Admins build or customize their own forms and written policies?',
    a: 'Yes. Platform Compliance Editors can author, edit, and archive global Master Forms and Written Policy Gap Analyses inherited by every workspace, while Tenant Owners and Team Admins can create custom workspace-specific forms or clone any Master Template to add, edit, or reorder questions across all 6 scoring scales.',
  },
  {
    q: 'Which OSHA and State-Plan jurisdictions are supported?',
    a: 'All 56 US states, commonwealths, and territories plus 6 Federal Master Statutory Repositories (eCFR, Federal OSHA, NIOSH, MSHA, EPA, DOT/FMCSA). Every site carries its jurisdiction code so findings resolve State-Plan rules first (e.g., Cal/OSHA Title 8, WA L&I DOSH, OR-OSHA, MIOSHA) with automatic Federal 29 CFR fallback and live .gov citation verification.',
  },
  {
    q: 'How does per-inspector seat pricing work, and which seats are $0?',
    a: 'Workspaces only pay for seats that conduct field work or underwriting (Owners, Supervisors, Consultants, and Underwriting). Team Admins, Read-Only Viewers, Platform-Attached Complimentary Operators, and unlimited Member Client Portal contacts are $0.',
  },
  {
    q: 'What are the 4 Multi-Audience Report Modes introduced in v0.0.3?',
    a: 'Every completed assessment can be rendered or shared via time-boxed encrypted link in four audience-tailored layouts: Full Consultation Report (complete technical narrative & citations), 30-Day Board-Action Mandate (high-priority captive governance view), Broker Summary (concise renewal & watch-tier digest), and Executive Redacted (leadership overview with internal notes stripped).',
  },
];

export default function PublicLandingPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'The Safety Alchemist',
        softwareVersion: APP_VERSION,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'EHS, Captive Loss-Control & Occupational Safety Compliance Software',
        operatingSystem: 'Web, iOS, iPadOS, Android (PWA)',
        url: 'https://safetyalchemist.com',
        description:
          'Multi-tenant EHS safety inspection, written policy gap analysis, captive scorecard, 56-jurisdiction OSHA citation, and corrective-action platform.',
        offers: {
          '@type': 'Offer',
          price: '79.00',
          priceCurrency: 'USD',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: '79.00',
            priceCurrency: 'USD',
            unitText: 'per active field inspector seat / month (Team Admins, Viewers & Member Client Portals free)',
          },
        },
        featureList: [
          '21 Master Inspection Forms, Written Policy Gap Analyses & Captive Scorecards (1,051 items across 6 scoring engines)',
          'Platform & Tenant Custom Form / Policy Builder with question-level CRUD and cloning',
          '56-Jurisdiction US State/Territory OSHA Plan Directory + 6 Master Statutory Repositories with live .gov verification',
          '12 Global Industry Lines (5 Core Shield + 7 Specialty) & 32 Sub-Sectors with custom tenant taxonomy builder',
          'Dual-Plane Least-Privilege RBAC, Unified SSO, Global Cross-Tenant User Directory & 60-min Audited Support Sessions',
          '4 Multi-Audience Report Modes (Full, 30-Day Board Mandate, Broker Summary, Executive Redacted) + Encrypted Share Links',
          '6-Need Multi-Cloud AI Router supporting Gemini 3.1 Pro, AWS Bedrock (Qwen / Nova), Azure AI Foundry & ElevenLabs Voice AI',
          'Database-enforced 7-year immutable inspection, answer, audit log & citation retention',
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
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '12px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
          <Link href="/" aria-label="The Safety Alchemist Home" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
            <img src="/brand/logo.png" alt="The Safety Alchemist" style={{ height: 32, filter: 'brightness(0) invert(1)' }} />
            <span style={{ font: '600 10px var(--mono)', padding: '2px 6px', border: '1px solid rgba(255,255,255,.3)', color: 'var(--sand)' }}>
              {APP_VERSION_TAG}
            </span>
          </Link>
          <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 15, fontSize: 12.5, color: 'rgba(255,255,255,.8)', marginLeft: 6 }}>
            <a href="#v003" style={{ color: 'var(--sand)', fontWeight: 600 }}>New in {APP_VERSION_TAG}</a>
            <a href="#demographics" style={{ color: 'inherit' }}>Who We Serve</a>
            <a href="#forms" style={{ color: 'inherit' }}>21 Forms &amp; Policies</a>
            <a href="#loss-control-os" style={{ color: 'inherit' }}>Loss Control OS</a>
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
              Unified SSO Sign In
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
                <Pill kind="solid">{APP_VERSION_TAG} · Dual-Plane EHS &amp; Captive SaaS</Pill>
                <Pill kind="acc">56 US Jurisdictions · 12 Shield &amp; Specialty Lines</Pill>
              </div>
              <h1 style={{ margin: 0, font: '700 clamp(34px, 4.5vw, 52px)/1.03 var(--fh)', letterSpacing: '.02em', textTransform: 'uppercase' }}>
                Turn Field Audits, Policy Reviews &amp; Captive Scorecards Into 7-Year Immutable Compliance Records.
              </h1>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: 'var(--n7)', maxWidth: 650 }}>
                Purpose-built for <strong>safety consultancies</strong>, <strong>SIG workers&apos; comp captives</strong>, and <strong>multi-site employers</strong> across 12 Shield &amp; Specialty industry lines. Author custom forms &amp; written policy gap analyses, verify live <code>.gov</code> OSHA citations across all 56 US jurisdictions, govern least-privilege RBAC across Platform &amp; Team planes, and deliver audience-tailored reports.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, paddingTop: 4 }}>
                <Link href="/signup" className="btn btn-primary" style={{ height: 44, padding: '0 22px', fontSize: 13 }}>
                  Launch Your Consultancy Account
                </Link>
                <Link href="/login" className="btn" style={{ height: 44, padding: '0 20px', fontSize: 13 }}>
                  Unified SSO &amp; Demo Sign In →
                </Link>
                <Link href="/portal" className="btn" style={{ height: 44, padding: '0 18px', fontSize: 13 }}>
                  View Member Client Portal
                </Link>
              </div>
              <div className="kicker" style={{ color: 'var(--n6)' }}>
                Pay only per field seat · Unlimited $0 Team Admins &amp; Viewers · $0 Platform-Attached Support Seats · $0 Client Portals
              </div>
            </div>

            {/* Interactive Platform Surface Directory Card */}
            <Frame className="strong" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--ink)', paddingBottom: 10 }}>
                <span style={{ font: '700 14px var(--fh)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                  Platform Surface Directory · {APP_VERSION_TAG}
                </span>
                <Pill kind="verified">Dual-Plane + PWA</Pill>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--n6)', lineHeight: 1.5 }}>
                Unified Single Entry Point SSO routes Platform Operators, Tenant Staff, Field Consultants, and Member Contacts into isolated, least-privilege surfaces:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Link href="/today" className="frame" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--ink)' }}>
                  <div>
                    <div className="kicker" style={{ color: 'var(--acc)' }}>1 · Tenant Workspace Console (/today · /team)</div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 2 }}>Customizable Gems, Forms Builder, User ACLs &amp; 4 Report Modes</div>
                    <div className="sub">Manage Captive Gems/Portfolios, 3-level hierarchies, custom forms, AI intake &amp; QA review.</div>
                  </div>
                  <span style={{ font: '700 13px var(--fh)' }}>OPEN →</span>
                </Link>
                <Link href="/field" className="frame" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--ink)' }}>
                  <div>
                    <div className="kicker" style={{ color: 'var(--ok)' }}>2 · Multi-Scale Field &amp; Policy Runner (/field)</div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 2 }}>6 Scoring Engines, Quick Capture &amp; Voice-to-Report</div>
                    <div className="sub">Safe/Unsafe, Policy Gap, 100-Pt LCE, 1–5 Auto, 0–100% RCA Jobsite &amp; 4-Level Maturity.</div>
                  </div>
                  <span style={{ font: '700 13px var(--fh)' }}>LAUNCH →</span>
                </Link>
                <Link href="/portal" className="frame" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--ink)' }}>
                  <div>
                    <div className="kicker" style={{ color: 'var(--warn7)' }}>3 · Customer Member Portal (/portal)</div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 2 }}>Passwordless Abatement &amp; Encrypted Share Links</div>
                    <div className="sub">Clients view audience-scoped reports, upload proof photos, or sign Risk Assumed in writing.</div>
                  </div>
                  <span style={{ font: '700 13px var(--fh)' }}>VIEW →</span>
                </Link>
                <Link href="/platform" className="frame" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--ink)' }}>
                  <div>
                    <div className="kicker">4 · SaaS Control Plane (/platform)</div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 2 }}>Global User Directory, Least-Privilege ACLs &amp; Master Library</div>
                    <div className="sub">Attach operators to teams ($0), govern 56-state regulations, master forms &amp; 60-min support sessions.</div>
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
              ['21', 'Master Forms & Policies', '15 field checklists + 6 written policy gap & captive/RCA scorecards (1,051 items)'],
              ['56 + 6', 'Jurisdictions & Statutory Repos', 'All 56 US State/Territory OSHA plans + 6 federal repositories with live .gov fetch'],
              ['12 / 32', 'Industry Lines & Sub-Sectors', '5 Core Shield Lines + 7 Specialty Industries + custom tenant taxonomy builder'],
              ['7 Years', 'Immutable Record Retention', '14 MySQL 8 triggers lock submitted answers, audit logs & verified citations'],
              ['$0', 'Admin, Viewer & Portal Seats', 'Free Team Admins, Viewers, Client Portals & Complimentary Platform-Attached seats'],
            ].map(([v, k, h]) => (
              <div key={k} className="frame stat">
                <div className="kicker">{k}</div>
                <div className="v">{v}</div>
                <div className="h">{h}</div>
              </div>
            ))}
          </div>
        </section>

        {/* NEW IN v0.0.3 CAPABILITY SHOWCASE */}
        <section id="v003" style={{ padding: '52px 24px', borderBottom: '1px solid var(--div)', background: 'var(--bg)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
              <div>
                <div className="kicker" style={{ color: 'var(--acc)' }}>Release {APP_VERSION_TAG} · Platform &amp; Compliance Expansion</div>
                <h2 style={{ margin: '4px 0 0', font: '700 30px/1.1 var(--fh)', textTransform: 'uppercase', letterSpacing: '.02em' }}>
                  What&apos;s New in The Safety Alchemist {APP_VERSION_TAG}
                </h2>
              </div>
              <Pill kind="ink">53 MySQL 8 Tables · AES-256-GCM Vault · Gemini 3.1 Pro Ready</Pill>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
              {V003_HIGHLIGHTS.map(item => (
                <Frame key={item.title} className="strong" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <div className="kicker" style={{ color: 'var(--acc)' }}>{item.kicker}</div>
                  <h3 style={{ margin: 0, font: '700 18px/1.2 var(--fh)', textTransform: 'uppercase' }}>{item.title}</h3>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--n7)', flex: 1 }}>{item.body}</p>
                  <Link href={item.href} className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--acc)', paddingTop: 4 }}>
                    {item.cta}
                  </Link>
                </Frame>
              ))}
            </div>
          </div>
        </section>

        {/* Demographic Targeting Section */}
        <section id="demographics" style={{ padding: '52px 24px', background: '#fff', borderBottom: '1px solid var(--div)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <div className="kicker">Built for High-Compliance Industries, Captives &amp; Advisory Firms</div>
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

        {/* 21 Master Inspection Forms, Written Policies & Scorecards Catalog */}
        <section id="forms" style={{ padding: '52px 24px', borderBottom: '1px solid var(--div)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
              <div>
                <div className="kicker">Master Library · 1,051 Calibrated Items + Custom Form &amp; Policy Builder</div>
                <h2 style={{ margin: '4px 0 0', font: '700 30px/1.1 var(--fh)', textTransform: 'uppercase', letterSpacing: '.02em' }}>
                  21 Ready-to-Run Checklists, Written Policy Gap Analyses &amp; Captive Scorecards
                </h2>
              </div>
              <Link href="/forms" className="btn btn-sm">Open Forms &amp; Written Policy Builder →</Link>
            </div>
            <div className="tbl-wrap">
              <table className="tbl" style={{ minWidth: 920 }}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Template / Policy Name</th>
                    <th>Shield Line / Target Sector</th>
                    <th>Items</th>
                    <th>Scoring Engine</th>
                    <th>Regulatory &amp; Operational Focus</th>
                  </tr>
                </thead>
                <tbody>
                  {FORM_CATALOG.map(f => (
                    <tr key={f.code}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Pill kind="solid">{f.code}</Pill>
                          {f.isNew && <Pill kind="acc">v0.0.3</Pill>}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{f.name}</td>
                      <td>{f.industry}</td>
                      <td className="num">{f.qs}</td>
                      <td><Pill kind={f.isNew || f.code === 'BSA' ? 'acc' : 'line'}>{f.scale}</Pill></td>
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
                <div className="kicker" style={{ color: 'var(--acc)' }}>6 · Gemini 3.1 Pro, AWS Bedrock, Azure &amp; ElevenLabs</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>AES-256-GCM Vault, Receipt OCR &amp; Safe Billing CSV</div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--n6)', lineHeight: 1.55 }}>
                  Route each of the 6 AI workflows independently across <strong>Gemini 3.1 Pro</strong>, <strong>AWS Bedrock (Qwen / Nova)</strong>, <strong>Azure AI Foundry</strong>, and <strong>ElevenLabs Scribe/Flash</strong>, with AES-256-GCM encrypted tenant API keys and formula-sanitized CSV exports.
                </p>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <Link href="/timesheets" className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--acc)' }}>
                    Timesheets &amp; Billing CSV →
                  </Link>
                  <Link href="/settings/ai" className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
                    Multi-Cloud AI Router →
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
              <div className="kicker">Why Consultancies &amp; Captives Switch to The Safety Alchemist</div>
              <h2 style={{ margin: '4px 0 0', font: '700 30px/1.1 var(--fh)', textTransform: 'uppercase', letterSpacing: '.02em' }}>
                Purpose-Built Compliance Architecture vs. Generic Form Builders
              </h2>
            </div>
            <div className="tbl-wrap">
              <table className="tbl" style={{ minWidth: 820 }}>
                <thead>
                  <tr>
                    <th>Capability</th>
                    <th>The Safety Alchemist ({APP_VERSION_TAG})</th>
                    <th>Generic Checklist Apps</th>
                    <th>Word / Excel / PDFs</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Dual-Plane Least-Privilege RBAC & SSO', 'Isolated Platform & Team ACL matrices + $0 attached ops', 'Flat workspace roles only', 'Shared folder permissions'],
                    ['56-State OSHA Citation & Live .gov Verify', '56 jurisdictions + 6 repos with live .gov fetch & superseding', 'Manual copy-paste or static text', 'Manual lookup every report'],
                    ['Custom Forms, Policy Gap & Captive Scorecards', '21 master templates + scratch/clone builder across 6 scales', 'Basic pass/fail checklists only', 'Disconnected spreadsheets'],
                    ['7-Year Audit Immutability & Citation Retention', '14 MySQL 8 triggers lock submitted answers & verified rules', 'Editable anytime; overwrites history', 'Uncontrolled file versions'],
                    ['Multi-Audience Executive Deliverables', '4 live report modes (Board 30-Day, Broker, Redacted, Full)', 'Single static export', 'Manual copy-edit per recipient'],
                    ['Admin, Viewer & Client Portal Licensing', '100% Free ($0 Team Admins, Viewers & Magic-Link Portals)', 'Charged per user seat', 'Lost in email threads'],
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
                  <li>All 21 Master Forms, Policies &amp; Scorecards (1,051 items)</li>
                  <li>56-State OSHA Engine + custom form builder</li>
                  <li>Unlimited Members, sites &amp; magic-link portals</li>
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
                  <li><strong>Unlimited $0 Team Admin &amp; Viewer seats</strong></li>
                  <li>Least-Privilege User ACLs, Crew Scoping &amp; Custom Taxonomies</li>
                  <li>4 Multi-Audience Report Modes &amp; Custom Domain Branding</li>
                </ul>
                <Link href="/signup?plan=professional" className="btn btn-primary">Provision Consultancy →</Link>
              </Frame>

              <Frame style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="kicker">Enterprise / Captive / SIG Pool</div>
                <div style={{ font: '700 34px/1 var(--fh)' }}>Custom <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--n6)' }}>10+ field seats</span></div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--n6)' }}>For workers&apos; comp captives, SIG pools, trade associations, and national EHS teams.</p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, flex: 1 }}>
                  <li>Customizable SIG &ldquo;Gems&rdquo; + 3-Level Corporate Hierarchy</li>
                  <li>4-Tier Captive Watchlist &amp; 30-Day Board Mandate Reports</li>
                  <li>Enterprise OIDC / SAML SSO &amp; Verified Custom SMTP</li>
                  <li>7-year immutable archival SLA &amp; dedicated onboarding</li>
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
                Compliance, Dual-Plane RBAC &amp; Technical Architecture
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
            <div style={{ font: '700 16px var(--fh)', color: '#fff', letterSpacing: '.05em', textTransform: 'uppercase' }}>
              The Safety Alchemist · {APP_VERSION_TAG}
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Multi-Tenant EHS, Captive Loss-Control &amp; 56-State OSHA Compliance Platform · Dual-Plane Least-Privilege RBAC · 7-Year Immutable Architecture
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12.5 }}>
            <Link href="/signup" style={{ color: '#fff' }}>New Consultancy Signup</Link>
            <Link href="/login" style={{ color: '#fff' }}>Unified SSO Sign In</Link>
            <Link href="/portal" style={{ color: '#fff' }}>Member Client Portal</Link>
            <Link href="/field" style={{ color: '#fff' }}>Field Inspector App</Link>
            <Link href="/today" style={{ color: '#fff' }}>Workspace Console</Link>
            <Link href="/platform" style={{ color: '#fff' }}>Platform Control Plane</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
