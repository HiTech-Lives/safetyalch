# The Safety Alchemist (`v0.0.3`)

![Version](https://img.shields.io/badge/version-v0.0.3-241f1c)
![Next.js](https://img.shields.io/badge/Next.js-16.4-000000)
![React](https://img.shields.io/badge/React-19.3-1f4f6e)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6)
![MySQL](https://img.shields.io/badge/MySQL-8.0%2B-4479a1)

**Multi-Tenant EHS Inspection, Captive Loss-Control, 56-Jurisdiction Regulation & Abatement Platform**  
Built with **Next.js 16.4 (App Router)**, **React 19.3**, **TypeScript**, and **MySQL 8** (`53` tables · `14` compliance & immutability triggers).

The Safety Alchemist is a white-labeled, multi-tenant B2B SaaS platform engineered for **safety consultancies**, **workers' compensation Self-Insured Groups (SIGs) & captives**, **trade associations**, and **multi-site employers** across **12 Core Shield & Specialty Industry Lines** and **32 Sub-Sectors**.

---

## What's New in `v0.0.3`

- **Dual-Plane Least-Privilege RBAC & Unified SSO (`/login`, `/platform`, `/team`)**:
  - Strict database, session-cookie (`sa_plat_session` vs. `sa_session`), and ACL isolation between **Plane 1 — SaaS Platform Operators** (`platform_users`, `platform_user_acl`) and **Plane 2 — Tenant Workspaces** (`users`, `tenant_role_permissions`, `user_permission_overrides`, `user_group_scopes`).
  - **Unified Single Entry Point SSO** (`/login`) with OIDC/SAML domain discovery and a left-sidebar **Plane / Workspace Switcher** scoped strictly to verified email memberships.
  - **Global Cross-Tenant Identity Directory & `$0` Complimentary Platform-Attached Seats**: View every Platform Operator and Team User across all workspaces in `/platform`, promote tenant users to the Platform Control Plane, or attach Platform Operators directly to any Team Workspace as **Complimentary (`$0` / `0` client seats consumed)** regardless of Team role (`is_complimentary_seat = 1`).
  - **Time-Boxed 60-Minute Audited Support Sessions**: Ticket-reason-mandated support impersonation (`platform_impersonation_sessions`) dual-logged in `platform_audit_log` and tenant `audit_log`.
- **56-Jurisdiction US State/Territory OSHA Engine + 6 Master Statutory Repositories (`/regulations`)**:
  - Pre-seeded directory of **22 Full State Plans**, **7 Public-Sector State Plans**, **27 Federal OSHA States/Territories**, and **6 Master Statutory Repositories** (`eCFR`, `Federal OSHA`, `NIOSH`, `MSHA`, `EPA`, `DOT/FMCSA`).
  - **Real-Time `.gov` Live-Fetch Verification** (`/api/regulations/live-fetch`) protected by DNS-pinned SSRF guards, paired with immutable `regulations_never_edit` superseding.
- **12 Industry Lines (5 Shield + 7 Specialty), 32 Sub-Sectors & Custom Taxonomy Builder (`/platform`, `/settings/taxonomy`)**:
  - **5 Core Shield Lines** (`AgShield`, `BuildShield`, `WorkShield`, `ServeShield`, `FleetShield`) + **7 Specialty Lines** (Healthcare, Public Entity/Municipal, Maritime, Energy/Utilities, Cannabis/CEA, Education, Entertainment/Events).
  - Extensible **Global Industry Builder** on `/platform` plus **Workspace Custom Industry, Sub-Sector & Portfolio Group Builder** on `/settings/taxonomy`.
- **Customizable Captive "Gems", 3-Level Company Hierarchy & 4-Tier Watchlist (`/members`, `/settings/taxonomy`)**:
  - Per-tenant portfolio terminology & presets (`Standard Consultancy`, `SIG Captive "Gems" + Retail RSA` [`CAN`, `CAP`, `CCN`, `CFM`, `CLP`, `CRMBC`, `RSA`], or `Blank`).
  - **3-Level Member Hierarchy** (`Corporate Parent → Regional/Subsidiary Entity → Operating Sites`) + **4-Tier Captive Watchlist** (`Green`, `Yellow`, `Orange`, `Red`) + operational flags.
- **Platform & Team Form / Written Policy Builder + 6 New Master Templates (`21` Total · `1,051` Items)**:
  - Full CRUD to create scratch forms/policies, clone Master templates, edit metadata, archive templates, and add/edit/delete questions at both the **Master Library** (`tenant_id IS NULL`) and **Tenant Workspace** levels (`/forms`, `/forms/[code]`).
  - **6 Scoring Engines** supported end-to-end in `/field/[id]`: `Safe / Unsafe / N/A`, `4-Level Maturity`, `Written Policy Gap Analysis`, `100-Pt Captive Loss Control (LCE-100)`, `1–5 Fleet Supervision (AUTO-SUP)`, and `0–100% Weighted Construction Scorecard (RCA-JOB, 77 items)`.
- **4 Multi-Audience Report Modes, Encrypted Share Links, Book of Recommendations & Gemini 3.1 Pro**:
  - Render or share reports in **`Full Consultation`**, **`30-Day Board-Action Mandate`**, **`Broker Summary`**, or **`Executive Redacted`** mode, backed by a standardized **Book of Recommendations** (`book_recommendations`) and time-boxed encrypted **Share Links** (`report_share_links`).
  - Added **Google Gemini 3.1 Pro (`gemini-3.1-pro-preview`)** and **Gemini 2.5 Flash** to the 6-Need Multi-Cloud AI Router alongside AWS Bedrock (`Qwen` / `Nova`), Azure AI Foundry, and ElevenLabs Voice AI, with **AES-256-GCM encrypted** tenant API credentials (`ai_credentials_enc`).
- **Security Hardening & Automated Verification**:
  - Database-backed revocable `HttpOnly` sessions, SSRF private-IP/IMDS blocking, binary magic-byte upload validation (`PNG`/`JPEG`/`WebP`/`PDF` — blocks SVG XSS), CSV formula-injection sanitization, CSP/frame headers, idempotent `npm run db:migrate`, and automated `npm run db:verify`.

---

## Platform Architecture & Connected Surfaces

| Surface | Primary Routes | Audience & Capabilities |
| :--- | :--- | :--- |
| **1. Public Marketing, Pricing & Unified SSO** | `/`, `/login`, `/signup`, `/robots.txt`, `/sitemap.xml` | SEO/GEO-optimized `v0.0.3` landing page (`SoftwareApplication`, `Organization`, `FAQPage` JSON-LD), 21-template matrix, Unified Single Entry Point SSO with OIDC/SAML discovery, and 3-step self-service workspace provisioning wizard. |
| **2. SaaS Platform Control Plane (Plane 1)** | `/platform`, `/forms`, `/regulations` | Strictly isolated `platform_users` control plane: Tenant provisioning, Least-Privilege Platform Operator CRUD & `ALLOW`/`DENY` ACLs, **All Users & Memberships** Global Identity Directory, 1-click `$0` Complimentary Team Attachment, 60-min Audited Support Sessions, Global Shield/Specialty Industry Builder, Master Forms/Policies Builder, and 56-Jurisdiction Regulation Engine. |
| **3. Loss Control & Dispatch Console (Plane 2)** | `/work-queue`, `/engagements`, `/assignments`, `/observations`, `/timesheets`, `/settings/ai` | **Work Queue** (`Received → Scheduled → Visit Done → In QC → Delivered → Billed`) with **"New from email"** AI intake, **3-Tier Engagements & Draw-Down Budgets**, **Qualification-Aware Staffing** (`CSP`, `CIH`, `ALCM`, `ARM`, `OSHA 500/510`), **Timesheets & Sanitized Billing/Payroll CSVs**, and **6-Need Multi-Cloud AI Routing**. |
| **4. Compliance & Workspace Console (Plane 2)** | `/today`, `/schedule`, `/inspections`, `/recommendations`, `/members`, `/team`, `/settings/taxonomy`, `/brand`, `/billing` | Operations hub for **Owners**, **Team Admins** (`$0` seat), **Supervisors**, **Consultants**, **Underwriting**, and **Viewers** (`$0` seat). Manage customizable Captive Gems/Portfolios, 3-level corporate hierarchies, custom forms/policies, Book of Recommendations, 4-mode executive reports, user ACL overrides, and white-label branding. |
| **5. Multi-Scale Field Inspector PWA** | `/field/route`, `/field/capture`, `/field/quick-report`, `/field/jobs`, `/field`, `/field/[id]` | Ordered **Today's Route** with 1-tap visit confirmations, **AI Quick Capture** (numbered photos + voice memo STT + paired `29 CFR` & State citations), **AI Quick Report ("In the Truck")** with ElevenLabs audio readback, **Receipt OCR**, and the **6-Engine Assessment Runner** across all 21+ forms. |
| **6. Passwordless Client & Broker Touchpoints** | `/confirm-visit/[token]`, `/portal`, `/portal/[token]` | **No-Login Site Visit Confirmation**, **White-Labeled Member Client Portal** for photo abatement & signed **Risk Assumed** declarations, and **Time-Boxed Encrypted Report Share Links** scoped to specific audience modes. |

---

## Dual-Plane Least-Privilege RBAC & Seat Model

### Plane 1 · SaaS Platform Operators (`platform_users` + `platform_user_acl`)
- **Roles**: `platform_super_admin` (all 10 permissions), `platform_ops_admin`, `platform_compliance_editor`, `platform_support_viewer` (least-privilege base).
- **Explicit Override Precedence**: `Explicit DENY` > `Explicit ALLOW` > `Base Role Default`.
- **Cross-Plane Attachment**: Platform Super-Admins can attach any operator to a client workspace via `/platform` with **`is_complimentary_seat = 1`** (`$0` / `0` client seats consumed) while preserving Unified SSO password sync.

### Plane 2 · Tenant Workspace Staff (`users` + `tenant_role_permissions` + `user_permission_overrides`)
- **Owners** (max `2` active per workspace, enforced by MySQL trigger `users_max_two_owners`): Full workspace, billing, and ACL authority.
- **Team Admins** (`$0` free seat, unlimited): Console dispatch, QA wording review, custom forms, and taxonomy management; cannot submit field inspections.
- **Supervisors** (paid seat): Crew-scoped (`crewIds`) oversight, scheduling, and inspections.
- **Consultants** (paid seat): Assigned-Member & portfolio-group scoped field inspections and quick reports.
- **Underwriting** (paid seat): Captive watchlist, loss-control scorecards, and broker/board report access.
- **Viewers** (`$0` free seat, unlimited): Read-only console visibility.

---

## Master Library: 21 Templates (`1,051` Items · 6 Scoring Engines)

### Written Policy Gap Analyses & Captive / ARU Scorecards (`v0.0.3`)
- `GAP-IIPP` — **Written IIPP Policy Gap Analysis** (`20` items · *Compliant / Partial / Missing / N/A* · Cal/OSHA Title 8 §3203 & Fed)
- `GAP-HEAT` — **Outdoor & Indoor Heat Illness Policy Gap** (`16` items · *Compliant / Partial / Missing / N/A* · §3395 / §3396)
- `GAP-HAZ` — **Hazard Communication & GHS Written Program** (`14` items · *Compliant / Partial / Missing / N/A* · 29 CFR 1910.1200 / §5194)
- `LCE-100` — **Captive Loss Control Evaluation** (`12` items · *100-Point Weighted Captive Scorecard*)
- `AUTO-SUP` — **Fleet & Driver Supervision Assessment** (`9` items · *1–5 Fleet Supervision Rating*)
- `RCA-JOB` — **Residential & Commercial Construction Audit (RCA)** (`77` items · *0–100% Weighted 12-Section Jobsite Scorecard*)

### Standardized Field Inspection Checklists (`903` Items · `249` Shared `SHR-*` Repeat-Hazard Keys)
- `BSA` (53 · *4-Level Maturity*), `IIP` (59), `GEN` (66), `WHS` (62), `CFA` (68), `AGF` (64), `PHP` (63), `DRY` (59), `H2A` (58), `HHR` (61), `HFA` (58), `HGC` (59), `FIR` (58), `ELC` (58), `FLK` (57).

---

## Per-Need Multi-Cloud AI Routing (`/settings/ai`)

Administrators can route each of the **6 platform AI workflows** independently across **Google Gemini (`gemini-3.1-pro-preview`, `gemini-2.5-flash`)**, **AWS Bedrock (`Qwen 2.5 32B / VL 72B`, `Amazon Nova`)**, **Azure AI Foundry**, **ElevenLabs (`scribe_v1` STT & `eleven_flash_v2_5` TTS)**, **Anthropic**, **OpenAI / vLLM**, or the zero-latency **Built-In Deterministic Engine**:

1. **Need 01 — Email-to-Job Intake (`"Read it"`, `/work-queue`)**
2. **Need 02 — Quick Report Narrative Drafting (`"In the Truck"`, `/field/quick-report`)**
3. **Need 03 — Field Photo Vision & OSHA/State Citation Pairing (`/field/capture`)**
4. **Need 04 — Expense Receipt OCR Scanner (`/field/jobs`)**
5. **Need 05 — Field Voice Memo Transcription (`STT`, `/field/capture`)**
6. **Need 06 — Inspector Audio Briefing & Report Readback (`TTS`, `/field/quick-report`)**

All per-tenant API keys are encrypted at rest using **AES-256-GCM** (`tenants.ai_credentials_enc`) keyed from `APP_ENCRYPTION_KEY`.

---

## Core Compliance & Security Architecture

1. **7-Year Inspection & Answer Immutability**: MySQL 8 triggers (`inspections_immutable`, `inspections_no_delete`, `answers_locked_update`, `answers_locked_delete`) permanently lock submitted field assessments.
2. **Append-Only Audit & Recommendation Trails**: Enforced via `rec_events_append_only_u/d`, `audit_log_append_only_u/d`, and `platform_audit_append_only_u/d`.
3. **Immutable Verified Regulations**: Triggers `regulations_never_edit` and `regulations_never_delete` prevent in-place edits of verified statutory text; legislative changes supersede old IDs via `superseded_by`.
4. **Defense-in-Depth Application Security (`lib/security.ts`)**:
   - SSRF DNS-rebinding & RFC1918/IMDS private-IP blocks on live `.gov` statutory fetches and custom AI endpoints.
   - Binary magic-byte validation (`PNG`, `JPEG`, `WebP`, `PDF`) stored outside `public/` in `.storage/` and served with `Content-Disposition` + `X-Content-Type-Options: nosniff` (blocks SVG XSS).
   - Spreadsheet formula-injection sanitization (`=`, `+`, `-`, `@`, `\t`, `\r`) on all Billing & Payroll CSV exports.
   - Strict `Content-Security-Policy`, `X-Frame-Options: DENY`, and `Referrer-Policy` headers in `next.config.mjs`.

---

## Local Development Quickstart

### 1. Prerequisites
- **Node.js**: `>= 20.x`
- **Database**: **MySQL 8.0+**

### 2. Environment Configuration
Copy `.env.example` to `.env` and configure your database URL and encryption secret:

```bash
cp .env.example .env
```

Key environment variables:
- `DATABASE_URL`: `mysql://user:password@localhost:3306/safety_alchemist`
- `APP_ENCRYPTION_KEY`: 32-byte hex key (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `APP_URL`: Public base URL (e.g., `http://localhost:3000` or `https://safetyalchemist.com`)
- `ENABLE_DEMO_MODE`: `true` in local/demo environments only (must be `false` in production)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`: Outbound MTA relay

### 3. Install, Initialize / Migrate Database & Verify

For a **brand-new empty database**:
```bash
npm install
npm run db:schema      # Creates all 53 MySQL 8 tables and 14 compliance triggers
npm run db:seed        # Seeds baseline demo tenants + runs v0.0.3 catalog migration
npm run db:verify      # Runs security unit checks + live schema/catalog assertions
npm run dev            # Starts Next.js 16 dev server at http://localhost:3000
```

For an **existing `v0.0.1` / `v0.0.2` database** (non-destructive, zero data loss):
```bash
npm install
npm run db:migrate     # Idempotently adds v0.0.3 tables, columns, triggers & catalogs
npm run db:verify      # Confirms schema, RBAC, encryption scrubbing & 21 templates
```

### 4. Seeded Demo Accounts (Local / Demo Environments)
Default seeded password in local dev: `safetyalchemist`

- **Plane 1 · SaaS Platform Control Plane (`/platform`)**:
  - `platform@safetyalchemist.com` — **Platform Super-Admin** (Pure Control Plane root)
  - `dana@safetyalchemist.com` — **Platform Super-Admin + Dual-Plane `t1` Owner**
  - `compliance@safetyalchemist.com` — **Master Compliance Editor** (Master Forms, Policies & 56-State Regulations)
  - `ops@safetyalchemist.com` — **Platform Ops Admin** (Tenant Provisioning & 60-Min Support Sessions)
  - `support@safetyalchemist.com` — **Platform Support Viewer** (Least-Privilege Read-Only)
- **Plane 2 · Tenant 1 (`t1` — The Safety Alchemist · SIG "Gems" + RSA Preset)**:
  - `dana@safetyalchemist.com` (Owner) · `lena@safetyalchemist.com` (Team Admin — `$0` Seat) · `jordan@safetyalchemist.com` (Supervisor) · `mai@safetyalchemist.com` (Consultant)
- **Plane 2 · Tenant 2 (`t2` — Northwest Compliance Partners · Standard Consultancy Preset)**:
  - `marcus@nwcompliance.com` (Owner) · `hannah@nwcompliance.com` (Team Admin — `$0` Seat) · `claire@nwcompliance.com` (Consultant)
- **Passwordless Client Touchpoints**:
  - `/portal/demo-portal-m1` (*Ridgeline Distribution*) · `/portal/demo-portal-m2` (*Valley Crest Farms*) · `/portal/demo-portal-m7` (*Puget Sound Marine Works*)

---

## Production Deployment (OVH VPS / Linux + Plesk Node.js)

1. Set `ENABLE_DEMO_MODE=false` and configure a strong 32-byte `APP_ENCRYPTION_KEY` and `DATABASE_URL` in `.env`.
2. Run the non-destructive migration and build:
   ```bash
   npm install
   npm run db:migrate
   npm run db:verify
   npm run typecheck
   npm run build
   ```
3. Configure Plesk Node.js (`Application Startup File = server.js`, `Application Mode = production`) and restart the app.

---

## Project Structure

```text
app/
  page.tsx                        Public v0.0.3 marketing, 21-form catalog & pricing landing page
  login/page.tsx                  Unified Single Entry Point SSO & workspace selector
  signup/page.tsx                 3-step consultancy / captive provisioning wizard
  portal/                         Passwordless Member Client Portal & encrypted share links
  field/                          Mobile/tablet 6-scale Field Inspector PWA & AI Quick Capture
  inspections/[id]/report/        4-mode printable / PDF white-labeled report generator
  (console)/                      Authenticated Platform (/platform) & Workspace (/today, /team, /forms, ...) routes
  api/                            Hardened REST mutation endpoints (platform, forms, regulations/live-fetch, ...)
components/                       Interactive drawers, RBAC ACL builders, taxonomy & form managers
db/schema.sql                     MySQL 8 DDL (53 tables + 14 immutability & seat triggers)
lib/                              DB pool, Dual-Plane RBAC evaluator, AES-256-GCM & SSRF security, AI router
scripts/                          apply-schema.mjs, seed.mjs, migrate-v003.mjs, verify-v003.mjs
data/                             forms_master.csv, regulations.csv, v003_jurisdictions/industries/templates.json
```

---

## Release History

- **`v0.0.3` (2026-11-10)** — Dual-Plane Least-Privilege RBAC & Unified SSO, Global Cross-Tenant User Directory & `$0` Complimentary Platform-Attached Seats, 56-Jurisdiction OSHA Engine with live `.gov` fetch, 12 Shield & Specialty Industry Lines (32 Sub-Sectors), Customizable Captive "Gems" & 3-Level Hierarchy, Platform/Team Form & Written Policy Builder + 6 New Templates (`GAP-IIPP`, `GAP-HEAT`, `GAP-HAZ`, `LCE-100`, `AUTO-SUP`, `RCA-JOB`), 4 Multi-Audience Report Modes, Gemini 3.1 Pro routing, and security hardening (AES-256-GCM, SSRF, binary uploads, CSV sanitization).
- **`v0.0.2`** — Loss Control Operating System (`Work Queue`, `Engagements`, `Qualification Staffing`, `Quick Capture`, `Quick Reports`, `Timesheets`), per-need Multi-Cloud AI routing (AWS Bedrock Qwen/Nova & Azure AI), and ElevenLabs Voice STT/TTS.
- **`v0.0.1`** — Initial multi-tenant EHS platform across 5 surfaces, 15 industry forms (903 questions), MySQL 8 7-year immutability schema, and Next.js 16 architecture.
