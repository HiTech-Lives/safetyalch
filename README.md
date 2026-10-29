# The Safety Alchemist

**Multi-Tenant EHS Inspection, Regulation Citation & Abatement Platform**  
Built with **Next.js 16.4 (App Router / Turbopack)**, **React 19.3**, **TypeScript**, and **MySQL 8**.

The Safety Alchemist is a white-labeled, multi-tenant B2B SaaS platform engineered for **safety consultancies**, **workers' compensation captives**, **trade associations**, and **multi-site employers** across Agriculture, Dairy, H-2A Worker Housing, Construction, Warehousing, Manufacturing, and Hospitality.

---

## Platform Architecture & Four Distinct Surfaces

| Surface | Route | Audience & Capabilities |
| :--- | :--- | :--- |
| **1. Public Marketing, Pricing & Auth Frontend** | `/`, `/login`, `/signup`, `/robots.txt`, `/sitemap.xml` | SEO, SEM, and AI/GEO-optimized landing page (`SoftwareApplication`, `Organization`, and `FAQPage` Schema.org JSON-LD), 15-form matrix, per-inspector seat pricing, staff login, and a 3-step self-service consultancy provisioning wizard. |
| **2. Tenant Staff Console** | `/today`, `/schedule`, `/inspections`, `/recommendations`, `/members`, `/team`, `/forms`, `/regulations`, `/brand`, `/billing` | Operations hub for **Owners**, **Admins** (free seats), **Supervisors** (crew-scoped), and **Consultants** (assigned-Member scoped). Manage visits, review Member abatement submissions, revise finding wording (preserving original consultant text), manage seats, and configure white-label branding. |
| **3. Field Inspector App (PWA)** | `/field`, `/field/[id]` | Mobile & tablet inspection runner with **Arrival Prep** (prior open/assumed site findings), section-by-section scoring (`Safe / Unsafe / N/A` or 4-level `BSA` Maturity), numeric measurement threshold auto-evaluation, repeat-finding detection (`SHR-*` shared keys), and one-tap **Submit & 7-Year Immutability Lock**. |
| **4. Customer Member Client Portal** | `/portal`, `/portal/[token]` | Passwordless, white-labeled client portal accessed via 90-day magic link. Member contacts view inspection reports, print/download PDFs, upload abatement proof photos + notes (`Pending review`), or sign a formal **Risk Assumed** declaration in writing. |
| **5. SaaS Operator Super-Admin** | `/platform` | Platform-level administration for provisioning and managing all tenant consultancies, monitoring seat utilization across tenants, impersonating/switching into any tenant console, and governing the global Master Forms & Regulations library. |

---

## Core Compliance & Multi-Tenant Rules (Enforced in MySQL 8)

All compliance guarantees are enforced at the database layer via MySQL 8 triggers and constraints in [`db/schema.sql`](./db/schema.sql):

1. **7-Year Inspection & Answer Immutability**:
   - Once `inspections.submitted_at` is set, triggers `inspections_immutable`, `inspections_no_delete`, `answers_locked_update`, and `answers_locked_delete` block any modification or deletion of submitted inspections and answers.
2. **Append-Only Recommendation Audit Trail**:
   - Triggers `rec_events_append_only_u` and `rec_events_append_only_d` ensure every recommendation status transition, note, wording revision, and Risk Assumed signature is permanently preserved in `rec_events`.
3. **Consultant Wording Ownership**:
   - When an Owner, Admin, or Supervisor refines a finding's wording in the Console, the original consultant text is preserved in `recommendations.original_text` alongside `revised_by` and `revised_at`, and printed on both PDF reports.
4. **Immutable Verified Regulations (`regulations_never_edit` / `regulations_never_delete`)**:
   - Once a regulation citation has a `verified_on` date and `verbatim_text`, it can never be edited in place or deleted. Legislative updates create a new regulation entry and mark the prior entry `superseded_by`, ensuring historical reports retain the exact legal text cited at the time of inspection.
5. **Seat & Role Governance (`users_max_two_owners` / `users_max_two_owners_u`)**:
   - **Owners** (max 2 per tenant, paid seat): Full access, billing, seat purchases, and seat-request approvals.
   - **Admins** (unlimited, **$0 free seat**): Console-only access; cannot run inspections. When paid seats are full, Admin invites generate a costed `seat_requests` row for Owner approval or decline (with mandatory 1-line reason).
   - **Supervisors** (paid seat): Scoped to their assigned crew (`crewIds`).
   - **Consultants** (paid seat): Scoped to their assigned Members and inspections.

---

## Standardized 15-Form Inspection Library (903 Questions)

Seeded from [`data/forms_master.csv`](./data/forms_master.csv) with calibrated priority SLAs (**High = 7 days**, **Med = 30 days**, **Low = 60 days**) and **249 shared core questions (`SHR-*`)** for cross-form repeat-finding detection:

