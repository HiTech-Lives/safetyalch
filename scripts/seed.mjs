// Seeds the 15 forms and the regulation library from data/*.csv, plus one demo tenant.
// Demo dates are relative to the day you run it, so overdue / due-soon states always look right.
import 'dotenv/config';
import fs from 'node:fs';
import { createHash, scryptSync, randomBytes } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import mysql from 'mysql2/promise';

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}
function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
const DEFAULT_PASS_HASH = hashPassword('safetyalchemist');

function parseDbConfig(rawUrl) {
  if (!rawUrl) throw new Error('DATABASE_URL is not set in .env');
  const u = new URL(rawUrl);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    connectTimeout: 8000,
    dateStrings: true,
  };
}

const read = f => parse(fs.readFileSync(new URL('../data/' + f, import.meta.url)), { columns: true, skip_empty_lines: true, relax_column_count: true });
const rows = read('forms_master.csv');
const regs = read('regulations.csv');
const conn = await mysql.createConnection(parseDbConfig(process.env.DATABASE_URL));
const ins = (t, o) => conn.query('INSERT INTO `' + t + '` SET ?', o);
const bulkIns = async (table, cols, list) => {
  if (!list.length) return;
  const sql = `INSERT INTO \`${table}\` (${cols.map(c => `\`${c}\``).join(',')}) VALUES ?`;
  const values = list.map(item => cols.map(c => item[c] ?? null));
  await conn.query(sql, [values]);
};
const PRI = { High: 7, Med: 30, Low: 60 };
const resolvePriority = q => (PRI[q.priority_proposed] ? q.priority_proposed : (PRI[q.priority] ? q.priority : 'Med'));
const day = n => { const d = new Date(); d.setHours(9, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const iso = d => d.toISOString().slice(0, 10);
const dt = d => d.toISOString().slice(0, 19).replace('T', ' ');

// ---------- forms ----------
const forms = new Map();
for (const r of rows) {
  if (!forms.has(r.form_code)) forms.set(r.form_code, { code: r.form_code, name: r.form_name, industry: r.industry, sections: new Map(), qs: [] });
  const f = forms.get(r.form_code);
  f.sections.set(Number(r.section_no), r.section_name);
  f.qs.push(r);
}
const formRows = [];
const sectionRows = [];
const questionRows = [];
for (const f of forms.values()) {
  formRows.push({ code: f.code, name: f.name, industry: f.industry, scale: f.code === 'BSA' ? 'maturity' : 'safe_unsafe_na', allow_additional_findings: 0, version: 1, published_at: dt(day(-120)) });
  for (const [no, name] of f.sections) sectionRows.push({ form_code: f.code, section_no: no, name });
  let i = 0;
  for (const q of f.qs) {
    questionRows.push({
      form_code: f.code, question_id: q.question_id, question_key: q.question_key, section_no: Number(q.section_no), sort_order: i++,
      question_text: q.question_text, answer_type: q.answer_type, na_label: q.na_label || null,
      requires_rec: q.requires_rec === 'Yes' ? 1 : 0, photo_required: q.photo_required === 'Yes' ? 1 : 0,
      priority: resolvePriority(q), topic: q.topic || 'general', measure_unit: q.measure_unit || null,
      comparison: q.comparison || null, threshold: q.threshold === '' ? null : Number(q.threshold),
      recommendation: q.recommendation || null, is_shared: q.is_shared === 'Yes' ? 1 : 0
    });
  }
}
await bulkIns('forms', ['code', 'name', 'industry', 'scale', 'allow_additional_findings', 'version', 'published_at'], formRows);
await bulkIns('form_sections', ['form_code', 'section_no', 'name'], sectionRows);
await bulkIns('questions', ['form_code', 'question_id', 'question_key', 'section_no', 'sort_order', 'question_text', 'answer_type', 'na_label', 'requires_rec', 'photo_required', 'priority', 'topic', 'measure_unit', 'comparison', 'threshold', 'recommendation', 'is_shared'], questionRows);
console.log('Forms: ' + forms.size + ' · questions: ' + rows.length);

// ---------- regulations ----------
const regRows = regs.map(g => ({ ...g, verified_on: g.verified_on || null, verbatim_text: g.verbatim_text || null, superseded_by: g.superseded_by || null }));
await bulkIns('regulations', ['reg_id', 'jurisdiction', 'agency', 'code', 'title', 'topic', 'summary', 'verbatim_text', 'source_url', 'verified_on', 'verified_by', 'status', 'superseded_by', 'notes'], regRows);
console.log('Regulations: ' + regs.length);

// ---------- question_regulations initial mapping ----------
const seenQKeys = new Set();
const qrRows = [];
for (const q of rows) {
  if (seenQKeys.has(q.question_key)) continue;
  seenQKeys.add(q.question_key);
  const matchingRegs = regs.filter(g => g.topic === q.topic);
  for (const g of matchingRegs) {
    qrRows.push({
      question_key: q.question_key,
      jurisdiction: g.jurisdiction,
      reg_id: g.reg_id,
      is_primary: 1,
      measure_unit: q.measure_unit || null,
      comparison: q.comparison || null,
      threshold: q.threshold === '' ? null : Number(q.threshold),
      notes: null,
    });
  }
}
await bulkIns('question_regulations', ['question_key', 'jurisdiction', 'reg_id', 'is_primary', 'measure_unit', 'comparison', 'threshold', 'notes'], qrRows);
console.log('Question-regulation mappings: ' + qrRows.length);

// ---------- demo tenants ----------
const DEFAULT_AI_CONFIG = JSON.stringify({
  provider: 'aws_bedrock',
  awsRegion: 'us-west-2',
  textModel: 'qwen.qwen2.5-32b-instruct-v1:0',
  visionModel: 'qwen.qwen2.5-vl-72b-instruct',
  audioModel: 'aws.transcribe-streaming',
  azureEndpoint: '',
  azureModel: 'Qwen2.5-32B-Instruct',
  fallbackToDeterministic: true,
});

await ins('tenants', {
  id: 't1',
  name: 'The Safety Alchemist',
  custom_domain: 'app.safetyalchemist.com',
  email_sender: 'reports@safetyalchemist.com',
  accent: '#4b2454',
  brand_scopes: JSON.stringify({ app: true, reports: true, email: true, portal: true, signin: false }),
  ai_config_json: DEFAULT_AI_CONFIG,
  seats_purchased: 6,
  plan: 'enterprise',
  status: 'active',
});
await ins('tenants', {
  id: 't2',
  name: 'Northwest Compliance Partners',
  custom_domain: 'portal.nwcompliance.com',
  email_sender: 'audits@nwcompliance.com',
  accent: '#1f4f6e',
  brand_scopes: JSON.stringify({ app: true, reports: true, email: true, portal: true, signin: true }),
  ai_config_json: DEFAULT_AI_CONFIG,
  seats_purchased: 4,
  plan: 'professional',
  status: 'active',
});

const USERS = [
  ['u1', 't1', 'Dana Okafor', 'dana@safetyalchemist.com', 'owner', 'active', null, 1],
  ['u2', 't1', 'Lena Chen', 'lena@safetyalchemist.com', 'admin', 'active', null, 0],
  ['u3', 't1', 'Jordan Boone', 'jordan@safetyalchemist.com', 'supervisor', 'active', null, 0],
  ['u4', 't1', 'Mai Tran', 'mai@safetyalchemist.com', 'consultant', 'active', 'u3', 0],
  ['u5', 't1', 'Piotr Kowalski', 'piotr@safetyalchemist.com', 'consultant', 'active', 'u3', 0],
  ['u6', 't1', 'Sofia Reyes', 'sofia@safetyalchemist.com', 'consultant', 'invited', null, 0],
  ['u7', 't2', 'Marcus Sterling', 'marcus@nwcompliance.com', 'owner', 'active', null, 0],
  ['u8', 't2', 'Hannah Brooks', 'hannah@nwcompliance.com', 'admin', 'active', null, 0],
  ['u9', 't2', 'Claire Lin', 'claire@nwcompliance.com', 'consultant', 'active', null, 0],
];
for (const [id, tenant_id, name, email, role, status, sup, is_platform_admin] of USERS) {
  await ins('users', { id, tenant_id, name, email, password_hash: DEFAULT_PASS_HASH, role, status, supervisor_id: sup, is_platform_admin });
}

const MEMBERS = [
  ['m1', 't1', 'Ridgeline Distribution', 'Warehouse', 'Fresno, CA', 'M. Ruiz', ['u3'], [['s1', 'Fresno DC', 'CA', '2840 E Jensen Ave, Fresno, CA 93706'], ['s2', 'Bakersfield Yard', 'CA', '4100 Sillect Ave, Bakersfield, CA 93308']]],
  ['m2', 't1', 'Valley Crest Farms', 'Agriculture', 'Salinas, CA', 'A. Castillo', ['u1'], [['s3', 'Packing House', 'CA', '1180 Abbott St, Salinas, CA 93901'], ['s4', 'North Ranch', 'CA', '900 Old Stage Rd, Salinas, CA 93908'], ['s5', 'Labor Camp 3 (H-2A)', 'CA', '455 Espinosa Rd, Salinas, CA 93907']]],
  ['m3', 't1', 'Harbor Point Resort', 'Hospitality', 'Monterey, CA', 'K. Patel', ['u4'], [['s6', 'Hotel', 'CA', '400 Cannery Row, Monterey, CA 93940'], ['s7', 'Golf course', 'CA', '1700 17-Mile Dr, Pebble Beach, CA 93953']]],
  ['m4', 't1', 'Cascade Dairy', 'Dairy', 'Yakima, WA', 'T. Lindqvist', [], [['s8', 'Main parlor', 'WA', '3120 Lateral A Rd, Wapato, WA 98951']]],
  ['m5', 't1', 'Summit Builders', 'Construction', 'Reno, NV', 'R. Hale', ['u5'], [['s9', 'Midtown Tower', 'NV', '740 S Virginia St, Reno, NV 89501']]],
  ['m6', 't1', 'Oak & Ember Restaurant Group', 'Hospitality', 'Sacramento, CA', 'J. Moreno', ['u4'], [['s10', 'Midtown', 'CA', '1801 L St, Sacramento, CA 95811'], ['s11', 'East Sacramento', 'CA', '4601 H St, Sacramento, CA 95819']]],
  ['m7', 't2', 'Puget Sound Marine Works', 'Manufacturing', 'Seattle, WA', 'D. Mercer', ['u7', 'u9'], [['s12', 'Harbor Shipyard', 'WA', '2929 16th Ave SW, Seattle, WA 98134']]],
  ['m8', 't1', 'Cal Plains Roofing', 'Construction', 'Sacramento, CA', 'Jorge Medina', ['u1', 'u3'], [['s13', '1420 Industrial Pkwy, West Sacramento', 'CA', '1420 Industrial Pkwy, West Sacramento, CA 95691']]],
  ['m9', 't1', 'Valley Paving Co.', 'Construction', 'Stockton, CA', 'Carlos Vega', ['u3', 'u5'], [['s14', 'Stockton Plant & Yard', 'CA', '3310 S El Dorado St, Stockton, CA 95206']]],
  ['m10', 't1', 'Sierra Framing Contractors', 'Construction', 'Roseville, CA', 'Brett Callahan', ['u4', 'u5'], [['s15', 'Blue Oaks Tract Lot 14', 'CA', '1950 Blue Oaks Blvd, Roseville, CA 95747']]],
];
const siteJ = {}, siteMember = {}, siteTenant = {}, contactOf = {};
for (const [id, tenant_id, name, industry, city, contact, team, sites] of MEMBERS) {
  await ins('members', { id, tenant_id, name, industry, city });
  await ins('member_contacts', { id: 'c-' + id, member_id: id, name: contact, email: contact.toLowerCase().replace(/[^a-z]/g, '') + '@example.com', is_primary: 1 });
  contactOf[id] = { id: 'c-' + id, name: contact };
  for (const u of team) await ins('member_assignments', { member_id: id, user_id: u });
  for (const [sid, sname, j, addr] of sites) {
    await ins('sites', { id: sid, member_id: id, name: sname, address: addr || (sname + ', ' + city), jurisdiction: j });
    siteJ[sid] = j;
    siteMember[sid] = id;
    siteTenant[sid] = tenant_id;
  }
}

const VISITS = [
  [0, 's13', 'CFA', 'u1', 'assigned', [], '08:30 AM', 120, 'Jorge Medina', '(916) 555-0148', 'jmedina@calplainsroofing.com', 'demo-confirm-s13', 'confirmed', 'Jorge Medina', 'CSP,OSHA 500', 'J-1001'],
  [0, 's4', 'AGF', 'u1', 'self', [], '11:30 AM', 90, 'A. Castillo', '(831) 555-0192', 'acastillo@valleycrest.com', 'demo-confirm-s4', 'sent', null, 'ALCM', 'J-1002'],
  [0, 's10', 'HFA', 'u1', 'assigned', [], '02:30 PM', 90, 'J. Moreno', '(916) 555-0177', 'jmoreno@oakember.com', 'demo-confirm-s10', 'unconfirmed', null, 'CSP', 'J-1003'],
  [1, 's7', 'HGC', 'u4', 'assigned', [], '09:00 AM', 90, 'K. Patel', '(831) 555-0114', 'kpatel@harborpoint.com', 'demo-confirm-s7', 'confirmed', 'K. Patel', 'ARM', 'J-1004'],
  [2, 's8', 'DRY', null, 'assigned', [], '10:00 AM', 120, 'T. Lindqvist', '(509) 555-0163', 'tlindqvist@cascadedairy.com', 'demo-confirm-s8', 'unconfirmed', null, 'CIH', 'J-1005'],
  [5, 's2', 'WHS', 'u3', 'self', ['u5'], '09:00 AM', 120, 'M. Ruiz', '(559) 555-0122', 'mruiz@ridgeline.com', 'demo-confirm-s2', 'sent', null, 'CSP,ARM', 'J-1006'],
  [6, 's11', 'HFA', 'u4', 'assigned', [], '01:00 PM', 90, 'J. Moreno', '(916) 555-0177', 'jmoreno@oakember.com', null, 'unconfirmed', null, null, null],
  [8, 's9', 'CFA', 'u5', 'assigned', [], '08:00 AM', 180, 'R. Hale', '(775) 555-0188', 'rhale@summitbuilders.com', null, 'unconfirmed', null, 'OSHA 500,CSP', null],
  [19, 's3', 'BSA', 'u1', 'self', [], '09:30 AM', 150, 'A. Castillo', '(831) 555-0192', 'acastillo@valleycrest.com', null, 'unconfirmed', null, 'CSP', null],
  [34, 's1', 'IIP', 'u3', 'assigned', [], '10:00 AM', 120, 'M. Ruiz', '(559) 555-0122', 'mruiz@ridgeline.com', null, 'unconfirmed', null, null, null],
  [2, 's12', 'WHS', 'u9', 'assigned', [], '09:00 AM', 120, 'D. Mercer', '(206) 555-0140', 'dmercer@pugetmarine.com', 'demo-confirm-s12', 'confirmed', 'D. Mercer', 'CSP', null],
];
let vn = 1;
for (const [off, site, form, lead, origin, att, start_time, duration_minutes, cname, cphone, cemail, ctoken, cstatus, cby, reqCerts, jobId] of VISITS) {
  const id = 'v' + vn++;
  const tid = siteTenant[site];
  const creator = origin === 'self' && lead ? lead : (tid === 't2' ? 'u8' : 'u2');
  await ins('visits', {
    id, tenant_id: tid, site_id: site, form_code: form, lead_user_id: lead, scheduled_for: iso(day(off)),
    start_time, duration_minutes, origin, site_contact_name: cname, site_contact_phone: cphone, site_contact_email: cemail,
    confirm_token: ctoken, confirm_status: cstatus, confirmed_by_name: cby, confirmed_at: cstatus === 'confirmed' ? dt(day(-1)) : null,
    required_certs: reqCerts, job_id: jobId, created_by: creator
  });
  for (const a of att || []) await ins('visit_attendees', { visit_id: id, user_id: a });
}

// ---------- inspections, answers, recommendations ----------
const INSP = [
  ['I-2009', -71, 's3', 'PHP', 'u1', true, ['corrected', 'corrected', 'assumed']],
  ['I-2017', -56, 's8', 'DRY', 'u1', true, ['open', 'corrected', 'open', 'corrected']],
  ['I-2024', -37, 's10', 'HFA', 'u4', true, ['corrected', 'corrected', 'open', 'assumed']],
  ['I-2031', -19, 's7', 'HGC', 'u4', true, ['corrected', 'open', 'pending']],
  ['I-2036', -13, 's1', 'BSA', 'u3', true, []],
  ['I-2039', -8, 's9', 'CFA', 'u5', true, ['open', 'open', 'open', 'pending', 'assumed']],
  ['I-2041', -6, 's6', 'HHR', 'u4', true, ['pending', 'open', 'open', 'corrected']],
  ['I-2044', -4, 's5', 'H2A', 'u1', true, ['open', 'pending', 'open', 'open', 'corrected']],
  ['I-2046', -2, 's1', 'WHS', 'u3', true, ['open', 'open', 'pending', 'open', 'corrected', 'open']],
  ['I-2048', 0, 's4', 'AGF', 'u1', false, []],
  ['I-2050', -3, 's12', 'WHS', 'u9', true, ['open', 'pending', 'open']],
];
const LEVELS = ['absent', 'written', 'practiced', 'owned'];
let recNo = 101;
for (const [id, off, site, form, by, submitted, pattern] of INSP) {
  const start = day(off);
  const f = forms.get(form);
  const tid = siteTenant[site];
  // Answers go in before submitted_at is set, so the immutability triggers do not block the seed.
  await ins('inspections', { id, tenant_id: tid, site_id: site, form_code: form, consultant_id: by, device_id: 'demo-device-' + by, started_at: dt(start), submitted_at: null });
  if (!submitted) continue;
  const withRec = f.qs.filter(q => q.recommendation);
  const picks = pattern.map((_, i) => withRec[Math.floor((i + 0.5) * withRec.length / pattern.length)]);
  const pickIds = new Set(picks.map(p => p.question_id));
  let k = 0;
  const ansRows = [];
  for (const q of f.qs) {
    k++;
    const value = form === 'BSA' ? (k % 13 === 0 ? 'na' : LEVELS[(k * 7 + Number(q.section_no)) % 4]) : pickIds.has(q.question_id) ? 'unsafe' : (k % 14 === 0 ? 'na' : 'safe');
    ansRows.push({ inspection_id: id, question_id: q.question_id, question_key: q.question_key, value, na_reason: value === 'na' ? (q.na_label || 'Not present on site') : null, answered_at: dt(start) });
  }
  await bulkIns('answers', ['inspection_id', 'question_id', 'question_key', 'value', 'na_reason', 'answered_at'], ansRows);

  const recList = [];
  const evList = [];
  for (let i = 0; i < picks.length; i++) {
    const q = picks[i];
    const j = siteJ[site];
    const reg = regs.find(g => g.topic === q.topic && g.jurisdiction === j) || regs.find(g => g.topic === q.topic && g.jurisdiction === 'FED');
    const pr = resolvePriority(q);
    const due = new Date(start); due.setDate(due.getDate() + PRI[pr]);
    const rid = 'R-' + recNo++;
    const status = pattern[i];
    recList.push({
      id: rid, tenant_id: tid, inspection_id: id, question_id: q.question_id, question_key: q.question_key, section_no: Number(q.section_no),
      text: q.recommendation, priority: pr, due_on: iso(due), status, reg_id: reg ? reg.reg_id : null, created_by: by, created_at: dt(start)
    });
    evList.push({ rec_id: rid, at: dt(start), actor_user_id: by, actor_contact_id: null, kind: 'raised', note: 'Raised during ' + id + '.' });
    const c = contactOf[siteMember[site]];
    const plus = n => { const d = new Date(start); d.setDate(d.getDate() + n); return dt(d); };
    if (status === 'pending' || status === 'corrected') evList.push({ rec_id: rid, at: plus(1), actor_user_id: null, actor_contact_id: c.id, kind: 'member_submitted', note: c.name + ' submitted a correction photo and note from the Member dashboard.' });
    if (status === 'corrected') evList.push({ rec_id: rid, at: plus(2), actor_user_id: by, actor_contact_id: null, kind: 'confirmed', note: 'Confirmed corrected.' });
    if (status === 'assumed') evList.push({ rec_id: rid, at: plus(1), actor_user_id: null, actor_contact_id: c.id, kind: 'risk_assumed', note: 'Risk assumed. Signed by ' + c.name + '.' });
  }
  await bulkIns('recommendations', ['id', 'tenant_id', 'inspection_id', 'question_id', 'question_key', 'section_no', 'text', 'priority', 'due_on', 'status', 'reg_id', 'created_by', 'created_at'], recList);
  await bulkIns('rec_events', ['rec_id', 'at', 'actor_user_id', 'actor_contact_id', 'kind', 'note'], evList);

  await conn.query('UPDATE inspections SET submitted_at=? WHERE id=?', [dt(start), id]);
}

// Seed permanent demo magic links for Member Client Portal testing
await ins('magic_links', { id: 'ml-m1', contact_id: 'c-m1', inspection_id: 'I-2046', token_hash: hashToken('demo-portal-m1'), expires_at: dt(day(90)) });
await ins('magic_links', { id: 'ml-m2', contact_id: 'c-m2', inspection_id: 'I-2044', token_hash: hashToken('demo-portal-m2'), expires_at: dt(day(90)) });
await ins('magic_links', { id: 'ml-m7', contact_id: 'c-m7', inspection_id: 'I-2050', token_hash: hashToken('demo-portal-m7'), expires_at: dt(day(90)) });

// ---------- Phase 5 (v0.0.2) Loss Control Operating System Seed ----------
const SOURCES = [
  ['src-1', 't1', 'Golden State Contractors Captive', 'captive', 'Evelyn Vance', 'evance@gsc-captive.org'],
  ['src-2', 't1', 'Pacific Ag & Dairy Mutual', 'carrier', 'Howard Miller', 'hmiller@pacificagmutual.com'],
  ['src-3', 't1', 'Sierra Specialty Insurance', 'carrier', 'Rebecca Cho', 'rcho@sierraspecialty.com'],
  ['src-4', 't1', 'Direct Commercial Accounts', 'commercial', 'Dana Okafor', 'dana@safetyalchemist.com'],
  ['src-5', 't2', 'Northwest Maritime Underwriters', 'carrier', 'Greg Halvorsen', 'ghalvorsen@nwmaritime.com'],
];
for (const [id, tenant_id, name, source_type, contact_name, contact_email] of SOURCES) {
  await ins('sources', { id, tenant_id, name, source_type, contact_name, contact_email });
}

const REFERRALS = [
  ['ref-1', 't1', 'src-1', 'Westline Risk Partners', 'Megan Holt', 'mholt@westlinerisk.com', '(916) 555-0190'],
  ['ref-2', 't1', 'src-1', 'Bayshore Insurance Brokerage', 'David Park', 'dpark@bayshoreins.com', '(415) 555-0133'],
  ['ref-3', 't1', 'src-2', 'Central Valley Ag Brokers', 'Elena Gomez', 'egomez@cvagbrokers.com', '(559) 555-0181'],
  ['ref-4', 't2', 'src-5', 'Sound Risk Advisors', 'Nolan Vance', 'nvance@soundrisk.com', '(206) 555-0129'],
];
for (const [id, tenant_id, source_id, name, contact_name, contact_email, contact_phone] of REFERRALS) {
  await ins('referral_sources', { id, tenant_id, source_id, name, contact_name, contact_email, contact_phone });
}

const ENGAGEMENTS = [
  ['eng-1', 't1', 'src-1', 'ref-1', 'm8', 'Golden State Contractors Captive, member risk control program', 'drawdown', 90000.00, 64698.67, 23450.00, 58200.00, 42, 31, iso(day(-240)), iso(day(125)), 'on_pace', dt(day(-1)), 'Annual captive loss-control drawdown program covering roofing, paving, and framing members.'],
  ['eng-2', 't1', 'src-2', 'ref-3', 'm2', 'Valley Crest Farms · Annual Ag & H-2A Loss Control Retainer', 'drawdown', 68500.00, 51200.00, 14800.00, 49500.00, 24, 19, iso(day(-210)), iso(day(155)), 'on_pace', dt(day(-2)), 'Includes Packing House, North Ranch, and H-2A Housing inspections.'],
  ['eng-3', 't1', 'src-3', null, 'm1', 'Ridgeline Distribution · Multi-DC Fleet & Warehouse Program', 'fixed_deliverable', 54200.00, 42800.00, 11400.00, 38900.00, 18, 14, iso(day(-180)), iso(day(185)), 'behind', dt(day(-12)), 'Bakersfield Yard follow-up overdue by 5 days.'],
  ['eng-4', 't1', 'src-4', null, 'm3', 'Harbor Point Resort · Hospitality & Ergonomics Program', 'drawdown', 48000.00, 39100.00, 8900.00, 39100.00, 16, 14, iso(day(-200)), iso(day(165)), 'on_pace', dt(day(-4)), 'Quarterly hotel, kitchen, and golf maintenance loss control.'],
  ['eng-5', 't1', 'src-2', 'ref-3', 'm4', 'Cascade Dairy · WA DOSH Dairy & Confined Space Program', 'fixed_deliverable', 42000.00, 28500.00, 13500.00, 24200.00, 12, 8, iso(day(-190)), iso(day(175)), 'gone_quiet', dt(day(-35)), 'No site contact confirmation in 30+ days.'],
  ['eng-6', 't1', 'src-1', 'ref-2', 'm5', 'Summit Builders · High-Rise OCIP Loss Control', 'hourly', 38000.00, 31400.00, 6600.00, 29800.00, 15, 12, iso(day(-150)), iso(day(215)), 'on_pace', dt(day(-6)), 'Monthly crane, scaffold, and fall protection audits.'],
  ['eng-7', 't2', 'src-5', 'ref-4', 'm7', 'Puget Sound Marine Works · Shipyard Loss Prevention', 'drawdown', 62000.00, 44100.00, 15200.00, 41000.00, 20, 15, iso(day(-160)), iso(day(205)), 'on_pace', dt(day(-3)), 'Maritime hot work and crane safety program.'],
];
for (const [id, tenant_id, source_id, referral_source_id, member_id, title, billing_model, annual_budget, spent_to_date, planned_amount, billed_amount, deliverables_total, deliverables_done, start_date, end_date, status, last_activity_at, notes] of ENGAGEMENTS) {
  await ins('engagements', { id, tenant_id, source_id, referral_source_id, member_id, title, billing_model, annual_budget, spent_to_date, planned_amount, billed_amount, deliverables_total, deliverables_done, start_date, end_date, status, last_activity_at, notes });
}

const SERVICE_LINES = [
  ['esl-1', 'eng-1', 'Member risk control surveys', 'fixed_fee', 24, 18, 1950.00, 46800.00, 35100.00, 1],
  ['esl-2', 'eng-1', 'Follow-up & post-incident visits', 'fixed_fee', 12, 9, 1850.00, 22200.00, 16650.00, 2],
  ['esl-3', 'eng-1', 'Ergonomic & silica evaluations', 'fixed_fee', 6, 4, 2250.00, 13500.00, 9000.00, 3],
  ['esl-4', 'eng-1', 'Unassigned hours on this program', 'hourly', 20, 12.5, 185.00, 3700.00, 2312.50, 4],
  ['esl-5', 'eng-1', 'Billable travel & lodging expenses', 'expense', 1, 1, 1950.00, 1950.00, 1636.17, 5],
  ['esl-6', 'eng-1', 'Unplanned reserve budget', 'unplanned', 1, 0, 1850.00, 1850.00, 0.00, 6],
  ['esl-7', 'eng-2', 'Quarterly agricultural facility audits', 'fixed_fee', 12, 10, 3200.00, 38400.00, 32000.00, 1],
  ['esl-8', 'eng-2', 'H-2A housing & heat illness readiness', 'fixed_fee', 8, 6, 2600.00, 20800.00, 15600.00, 2],
  ['esl-9', 'eng-2', 'Bilingual tailgate & tractor training', 'hourly', 40, 26, 185.00, 7400.00, 3600.00, 3],
];
for (const [id, engagement_id, service_name, unit_type, planned_count, done_count, rate_each, planned_total, spent_total, sort_order] of SERVICE_LINES) {
  await ins('engagement_service_lines', { id, engagement_id, service_name, unit_type, planned_count, done_count, rate_each, planned_total, spent_total, sort_order });
}

const SAMPLE_EMAIL = `From: Megan Holt <mholt@westlinerisk.com>
Subject: URGENT Loss Control Request - GSC-WC-26-0412 - Cal Plains Roofing (Post-Incident Review)

