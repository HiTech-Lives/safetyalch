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
await ins('tenants', {
  id: 't1',
  name: 'The Safety Alchemist',
  custom_domain: 'app.safetyalchemist.com',
  email_sender: 'reports@safetyalchemist.com',
  accent: '#4b2454',
  brand_scopes: JSON.stringify({ app: true, reports: true, email: true, portal: true, signin: false }),
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
  ['m1', 't1', 'Ridgeline Distribution', 'Warehouse', 'Fresno, CA', 'M. Ruiz', ['u3'], [['s1', 'Fresno DC', 'CA'], ['s2', 'Bakersfield Yard', 'CA']]],
  ['m2', 't1', 'Valley Crest Farms', 'Agriculture', 'Salinas, CA', 'A. Castillo', ['u1'], [['s3', 'Packing House', 'CA'], ['s4', 'North Ranch', 'CA'], ['s5', 'Labor Camp 3 (H-2A)', 'CA']]],
  ['m3', 't1', 'Harbor Point Resort', 'Hospitality', 'Monterey, CA', 'K. Patel', ['u4'], [['s6', 'Hotel', 'CA'], ['s7', 'Golf course', 'CA']]],
  ['m4', 't1', 'Cascade Dairy', 'Dairy', 'Yakima, WA', 'T. Lindqvist', [], [['s8', 'Main parlor', 'WA']]],
  ['m5', 't1', 'Summit Builders', 'Construction', 'Reno, NV', 'R. Hale', ['u5'], [['s9', 'Midtown Tower', 'NV']]],
  ['m6', 't1', 'Oak & Ember Restaurant Group', 'Hospitality', 'Sacramento, CA', 'J. Moreno', ['u4'], [['s10', 'Midtown', 'CA'], ['s11', 'East Sacramento', 'CA']]],
  ['m7', 't2', 'Puget Sound Marine Works', 'Manufacturing', 'Seattle, WA', 'D. Mercer', ['u7', 'u9'], [['s12', 'Harbor Shipyard', 'WA']]],
];
const siteJ = {}, siteMember = {}, siteTenant = {}, contactOf = {};
for (const [id, tenant_id, name, industry, city, contact, team, sites] of MEMBERS) {
  await ins('members', { id, tenant_id, name, industry, city });
  await ins('member_contacts', { id: 'c-' + id, member_id: id, name: contact, email: contact.toLowerCase().replace(/[^a-z]/g, '') + '@example.com', is_primary: 1 });
  contactOf[id] = { id: 'c-' + id, name: contact };
  for (const u of team) await ins('member_assignments', { member_id: id, user_id: u });
  for (const [sid, sname, j] of sites) {
    await ins('sites', { id: sid, member_id: id, name: sname, jurisdiction: j });
    siteJ[sid] = j;
    siteMember[sid] = id;
    siteTenant[sid] = tenant_id;
  }
}

const VISITS = [
  [0, 's4', 'AGF', 'u1', 'self'],
  [1, 's7', 'HGC', 'u4', 'assigned'],
  [2, 's8', 'DRY', null, 'assigned'],
  [5, 's2', 'WHS', 'u3', 'self', ['u5']],
  [6, 's11', 'HFA', 'u4', 'assigned'],
  [8, 's9', 'CFA', 'u5', 'assigned'],
  [19, 's3', 'BSA', 'u1', 'self'],
  [34, 's1', 'IIP', 'u3', 'assigned'],
  [2, 's12', 'WHS', 'u9', 'assigned'],
];
let vn = 1;
for (const [off, site, form, lead, origin, att] of VISITS) {
  const id = 'v' + vn++;
  const tid = siteTenant[site];
  const creator = origin === 'self' && lead ? lead : (tid === 't2' ? 'u8' : 'u2');
  await ins('visits', { id, tenant_id: tid, site_id: site, form_code: form, lead_user_id: lead, scheduled_for: iso(day(off)), origin, created_by: creator });
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

console.log('Demo tenants seeded. Recommendations: ' + (recNo - 101));
await conn.end();
