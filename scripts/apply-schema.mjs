// Applies db/schema.sql. `--drop` drops every table first (destroys data — dev only).
import 'dotenv/config';
import fs from 'node:fs';
import mysql from 'mysql2/promise';

const TABLES = [
  'audit_log','magic_links','photos','rec_events','recommendations','answers','inspections',
  'visit_attendees','visits','question_regulations','questions','form_sections','forms','regulations',
  'sites','member_assignments','member_contacts','members','seat_requests','users','tenants'
];

function parseDbConfig(rawUrl) {
  if (!rawUrl) throw new Error('DATABASE_URL is not set in .env');
  const u = new URL(rawUrl);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    connectTimeout: 5000,
    dateStrings: true,
  };
}

const conn = await mysql.createConnection(parseDbConfig(process.env.DATABASE_URL));
if (process.argv.includes('--drop')) {
  await conn.query('SET FOREIGN_KEY_CHECKS=0');
  for (const t of TABLES) await conn.query('DROP TABLE IF EXISTS `' + t + '`');
  await conn.query('SET FOREIGN_KEY_CHECKS=1');
  console.log('Dropped existing tables.');
}
const sql = fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const statements = sql.split(/^-- @@\s*$/m).map(s => s.replace(/^--.*$/gm, '').trim()).filter(Boolean);
let applied = 0;
let skippedTriggers = 0;
for (const s of statements) {
  const clean = s.replace(/;\s*$/, '');
  try {
    await conn.query(clean);
    applied++;
  } catch (err) {
    if (/^CREATE\s+TRIGGER/i.test(clean) && (err?.errno === 1419 || err?.code === 'ER_BINLOG_CREATE_ROUTINE_NEED_SUPER')) {
      skippedTriggers++;
      console.warn('Warning: MySQL binary logging blocked trigger creation without SUPER privilege (' + clean.split(/\s+/)[2] + '). App-level checks remain active.');
    } else {
      throw err;
    }
  }
}
console.log('Applied ' + applied + ' statements' + (skippedTriggers ? ' (' + skippedTriggers + ' triggers skipped due to MySQL binlog settings).' : '.'));
await conn.end();