Team,
Please assign a senior loss control consultant to conduct a Post-incident review for our captive member Cal Plains Roofing under the Golden State Contractors Captive, member risk control program.

Carrier Ref: GSC-WC-26-0412
Policyholder / Insured: Cal Plains Roofing
Site Address: 1420 Industrial Pkwy, West Sacramento, CA 95691
Site Contact: Jorge Medina, Operations Superintendent
Phone: (916) 555-0148
Email: jmedina@calplainsroofing.com
Approved Fee: $1,850.00
Target Due Date: ${iso(day(5))}

Special Instructions:
A sub-crew worker experienced a near-miss ladder slip near the west loading dock parapet yesterday afternoon. Please inspect ladder tie-offs, 3-rung extension above the landing, and verify roof edge warning lines (29 CFR 1926.1053 / Cal/OSHA 8 CCR 1675).`;

const WORK_JOBS = [
  ['J-1001', 't1', 'eng-1', 'src-1', 'ref-1', 'm8', 's13', 'Post-incident review: Cal Plains Roofing', 'GSC-WC-26-0412', 'Post-incident review', 'Cal Plains Roofing', 'Megan Holt, Westline Risk Partners', '1420 Industrial Pkwy, West Sacramento, CA 95691', 'Jorge Medina', '(916) 555-0148', 'jmedina@calplainsroofing.com', 1850.00, 'scheduled', 0, null, 'u1', iso(day(-2)), iso(day(5)), iso(day(0)), 'Inspect ladder setup at west loading dock and verify Cal/OSHA Title 8 §1675 compliance.', SAMPLE_EMAIL, 'v1', null, null],
  ['J-1002', 't1', 'eng-2', 'src-2', 'ref-3', 'm2', 's4', 'Annual Ag Field & Tractor Survey: Valley Crest Farms', 'PAM-AG-26-1108', 'Member risk control survey', 'Valley Crest Farms', 'Elena Gomez, Central Valley Ag Brokers', '900 Old Stage Rd, Salinas, CA 93908', 'A. Castillo', '(831) 555-0192', 'acastillo@valleycrest.com', 3200.00, 'scheduled', 0, null, 'u1', iso(day(-5)), iso(day(4)), iso(day(0)), 'Focus on PTO guarding, shade/water logs, and field sanitation units.', null, 'v2', 'I-2048', null],
  ['J-1003', 't1', 'eng-4', 'src-4', null, 'm6', 's10', 'Kitchen Hood & Slip/Fall Audit: Oak & Ember Midtown', 'COM-OE-26-021', 'Commercial survey supplement', 'Oak & Ember Restaurant Group', 'J. Moreno', '1801 L St, Sacramento, CA 95811', 'J. Moreno', '(916) 555-0177', 'jmoreno@oakember.com', 1650.00, 'scheduled', 0, null, 'u1', iso(day(-4)), iso(day(3)), iso(day(0)), 'Verify UL 300 hood suppression tag and quarry tile floor mats.', null, 'v3', null, null],
  ['J-1004', 't1', 'eng-1', 'src-1', 'ref-1', 'm9', 's14', 'Silica & Asphalt Plant Survey: Valley Paving Co.', 'GSC-WC-26-0398', 'Ergonomic & silica evaluation', 'Valley Paving Co.', 'Megan Holt, Westline Risk Partners', '3310 S El Dorado St, Stockton, CA 95206', 'Carlos Vega', '(209) 555-0164', 'cvega@valleypaving.com', 2250.00, 'visit_done', 0, null, 'u3', iso(day(-7)), iso(day(1)), iso(day(-1)), 'Field air monitoring complete; drafting Quick Report in truck.', null, null, null, null],
  ['J-1005', 't1', 'eng-1', 'src-1', 'ref-2', 'm10', 's15', 'Residential Framing Fall Protection Audit: Sierra Framing', 'GSC-WC-26-0404', 'Member risk control survey', 'Sierra Framing Contractors', 'David Park, Bayshore Insurance Brokerage', '1950 Blue Oaks Blvd, Roseville, CA 95747', 'Brett Callahan', '(916) 555-0199', 'bcallahan@sierraframing.com', 1950.00, 'in_qc', 0, null, 'u5', iso(day(-9)), iso(day(0)), iso(day(-3)), 'Submitted by Piotr; awaiting supervisor QC review before releasing to Westline.', null, null, null, 'qr-1'],
  ['J-1006', 't1', 'eng-3', 'src-3', null, 'm1', 's1', 'Warehouse Rack & Powered Industrial Truck Audit: Ridgeline DC', 'SSI-GL-26-882', 'Member risk control survey', 'Ridgeline Distribution', 'Rebecca Cho, Sierra Specialty', '2840 E Jensen Ave, Fresno, CA 93706', 'M. Ruiz', '(559) 555-0122', 'mruiz@ridgeline.com', 2400.00, 'delivered', 0, null, 'u3', iso(day(-14)), iso(day(-2)), iso(day(-4)), 'Report delivered to carrier and member; ready to bill.', null, null, 'I-2046', null],
  ['J-1007', 't1', 'eng-2', 'src-2', 'ref-3', 'm2', 's5', 'H-2A Housing Pre-Occupancy Inspection: Labor Camp 3', 'PAM-AG-26-1094', 'Follow-up & post-incident visit', 'Valley Crest Farms', 'Elena Gomez, Central Valley Ag Brokers', '455 Espinosa Rd, Salinas, CA 93907', 'A. Castillo', '(831) 555-0192', 'acastillo@valleycrest.com', 2600.00, 'delivered', 0, null, 'u1', iso(day(-16)), iso(day(-4)), iso(day(-5)), 'Delivered to broker; awaiting invoice batch.', null, null, 'I-2044', null],
  ['J-1008', 't1', 'eng-6', 'src-1', 'ref-2', 'm5', 's9', 'Tower Crane & Perimeter Netting Survey: Summit Builders', 'GSC-OCIP-26-119', 'Member risk control survey', 'Summit Builders', 'David Park, Bayshore Insurance Brokerage', '740 S Virginia St, Reno, NV 89501', 'R. Hale', '(775) 555-0188', 'rhale@summitbuilders.com', 2850.00, 'delivered', 1, dt(day(-5)), 'u5', iso(day(-20)), iso(day(-8)), iso(day(-9)), 'Billed under OCIP drawdown.', null, null, 'I-2039', null],
  ['J-1009', 't1', 'eng-5', 'src-2', 'ref-3', 'm4', 's8', 'Parlor Chemical & Confined Space Follow-Up: Cascade Dairy', 'PAM-DY-26-077', 'Follow-up & post-incident visit', 'Cascade Dairy', 'Elena Gomez, Central Valley Ag Brokers', '3120 Lateral A Rd, Wapato, WA 98951', 'T. Lindqvist', '(509) 555-0163', 'tlindqvist@cascadedairy.com', 2100.00, 'received', 0, null, null, iso(day(-1)), iso(day(10)), null, 'Requires CIH-certified consultant for parlor peracetic acid vapor check.', null, 'v5', null, null],
  ['J-1010', 't1', 'eng-1', 'src-1', 'ref-1', 'm8', 's13', 'Equipment Breakdown & Ketting Yard Review: Cal Plains Roofing', 'GSC-EB-26-0419', 'Equipment breakdown survey', 'Cal Plains Roofing', 'Megan Holt, Westline Risk Partners', '1420 Industrial Pkwy, West Sacramento, CA 95691', 'Jorge Medina', '(916) 555-0148', 'jmedina@calplainsroofing.com', 1950.00, 'received', 0, null, null, iso(day(0)), iso(day(12)), null, 'New request received this morning; needs CSP + OSHA 500 staffing.', null, null, null, null],
  ['J-1011', 't2', 'eng-7', 'src-5', 'ref-4', 'm7', 's12', 'Drydock Hot Work & Confined Space Audit', 'NWM-26-501', 'Member risk control survey', 'Puget Sound Marine Works', 'Nolan Vance, Sound Risk Advisors', '2929 16th Ave SW, Seattle, WA 98134', 'D. Mercer', '(206) 555-0140', 'dmercer@pugetmarine.com', 3100.00, 'delivered', 0, null, 'u9', iso(day(-10)), iso(day(-1)), iso(day(-3)), 'Delivered to underwriter.', null, null, 'I-2050', null],
];
for (const [id, tenant_id, engagement_id, source_id, referral_source_id, member_id, site_id, title, carrier_ref, service_type, insured_name, requested_by, site_address, site_contact, contact_phone, contact_email, fee, status, billed, billed_at, assigned_to, received_date, due_date, visit_scheduled_date, notes, raw_email_text, visit_id, inspection_id, quick_report_id] of WORK_JOBS) {
  await ins('work_jobs', { id, tenant_id, engagement_id, source_id, referral_source_id, member_id, site_id, title, carrier_ref, service_type, insured_name, requested_by, site_address, site_contact, contact_phone, contact_email, fee, status, billed, billed_at, assigned_to, received_date, due_date, visit_scheduled_date, notes, raw_email_text, visit_id, inspection_id, quick_report_id });
}

const CERTS = [
  ['cert-1', 't1', 'u1', 'CSP', iso(day(-900)), iso(day(450))],
  ['cert-2', 't1', 'u1', 'CIH', iso(day(-800)), iso(day(520))],
  ['cert-3', 't1', 'u1', 'ALCM', iso(day(-1200)), iso(day(300))],
  ['cert-4', 't1', 'u1', 'OSHA 500', iso(day(-400)), iso(day(680))],
  ['cert-5', 't1', 'u1', 'FIRST AID/CPR/AED', iso(day(-180)), iso(day(540))],
  ['cert-6', 't1', 'u3', 'CSP', iso(day(-700)), iso(day(390))],
  ['cert-7', 't1', 'u3', 'ARM', iso(day(-600)), iso(day(480))],
  ['cert-8', 't1', 'u3', 'OSHA 510', iso(day(-500)), iso(day(590))],
  ['cert-9', 't1', 'u3', 'FIRST AID/CPR/AED', iso(day(-200)), iso(day(520))],
  ['cert-10', 't1', 'u4', 'ARM', iso(day(-450)), iso(day(610))],
  ['cert-11', 't1', 'u4', 'ALCM', iso(day(-400)), iso(day(660))],
  ['cert-12', 't1', 'u4', 'CSR', iso(day(-350)), iso(day(710))],
  ['cert-13', 't1', 'u4', 'FIRST AID/CPR/AED', iso(day(-90)), iso(day(630))],
  ['cert-14', 't1', 'u5', 'CSP', iso(day(-500)), iso(day(250))],
  ['cert-15', 't1', 'u5', 'OSHA 500', iso(day(-300)), iso(day(780))],
  ['cert-16', 't1', 'u5', 'OSHA 510', iso(day(-650)), iso(day(430))],
  ['cert-17', 't2', 'u7', 'CSP', iso(day(-800)), iso(day(400))],
  ['cert-18', 't2', 'u9', 'CSP', iso(day(-500)), iso(day(500))],
  ['cert-19', 't2', 'u9', 'ARM', iso(day(-400)), iso(day(600))],
];
for (const [id, tenant_id, user_id, code, issued_on, expires_on] of CERTS) {
  await ins('user_certifications', { id, tenant_id, user_id, code, issued_on, expires_on });
}

await ins('user_time_away', {
  id: 'pto-1',
  tenant_id: 't1',
  user_id: 'u4',
  start_date: iso(day(3)),
  end_date: iso(day(4)),
  reason: 'ASSP Western Regional Safety Conference',
});

const OBSERVATIONS = [
  ['obs-1', 't1', 'J-1001', 'm8', 's13', 'u1', 'Unsecured Extension Ladder at West Loading Dock Parapet', '24-foot fiberglass extension ladder positioned at the west loading dock roof access point only extended 18 inches above the upper landing surface and was not tied off at the top support point.', 'Immediately reposition the extension ladder so side rails extend at least 36 inches (3 feet) above the upper landing surface and secure the top rails to a rigid anchor point before any worker ascends.', 'West Loading Dock Roof Access', 'Delta Sheet Metal Subcontractors', 'High', 'open', '29 CFR 1926.1053(b)(1)', 'Cal/OSHA 8 CCR §1675(i)', '/brand/logo.png', 'hazard', 'Walking the west loading dock at Cal Plains Roofing with Jorge Medina. We have an unsecured fiberglass extension ladder used by Delta Sheet Metal that only extends about a foot and a half past the parapet cap and is not tied off.', 1, dt(day(0))],
  ['obs-2', 't1', 'J-1001', 'm8', 's13', 'u1', 'Missing Warning Line Stanchions Along North Roof Edge', 'Warning line flagging along the north low-slope roof perimeter had sagged below 30 inches across a 45-foot span near the HVAC curb opening.', 'Re-tension the warning line rope so its lowest point is between 34 and 39 inches above the walking/working surface and replace the two tipped stanchions.', 'North Roof Perimeter / Bay 4', 'Cal Plains Roofing', 'High', 'open', '29 CFR 1926.502(f)(2)', 'Cal/OSHA 8 CCR §1724(g)', '/brand/logo.png', 'hazard', 'On the north roof perimeter near Bay 4, two warning line stanchions are tipped over and the flagging is sagging down around knee height.', 1, dt(day(0))],
  ['obs-3', 't1', 'J-1001', 'm8', 's13', 'u1', 'Compliant Guardrail & Toeboard Installation at Roof Hatch', 'Permanent yellow tubular steel guardrail system with self-closing safety gate and 4-inch toeboard properly installed around the main interior roof access hatch.', 'Maintain self-closing gate spring tension during monthly superintendent inspections.', 'Center Roof Hatch', 'Cal Plains Roofing', 'Low', 'closed', '29 CFR 1926.502(b)', 'Cal/OSHA 8 CCR §1620', '/brand/logo.png', 'positive', 'The main center roof hatch has a brand new yellow self-closing guardrail and toeboard cage—looks great.', 1, dt(day(0))],
];
for (const [id, tenant_id, job_id, member_id, site_id, created_by, title, description, corrective_action, specific_location, assigned_company, priority, status, federal_citation, state_citation, photo_url, photo_kind, voice_transcript, ai_generated, created_at] of OBSERVATIONS) {
  await ins('observations', { id, tenant_id, job_id, member_id, site_id, created_by, title, description, corrective_action, specific_location, assigned_company, priority, status, federal_citation, state_citation, photo_url, photo_kind, voice_transcript, ai_generated, created_at });
}

await ins('quick_reports', {
  id: 'qr-1',
  tenant_id: 't1',
  job_id: 'J-1005',
  member_id: 'm10',
  site_id: 's15',
  author_id: 'u5',
  template_type: 'post_incident',
  title: 'Post-Incident & Fall Protection Review — Sierra Framing (Lot 14)',
  incident_date: iso(day(-4)),
  sections_json: JSON.stringify({
    what_happened: 'During second-story truss rolling operations on Lot 14, an apprentice carpenter stepped onto an unbraced gable end outlooker that shifted, resulting in an arrested fall into the interior safety net with no lost-time injury.',
    sequence_of_events: '1. Crane set truss bundle on East top plate at 09:15 AM.\n2. Crew lead detached spreader bar before continuous lateral bracing was nailed on trusses T-4 through T-7.\n3. Worker stepped onto top chord at 09:28 AM; outlooker rolled.\n4. Personal fall arrest system (PFAS) engaged within 4.5 feet.',
    contributing_factors: 'Premature release of crane hoist tension prior to installing temporary top-chord lateral restraint (BCSI-B2 guideline) and missing mid-span spacer blocks.',
    root_cause: 'Crew rushed truss unrigging to beat incoming wind gusts without verifying continuous lateral bracing sign-off.',
    overall_exposure: 'Moderate-to-High fall exposure across 6 active residential lots if truss bracing sequencing is not standardized prior to crane release.',
    findings_and_recommendations: '1. [HIGH] Enforce BCSI-B2 temporary lateral bracing verification before unhooking crane rigging (29 CFR 1926.501(b)(13) / Cal/OSHA 8 CCR §1716.2).\n2. [MED] Replace frayed SRL lifeline inspected on Lot 14 west scaffold.',
    program_manager_summary: 'Insured management (Brett Callahan) immediately stood down all 3 framing crews for a 30-minute BCSI truss bracing stand-down. Recommend 30-day follow-up visit under the Golden State Contractors Captive program.'
  }),
  photos_json: JSON.stringify([
    { id: 'p1', label: 'Photo 1 of 3 · Lot 14 East Top Plate Truss Bundle', kind: 'hazard', location: 'Lot 14 Second Story', caption: 'Unbraced gable truss outlooker prior to temporary lateral restraint installation.' },
    { id: 'p2', label: 'Photo 2 of 3 · Interior Fall Arrest Anchor', kind: 'positive', location: 'Lot 14 Ridge Anchor', caption: 'Properly rated 5,000-lb ridge strap anchor that arrested the worker without structural deflection.' },
    { id: 'p3', label: 'Photo 3 of 3 · Stand-Down Sign-In Sheet', kind: 'documentation', location: 'Jobsite Trailer', caption: 'Signed bilingual BCSI-B2 truss bracing stand-down roster (14 crew members).' }
  ]),
  voice_transcript: 'Completed post-incident walk at Sierra Framing Blue Oaks Lot 14 with Brett Callahan. Apprentice was tied off to a ridge anchor when an unbraced outlooker rolled during truss setting. PFAS caught him cleanly, zero injury, but we need strict BCSI-B2 bracing before crane release.',
  field_notes: 'Captive ref GSC-WC-26-0404. Follow-up recommended in 30 days.',
  ai_generated: 1,
  ai_model_used: 'aws_bedrock:qwen.qwen2.5-32b-instruct-v1:0',
  consultant_verified: 1,
  verified_by_name: 'Piotr Kowalski, CSP',
  verified_at: dt(day(-3)),
  status: 'in_qc',
  created_at: dt(day(-3)),
});

const EXPENSES = [
  ['exp-1', 't1', 'u1', 'eng-1', 'J-1001', 'm8', iso(day(-1)), 'Marriott Courtyard West Sacramento', 'lodging', 189.40, null, 1, 'waiting', '/brand/logo.png', 'Overnight stay for early morning Cal Plains Roofing post-incident investigation.'],
  ['exp-2', 't1', 'u1', 'eng-1', 'J-1001', 'm8', iso(day(0)), 'IRS Standard Mileage (94 mi @ $0.67)', 'mileage', 62.98, 94.0, 1, 'waiting', null, 'Round-trip mileage to West Sacramento Industrial Pkwy site.'],
  ['exp-3', 't1', 'u3', 'eng-1', 'J-1004', 'm9', iso(day(-2)), 'SGS Galson Industrial Hygiene Lab', 'supplies', 345.00, null, 1, 'approved', '/brand/logo.png', 'Respirable crystalline silica cassette lab analysis (3 samples).'],
  ['exp-4', 't1', 'u5', 'eng-6', 'J-1008', 'm5', iso(day(-9)), 'Chevron Station #4412 Truckee', 'meals', 42.15, null, 0, 'approved', '/brand/logo.png', 'Field travel meal during Reno OCIP crane audit.'],
];
for (const [id, tenant_id, user_id, engagement_id, job_id, member_id, expense_date, merchant, category, amount, miles, billable, status, receipt_url, notes] of EXPENSES) {
  await ins('expenses', { id, tenant_id, user_id, engagement_id, job_id, member_id, expense_date, merchant, category, amount, miles, billable, status, receipt_url, notes });
}

const weekStart = iso(day(-4));
await ins('timesheets', {
  id: 'ts-1',
  tenant_id: 't1',
  user_id: 'u1',
  week_start: weekStart,
  status: 'waiting',
  total_hours: 38.50,
  overtime_hours: 0.00,
  employee_signature_data: 'Signed electronically: Dana Okafor, CSP, CIH',
  employee_signed_at: dt(day(0)),
  policyholder_signed_by: 'Jorge Medina (Cal Plains Roofing)',
  policyholder_signed_at: dt(day(0)),
  policyholder_signature_method: 'On-glass mobile sign-off',
});
await ins('timesheet_entries', {
  id: 'tse-1', timesheet_id: 'ts-1', job_id: 'J-1001', member_id: 'm8', site_id: 's13',
  mon_hrs: 0, tue_hrs: 0, wed_hrs: 4.5, thu_hrs: 6.0, fri_hrs: 3.5, sat_hrs: 0, sun_hrs: 0, client_sheet_hours: 14.0
});
await ins('timesheet_entries', {
  id: 'tse-2', timesheet_id: 'ts-1', job_id: 'J-1002', member_id: 'm2', site_id: 's4',
  mon_hrs: 8.0, tue_hrs: 8.5, wed_hrs: 4.0, thu_hrs: 2.0, fri_hrs: 2.0, sat_hrs: 0, sun_hrs: 0, client_sheet_hours: 24.5
});

await ins('timesheets', {
  id: 'ts-2',
  tenant_id: 't1',
  user_id: 'u3',
  week_start: weekStart,
  status: 'approved',
  total_hours: 42.00,
  overtime_hours: 2.00,
  employee_signature_data: 'Signed electronically: Jordan Boone, CSP, ARM',
  employee_signed_at: dt(day(-1)),
  policyholder_signed_by: 'Carlos Vega (Valley Paving Co.)',
  policyholder_signed_at: dt(day(-1)),
  policyholder_signature_method: 'Email confirmation link',
});
await ins('timesheet_entries', {
  id: 'tse-3', timesheet_id: 'ts-2', job_id: 'J-1004', member_id: 'm9', site_id: 's14',
  mon_hrs: 8.0, tue_hrs: 9.0, wed_hrs: 8.0, thu_hrs: 9.0, fri_hrs: 8.0, sat_hrs: 0, sun_hrs: 0, client_sheet_hours: 42.0
});

await ins('timesheets', {
  id: 'ts-3',
  tenant_id: 't1',
  user_id: 'u5',
  week_start: weekStart,
  status: 'waiting',
  total_hours: 36.00,
  overtime_hours: 0.00,
  employee_signature_data: 'Signed electronically: Piotr Kowalski, CSP',
  employee_signed_at: dt(day(0)),
  policyholder_signed_by: 'Brett Callahan (Sierra Framing)',
  policyholder_signed_at: dt(day(0)),
  policyholder_signature_method: 'On-glass mobile sign-off',
});
await ins('timesheet_entries', {
  id: 'tse-4', timesheet_id: 'ts-3', job_id: 'J-1005', member_id: 'm10', site_id: 's15',
  mon_hrs: 8.0, tue_hrs: 8.0, wed_hrs: 8.0, thu_hrs: 6.0, fri_hrs: 6.0, sat_hrs: 0, sun_hrs: 0, client_sheet_hours: 36.0
});

console.log('Demo tenants seeded. Recommendations: ' + (recNo - 101) + ' · Loss Control Jobs: ' + WORK_JOBS.length);
await conn.end();