- `BSA` — **Baseline Safety Assessment** (53 items · 4-level Maturity scale: *Absent · Written · Practiced · Owned* + 12-Month Development Plan)
- `IIP` — **Injury & Illness Prevention Program** (59 items)
- `GEN` — **General Industry Walk-Through** (66 items)
- `WHS` — **Warehouse & Distribution Center** (62 items)
- `CFA` — **Construction Field Audit** (68 items)
- `AGF` — **Agricultural Field Operations** (64 items)
- `PHP` — **Packing House & Processing** (63 items)
- `DRY` — **Dairy & Livestock Facility** (59 items)
- `H2A` — **H-2A Worker Housing Inspection** (58 items)
- `HHR` — **Hotel & Resort Operations** (61 items)
- `HFA` — **Restaurant & Food Service** (58 items)
- `HGC` — **Golf Course & Grounds Maintenance** (59 items)
- `FIR` — **Fire Prevention & Life Safety** (58 items)
- `ELC` — **Electrical Safety & LOTO** (58 items)
- `FLK` — **Powered Industrial Trucks / Forklifts** (57 items)

---

## Local Development Quickstart

### 1. Prerequisites
- **Node.js**: v20+ (tested through Node v26.x)
- **Database**: MySQL 8.0+

### 2. Environment Configuration
Copy `.env.example` to `.env` and configure your MySQL connection string and SMTP settings:

```bash
cp .env.example .env
```

Key environment variables in `.env`:
- `DATABASE_URL`: `mysql://user:password@host:3306/database_name`
- `SESSION_SECRET`: 32+ character secret for session cookies
- `APP_URL`: Public base URL (e.g., `http://localhost:3000` or `https://safetyalchemist.com`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`: Outbound SMTP relay (defaults to local server MTA `127.0.0.1:25`; logs emails to console if unavailable)
- `DEMO_ROLE_SWITCH`: Set to `true` in development/staging to enable the Sidebar Multi-Tenant & Role Switcher

### 3. Install, Apply Schema & Seed Demo Data

```bash
npm install
npm run db:schema      # Creates all 21 MySQL 8 tables and triggers
npm run db:seed        # Seeds 15 forms (903 questions), 12 regulations, and 2 demo tenants
npm run dev            # Starts Next.js 16 (Turbopack) at http://localhost:3000
```

To reset and reseed the database during development:

```bash
npm run db:reset
```

### 4. Seeded Demo Accounts & Surfaces
- **Default Staff Password** (`/login`): `safetyalchemist`
- **Tenant 1 (`t1` — The Safety Alchemist)**:
  - `dana@safetyalchemist.com` (Owner + Platform Super-Admin)
  - `lena@safetyalchemist.com` (Admin — Free Seat)
  - `jordan@safetyalchemist.com` (Supervisor)
  - `mai@safetyalchemist.com` (Consultant)
- **Tenant 2 (`t2` — Northwest Compliance Partners)**:
  - `marcus@nwcompliance.com` (Owner)
  - `hannah@nwcompliance.com` (Admin)
  - `claire@nwcompliance.com` (Consultant)
- **Live Member Portal Links** (`/portal`):
  - `/portal/demo-portal-m1` (*Ridgeline Distribution* — Purple Brand)
  - `/portal/demo-portal-m2` (*Valley Crest Farms* — Purple Brand)
  - `/portal/demo-portal-m7` (*Puget Sound Marine Works* — Navy Brand)

---

## Production Deployment (OVH VPS + Plesk Node.js)

1. **MySQL 8 Database**: Create a database and user in Plesk (`Databases > Add Database`) and set `DATABASE_URL` in `.env`.
2. **Node.js Extension in Plesk**:
   - **Node.js Version**: `20.x` – `26.x`
   - **Application Root**: Repository root directory
   - **Application Startup File**: `server.js`
   - **Application Mode**: `production`
3. **Build & Initialize**:
   ```bash
   npm install
   npm run db:schema
   npm run db:seed
   npm run build
   ```
4. **Restart App** in Plesk and issue a Let's Encrypt TLS certificate for your primary and custom tenant domains.

---

## Project Structure

```text
app/
  page.tsx                        Public SEO/SEM/GEO marketing & pricing landing page
  login/page.tsx                  Staff & multi-tenant demo sign-in
  signup/page.tsx                 3-step self-service consultancy provisioning wizard
  portal/                         Customer-facing passwordless Member Client Portal
  field/                          Mobile/tablet Field Inspector PWA (/field & /field/[id])
  inspections/[id]/report/        Printable / Save-as-PDF white-labeled report generator
  (console)/                      Authenticated Staff Console routes (/today, /schedule, /platform, ...)
  api/                            REST JSON mutation endpoints (auth, field, portal, platform, members, ...)
components/                       Client UI drawers, managers, and blueprint primitives
db/schema.sql                     MySQL 8 DDL (21 tables + immutability & seat triggers)
lib/                              Database pool, queries, auth hashing, color contrast guard, email MTA
scripts/                          apply-schema.mjs & fast batch seed.mjs
data/                             forms_master.csv (903 questions) & regulations.csv
```
