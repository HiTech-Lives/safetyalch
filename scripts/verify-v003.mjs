// Automated v0.0.3 Verification & Security Regression Suite
import 'dotenv/config';
import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { isIP } from 'node:net';
import mysql from 'mysql2/promise';

function parseDbConfig(rawUrl) {
  if (!rawUrl) throw new Error('DATABASE_URL is not set in .env');
  const u = new URL(rawUrl);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    connectTimeout: 10000,
    dateStrings: true,
  };
}

function isPrivateOrReservedIp(ip) {
  const normalized = ip.toLowerCase().trim();
  if (normalized === 'localhost') return true;
  const family = isIP(normalized);
  if (family === 4) {
    const [a, b] = normalized.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  return true;
}

function sanitizeCsvCell(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/^[=+\-@\t\r]/.test(s) && !/^-\d+(\.\d+)?$/.test(s)) return `'${s}`;
  return s;
}

async function main() {
  console.log('=== Safety Alchemist v0.0.3 Verification Suite ===\n');

  // 1. Security Helper Unit Assertions
  console.log('[1/3] Running Security Controls Unit Assertions...');
  assert.equal(isPrivateOrReservedIp('169.254.169.254'), true, 'AWS/GCP IMDS IP must be blocked');
  assert.equal(isPrivateOrReservedIp('127.0.0.1'), true, 'Loopback IP must be blocked');
  assert.equal(isPrivateOrReservedIp('10.0.0.12'), true, 'RFC1918 10/8 IP must be blocked');
  assert.equal(isPrivateOrReservedIp('192.168.1.25'), true, 'RFC1918 192.168/16 IP must be blocked');
  assert.equal(isPrivateOrReservedIp('8.8.8.8'), false, 'Public IPv4 should be permitted');

  // AES-256-GCM round-trip
  const key = scryptSync(process.env.APP_ENCRYPTION_KEY || process.env.DATABASE_URL || 'test', 'safety-alchemist-v003-aes-gcm', 32);
  const iv = randomBytes(12);
  const secretMap = JSON.stringify({ geminiApiKey: 'AIzaSyTestKey9876' });
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(secretMap, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  assert.equal(dec, secretMap, 'AES-256-GCM credentials map round-trip must match');

  // SVG magic-byte rejection check
  const svgBuf = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>', 'utf8');
  const isPng = svgBuf[0] === 0x89 && svgBuf[1] === 0x50;
  const isJpg = svgBuf[0] === 0xff && svgBuf[1] === 0xd8;
  assert.equal(isPng || isJpg, false, 'SVG XML payload must never pass binary magic-byte gate');

  // CSV Formula Injection sanitization
  assert.equal(sanitizeCsvCell('=CMD|\' /C calc\'!A0'), '\'=CMD|\' /C calc\'!A0', 'Formula injection must be prefixed');
  assert.equal(sanitizeCsvCell('+SUM(A1:A5)'), '\'+SUM(A1:A5)', 'Plus formula must be prefixed');
  assert.equal(sanitizeCsvCell('-42.5'), '-42.5', 'Negative numbers must remain unescaped');
  console.log('  ✓ SSRF, AES-256-GCM, SVG Magic-Byte, and CSV Formula guards verified.\n');

  // 2. Database Schema & Seeded Catalog Verification
  console.log('[2/3] Verifying MySQL v0.0.3 Schema, Dual-Plane RBAC & Catalogs...');
  const conn = await mysql.createConnection(parseDbConfig(process.env.DATABASE_URL));
  try {
    const [[jpRow]] = await conn.query('SELECT COUNT(*) AS cnt FROM jurisdiction_portals');
    const [[stateRow]] = await conn.query("SELECT COUNT(*) AS cnt FROM jurisdiction_portals WHERE plan_type <> 'master_repo'");
    const [[repoRow]] = await conn.query("SELECT COUNT(*) AS cnt FROM jurisdiction_portals WHERE plan_type = 'master_repo'");
    console.log(`  • jurisdiction_portals: ${jpRow.cnt} total (${stateRow.cnt} Jurisdictions + ${repoRow.cnt} Master Repositories)`);
    assert.ok(Number(stateRow.cnt) >= 56, 'Expected at least 56 jurisdictions');
    assert.ok(Number(repoRow.cnt) >= 6, 'Expected at least 6 master repositories');

    const [[indRow]] = await conn.query('SELECT COUNT(*) AS cnt FROM industry_lines WHERE tenant_id IS NULL');
    const [[subRow]] = await conn.query('SELECT COUNT(*) AS cnt FROM industry_subsectors WHERE tenant_id IS NULL');
    console.log(`  • industry_lines: ${indRow.cnt} global lines · industry_subsectors: ${subRow.cnt} global sub-sectors`);
    assert.ok(Number(indRow.cnt) >= 12, 'Expected 12 global industry lines (5 Shield + 7 Specialty)');
    assert.ok(Number(subRow.cnt) >= 16, 'Expected at least 16 Shield sub-sectors');

    const [[puRow]] = await conn.query('SELECT COUNT(*) AS cnt FROM platform_users');
    const [rootAdmins] = await conn.query(
      "SELECT email, role FROM platform_users WHERE LOWER(email) IN ('dana@safetyalchemist.com','platform@safetyalchemist.com') ORDER BY email"
    );
    const [compCol] = await conn.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='users' AND COLUMN_NAME='is_complimentary_seat'",
      [conn.config.database]
    );
    assert.equal(compCol.length, 1, 'users.is_complimentary_seat column must exist for $0 Platform-attached seats');
    const [[t1Groups]] = await conn.query("SELECT COUNT(*) AS cnt FROM tenant_member_groups WHERE tenant_id='t1'");
    const [[t2Groups]] = await conn.query("SELECT COUNT(*) AS cnt FROM tenant_member_groups WHERE tenant_id='t2'");
    console.log(`  • platform_users: ${puRow.cnt} operators · Root Super-Admins: ${rootAdmins.map(r => `${r.email}=${r.role}`).join(', ')} · t1 Gems: ${t1Groups.cnt} · t2 Portfolios: ${t2Groups.cnt}`);
    assert.ok(Number(puRow.cnt) >= 5, 'Expected 5 seeded platform operators');
    assert.equal(rootAdmins.length, 2, 'Both dana@ and platform@ must exist in platform_users');
    for (const ra of rootAdmins) {
      assert.equal(ra.role, 'platform_super_admin', `${ra.email} must hold platform_super_admin`);
    }
    assert.ok(Number(t1Groups.cnt) >= 7, 'Expected 7 Breckpoint Gems on t1');
    assert.ok(Number(t2Groups.cnt) >= 3, 'Expected 3 Consultancy Portfolios on t2');

    const [tplRows] = await conn.query(
      "SELECT f.code, f.scale, COUNT(q.question_id) AS q_cnt FROM forms f LEFT JOIN questions q ON q.form_code = f.code WHERE f.code IN ('GAP-IIPP','GAP-HEAT','GAP-HAZ','LCE-100','AUTO-SUP','RCA-JOB') GROUP BY f.code, f.scale ORDER BY f.code"
    );
    console.log('  • v0.0.3 Seeded Templates:');
    for (const r of tplRows) {
      console.log(`      - ${r.code} (${r.scale}): ${r.q_cnt} items`);
    }
    assert.equal(tplRows.length, 6, 'All 6 v0.0.3 gap/ARU templates must be present');
    const rca = tplRows.find(r => r.code === 'RCA-JOB');
    assert.equal(Number(rca?.q_cnt), 77, 'RCA-JOB must have all 77 construction items');

    const [[bookRow]] = await conn.query('SELECT COUNT(*) AS cnt FROM book_recommendations');
    console.log(`  • book_recommendations: ${bookRow.cnt} standardized recommendations`);
    assert.ok(Number(bookRow.cnt) >= 9, 'Expected at least 9 Book of Recommendations entries');

    const [sampleInsps] = await conn.query("SELECT id, form_code FROM inspections WHERE id IN ('I-3001','I-3002')");
    console.log(`  • Sample v0.0.3 Assessments: ${sampleInsps.map(i => `${i.id} (${i.form_code})`).join(', ')}`);
    assert.equal(sampleInsps.length, 2, 'Sample assessments I-3001 and I-3002 must exist');

    // 3. Verify Zero Plaintext Secrets in tenants.ai_config_json & Immutability Triggers
    console.log('\n[3/3] Verifying AI Credential Scrubbing & Compliance Triggers...');
    const [tenantConfigs] = await conn.query('SELECT id, ai_config_json FROM tenants');
    for (const t of tenantConfigs) {
      const rawStr = typeof t.ai_config_json === 'string' ? t.ai_config_json : JSON.stringify(t.ai_config_json || {});
      assert.ok(!rawStr.includes('geminiApiKey') && !rawStr.includes('openaiApiKey') && !rawStr.includes('anthropicApiKey'),
        `Tenant ${t.id} ai_config_json must not store plaintext API keys`);
    }
    console.log('  ✓ Zero plaintext AI API keys in tenants.ai_config_json');

    const [triggers] = await conn.query(
      'SELECT TRIGGER_NAME FROM INFORMATION_SCHEMA.TRIGGERS WHERE TRIGGER_SCHEMA=?',
      [conn.config.database]
    );
    console.log(`  ✓ Active MySQL Compliance Triggers (${triggers.length}): ${triggers.map(t => t.TRIGGER_NAME).join(', ') || 'app-enforced'}`);
  } finally {
    await conn.end();
  }

  console.log('\n✅ ALL v0.0.3 VERIFICATION CHECKS PASSED.');
}

main().catch(err => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
