// Idempotent, non-destructive v0.0.3 schema & catalog upgrader.
// Safe to run against an existing v0.0.2 staging/production database OR right after scripts/seed.mjs.
import 'dotenv/config';
import fs from 'node:fs';
import { scryptSync, randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

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

export async function runMigrateV003(existingConn = null) {
  const ownConn = !existingConn;
  const conn = existingConn || await mysql.createConnection(parseDbConfig(process.env.DATABASE_URL));
  const dbName = conn.config.database;

  async function hasColumn(table, column) {
    const [rows] = await conn.query(
      'SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?',
      [dbName, table, column]
    );
    return Number(rows[0]?.cnt || 0) > 0;
  }

  async function ensureColumn(table, column, defSql) {
    if (!(await hasColumn(table, column))) {
      await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${defSql}`);
      console.log(`  + Added column ${table}.${column}`);
    }
  }

  async function ensureTrigger(name, sql) {
    const [rows] = await conn.query(
      'SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TRIGGERS WHERE TRIGGER_SCHEMA=? AND TRIGGER_NAME=?',
      [dbName, name]
    );
    if (Number(rows[0]?.cnt || 0) > 0) return;
    try {
      await conn.query(sql);
      console.log(`  + Created trigger ${name}`);
    } catch (err) {
      if (err?.errno === 1419 || err?.code === 'ER_BINLOG_CREATE_ROUTINE_NEED_SUPER') {
        console.warn(`  ! Trigger ${name} skipped (binlog SUPER restriction); app-level enforcement active.`);
      } else {
        throw err;
      }
    }
  }

  console.log('Running v0.0.3 non-destructive schema migration...');

  // 1. Create new tables if missing
  const createStatements = [
    `CREATE TABLE IF NOT EXISTS platform_users (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('platform_super_admin','platform_ops_admin','platform_compliance_editor','platform_support_viewer') NOT NULL,
      status ENUM('active','invited','suspended') NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS platform_user_acl (
      platform_user_id VARCHAR(36) NOT NULL,
      permission_key VARCHAR(80) NOT NULL,
      effect ENUM('allow','deny') NOT NULL,
      updated_by VARCHAR(36) NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (platform_user_id, permission_key),
      FOREIGN KEY (platform_user_id) REFERENCES platform_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS platform_sessions (
      id VARCHAR(36) PRIMARY KEY,
      platform_user_id VARCHAR(36) NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(255) NULL,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (platform_user_id) REFERENCES platform_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS platform_audit_log (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actor_platform_user_id VARCHAR(36) NULL,
      action VARCHAR(80) NOT NULL,
      target_tenant_id VARCHAR(36) NULL,
      entity VARCHAR(40) NOT NULL,
      entity_id VARCHAR(60) NOT NULL,
      detail JSON NULL,
      KEY idx_plat_audit (at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS user_sessions (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(255) NULL,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS platform_impersonation_sessions (
      id VARCHAR(36) PRIMARY KEY,
      platform_user_id VARCHAR(36) NOT NULL,
      target_tenant_id VARCHAR(36) NOT NULL,
      target_user_id VARCHAR(36) NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      reason VARCHAR(500) NOT NULL,
      expires_at DATETIME NOT NULL,
      ended_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (platform_user_id) REFERENCES platform_users(id),
      FOREIGN KEY (target_tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (target_user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS tenant_role_permissions (
      tenant_id VARCHAR(36) NOT NULL,
      role VARCHAR(32) NOT NULL,
      permission_key VARCHAR(80) NOT NULL,
      effect ENUM('allow','deny') NOT NULL,
      PRIMARY KEY (tenant_id, role, permission_key),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS user_permission_overrides (
      tenant_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      permission_key VARCHAR(80) NOT NULL,
      effect ENUM('allow','deny') NOT NULL,
      updated_by VARCHAR(36) NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, permission_key),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS industry_lines (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NULL,
      code VARCHAR(32) NOT NULL,
      name VARCHAR(160) NOT NULL,
      shield_brand VARCHAR(80) NULL,
      is_core_shield TINYINT(1) NOT NULL DEFAULT 0,
      federal_baseline VARCHAR(255) NULL,
      state_overlay_notes TEXT NULL,
      special_rule_alert TEXT NULL,
      default_topics_json JSON NULL,
      legacy_aliases_json JSON NULL,
      sort_order INT NOT NULL DEFAULT 100,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS industry_subsectors (
      id VARCHAR(36) PRIMARY KEY,
      industry_line_id VARCHAR(36) NOT NULL,
      tenant_id VARCHAR(36) NULL,
      code VARCHAR(40) NOT NULL,
      name VARCHAR(160) NOT NULL,
      description TEXT NULL,
      sort_order INT NOT NULL DEFAULT 10,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      FOREIGN KEY (industry_line_id) REFERENCES industry_lines(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS tenant_disabled_industries (
      tenant_id VARCHAR(36) NOT NULL,
      industry_line_id VARCHAR(36) NOT NULL,
      PRIMARY KEY (tenant_id, industry_line_id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (industry_line_id) REFERENCES industry_lines(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS tenant_member_groups (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      code VARCHAR(32) NOT NULL,
      name VARCHAR(160) NOT NULL,
      group_type ENUM('sig_captive','retail_rsa','carrier_program','association','internal_division','custom') NOT NULL DEFAULT 'custom',
      accent_color CHAR(7) NOT NULL DEFAULT '#4b2454',
      billing_mode ENUM('included_captive','fee_for_service','scoro_invoiced','hourly','none') NOT NULL DEFAULT 'included_captive',
      sort_order INT NOT NULL DEFAULT 10,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      UNIQUE KEY uq_tmg_code (tenant_id, code),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS user_group_scopes (
      user_id VARCHAR(36) NOT NULL,
      group_id VARCHAR(36) NOT NULL,
      PRIMARY KEY (user_id, group_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (group_id) REFERENCES tenant_member_groups(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS tenant_relationship_types (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      code VARCHAR(32) NOT NULL,
      label VARCHAR(120) NOT NULL,
      rolls_up_analytics TINYINT(1) NOT NULL DEFAULT 1,
      UNIQUE KEY uq_trt_code (tenant_id, code),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS company_relationships (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      from_member_id VARCHAR(36) NOT NULL,
      to_member_id VARCHAR(36) NOT NULL,
      relationship_code VARCHAR(32) NOT NULL DEFAULT 'PARENT_CHILD',
      notes VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (from_member_id) REFERENCES members(id),
      FOREIGN KEY (to_member_id) REFERENCES members(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS portal_sessions (
      id VARCHAR(36) PRIMARY KEY,
      contact_id VARCHAR(36) NOT NULL,
      member_id VARCHAR(36) NOT NULL,
      tenant_id VARCHAR(36) NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contact_id) REFERENCES member_contacts(id),
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS jurisdiction_portals (
      code VARCHAR(24) PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      plan_type ENUM('master_repo','federal_master','complete_state_plan','public_sector_state_plan','federal_osha') NOT NULL,
      agency_name VARCHAR(190) NOT NULL,
      admin_code_citation VARCHAR(255) NULL,
      portal_url VARCHAR(500) NOT NULL,
      standards_url VARCHAR(500) NULL,
      fed_region VARCHAR(40) NULL,
      big_four_divergence TINYINT(1) NOT NULL DEFAULT 0,
      key_divergences TEXT NULL,
      last_verified_at DATETIME NULL,
      last_http_status INT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS book_recommendations (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NULL,
      title VARCHAR(220) NOT NULL,
      body TEXT NOT NULL,
      trigger_type ENUM('Regulatory','Best Practice','Program','Training','Maintenance','Record Keeping') NOT NULL DEFAULT 'Regulatory',
      priority ENUM('High','Med','Low') NOT NULL DEFAULT 'Med',
      scope ENUM('site_specific','corporate') NOT NULL DEFAULT 'site_specific',
      topic VARCHAR(40) NOT NULL DEFAULT 'general',
      reg_id VARCHAR(40) NULL,
      status ENUM('active','archived') NOT NULL DEFAULT 'active',
      created_by VARCHAR(36) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (reg_id) REFERENCES regulations(reg_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS stored_files (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      member_id VARCHAR(36) NULL,
      inspection_id VARCHAR(20) NULL,
      quick_report_id VARCHAR(36) NULL,
      mime_type VARCHAR(80) NOT NULL,
      byte_size INT NOT NULL,
      disk_path VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NULL,
      uploaded_by_user VARCHAR(36) NULL,
      uploaded_by_contact VARCHAR(36) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS report_share_links (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      entity_type ENUM('inspection','quick_report') NOT NULL,
      entity_id VARCHAR(36) NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      recipient_label VARCHAR(190) NULL,
      report_mode VARCHAR(40) NOT NULL DEFAULT 'full',
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      access_count INT NOT NULL DEFAULT 0,
      last_accessed_at DATETIME NULL,
      created_by VARCHAR(36) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  ];
  for (const stmt of createStatements) {
    await conn.query(stmt);
  }

  // 2. Ensure columns & widened ENUMs on existing tables
  await ensureColumn('tenants', 'email_sender_verified', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER email_sender');
  await ensureColumn('tenants', 'ai_credentials_enc', 'TEXT NULL AFTER ai_config_json');
  await ensureColumn('tenants', 'sso_config_json', 'JSON NULL AFTER ai_credentials_enc');
  await ensureColumn('tenants', 'group_label', "VARCHAR(60) NOT NULL DEFAULT 'Portfolio Groups' AFTER sso_config_json");

  await conn.query("ALTER TABLE users MODIFY COLUMN role ENUM('owner','admin','supervisor','consultant','underwriting','viewer') NOT NULL");
  await conn.query("ALTER TABLE seat_requests MODIFY COLUMN invite_role ENUM('admin','supervisor','consultant','underwriting','viewer') NOT NULL");
  await ensureColumn('users', 'is_complimentary_seat', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER is_platform_admin');

  await ensureColumn('members', 'industry_line_id', 'VARCHAR(36) NULL AFTER industry');
  await ensureColumn('members', 'subsector_code', 'VARCHAR(40) NULL AFTER industry_line_id');
  await ensureColumn('members', 'group_id', 'VARCHAR(36) NULL AFTER subsector_code');
  await ensureColumn('members', 'watch_tier', "ENUM('none','green','yellow','orange','red') NOT NULL DEFAULT 'none' AFTER group_id");
  await ensureColumn('members', 'flags_json', 'JSON NULL AFTER watch_tier');
  await ensureColumn('members', 'broker_name', 'VARCHAR(160) NULL AFTER flags_json');
  await ensureColumn('members', 'broker_email', 'VARCHAR(190) NULL AFTER broker_name');
  await ensureColumn('members', 'broker_firm', 'VARCHAR(190) NULL AFTER broker_email');
  await ensureColumn('members', 'employee_count', 'INT NULL AFTER broker_firm');
  await ensureColumn('members', 'description_of_operations', 'TEXT NULL AFTER employee_count');

  await ensureColumn('sites', 'employee_count', 'INT NULL AFTER jurisdiction');
  await ensureColumn('sites', 'description_of_operations', 'TEXT NULL AFTER employee_count');

  await ensureColumn('forms', 'shield_code', 'VARCHAR(32) NULL AFTER industry');
  await ensureColumn('forms', 'subsector_code', 'VARCHAR(40) NULL AFTER shield_code');
  await ensureColumn('forms', 'category', "ENUM('field_inspection','maturity','policy_gap','lce_100','auto_sup_1_5','rca_percent') NOT NULL DEFAULT 'field_inspection' AFTER subsector_code");
  await conn.query("ALTER TABLE forms MODIFY COLUMN scale ENUM('safe_unsafe_na','maturity','policy_gap','lce_100','auto_sup_1_5','rca_percent') NOT NULL DEFAULT 'safe_unsafe_na'");
  await ensureColumn('forms', 'description', 'TEXT NULL AFTER scale');
  await ensureColumn('forms', 'is_archived', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER allow_additional_findings');

  await ensureColumn('form_sections', 'max_points', 'DECIMAL(8,2) NULL AFTER name');

  await ensureColumn('regulations', 'tenant_id', 'VARCHAR(36) NULL AFTER reg_id');
  await ensureColumn('regulations', 'last_live_checked_at', 'DATETIME NULL AFTER notes');
  await ensureColumn('regulations', 'live_http_status', 'INT NULL AFTER last_live_checked_at');

  await ensureColumn('inspections', 'meta_json', 'JSON NULL AFTER device_id');

  // Note: answers has triggers answers_locked_update / answers_locked_delete, which do NOT block ALTER TABLE MODIFY COLUMN
  await conn.query("ALTER TABLE answers MODIFY COLUMN value ENUM('safe','unsafe','na','absent','written','practiced','owned','addressed','partial','not_addressed','acceptable','needs_improvement','score_1','score_2','score_3','score_4','score_5','points') NOT NULL");
  await ensureColumn('answers', 'action_owner', 'VARCHAR(160) NULL AFTER note');
  await ensureColumn('answers', 'target_date', 'DATE NULL AFTER action_owner');

  await ensureColumn('recommendations', 'rec_number', 'VARCHAR(24) NULL AFTER section_no');
  await ensureColumn('recommendations', 'title', 'VARCHAR(220) NULL AFTER rec_number');
  await ensureColumn('recommendations', 'trigger_type', "ENUM('Regulatory','Best Practice','Program','Training','Maintenance','Record Keeping') NOT NULL DEFAULT 'Regulatory' AFTER revised_at");
  await ensureColumn('recommendations', 'scope', "ENUM('site_specific','corporate') NOT NULL DEFAULT 'site_specific' AFTER trigger_type");
  await ensureColumn('recommendations', 'is_loss_trend', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER scope');
  await ensureColumn('recommendations', 'cost_band', "ENUM('L','M','H') NULL AFTER is_loss_trend");
  await ensureColumn('recommendations', 'member_response', "ENUM('unanswered','agree','disagree') NOT NULL DEFAULT 'unanswered' AFTER cost_band");
  await ensureColumn('recommendations', 'member_response_note', 'TEXT NULL AFTER member_response');

  await ensureColumn('audit_log', 'impersonated_by_platform_user_id', 'VARCHAR(36) NULL AFTER actor_user_id');

  // 3. Ensure append-only audit_log and platform_audit_log triggers
  await ensureTrigger('platform_audit_append_only_u', "CREATE TRIGGER platform_audit_append_only_u BEFORE UPDATE ON platform_audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Platform audit log is append-only.'");
  await ensureTrigger('platform_audit_append_only_d', "CREATE TRIGGER platform_audit_append_only_d BEFORE DELETE ON platform_audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Platform audit log is append-only.'");
  await ensureTrigger('audit_log_append_only_u', "CREATE TRIGGER audit_log_append_only_u BEFORE UPDATE ON audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit log is append-only.'");
  await ensureTrigger('audit_log_append_only_d', "CREATE TRIGGER audit_log_append_only_d BEFORE DELETE ON audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit log is append-only.'");

  // 4. Seed Platform Users (separated from Tenant Users, supporting Unified SSO by email)
  const defaultPlatHash = hashPassword('safetyalchemist');
  const platUsers = [
    ['pu-1', 'Dana Okafor (Platform)', 'dana@safetyalchemist.com', defaultPlatHash, 'platform_super_admin', 'active'],
    ['pu-2', 'Platform Root Super-Admin', 'platform@safetyalchemist.com', defaultPlatHash, 'platform_super_admin', 'active'],
    ['pu-3', 'Celina Freeman (Compliance)', 'compliance@safetyalchemist.com', defaultPlatHash, 'platform_compliance_editor', 'active'],
    ['pu-4', 'SaaS Support Auditor', 'support@safetyalchemist.com', defaultPlatHash, 'platform_support_viewer', 'active'],
    ['pu-5', 'Platform Operations Admin', 'ops@safetyalchemist.com', defaultPlatHash, 'platform_ops_admin', 'active'],
  ];
  for (const [id, name, email, password_hash, role, status] of platUsers) {
    await conn.query(
      'INSERT IGNORE INTO platform_users (id, name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, email, password_hash, role, status]
    );
  }
  // Ensure pu-2 (platform@safetyalchemist.com) holds full Root/System Super-Admin privileges
  await conn.query(
    "UPDATE platform_users SET role='platform_super_admin', name='Platform Root Super-Admin' WHERE id='pu-2' OR LOWER(email)='platform@safetyalchemist.com'"
  );

  // Also seed an underwriting user in t1 so all 6 Team Plane roles can be demonstrated
  const [t1Exists] = await conn.query('SELECT id FROM tenants WHERE id=?', ['t1']);
  if (t1Exists.length) {
    await conn.query(
      'INSERT IGNORE INTO users (id, tenant_id, name, email, password_hash, role, status, supervisor_id, is_platform_admin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['u10', 't1', 'Evelyn Vance (Underwriting)', 'underwriting@safetyalchemist.com', defaultPlatHash, 'underwriting', 'active', null, 0]
    );
  }

  // 5. Seed 56-Jurisdiction Directory + 6 Master Repositories
  const jurData = JSON.parse(fs.readFileSync(new URL('../data/v003_jurisdictions.json', import.meta.url), 'utf8'));
  for (const mr of jurData.masterRepositories) {
    await conn.query(
      `INSERT INTO jurisdiction_portals (code, name, plan_type, agency_name, admin_code_citation, portal_url, standards_url, fed_region, big_four_divergence, key_divergences)
       VALUES (?, ?, 'master_repo', ?, ?, ?, ?, 'National', 0, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), portal_url=VALUES(portal_url), key_divergences=VALUES(key_divergences)`,
      [mr.code, mr.title, mr.authority, mr.code, mr.url, mr.url, mr.description]
    );
  }
  for (const j of jurData.jurisdictions) {
    await conn.query(
      `INSERT INTO jurisdiction_portals (code, name, plan_type, agency_name, admin_code_citation, portal_url, standards_url, fed_region, big_four_divergence, key_divergences)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), plan_type=VALUES(plan_type), agency_name=VALUES(agency_name), admin_code_citation=VALUES(admin_code_citation), portal_url=VALUES(portal_url), standards_url=VALUES(standards_url), fed_region=VALUES(fed_region), big_four_divergence=VALUES(big_four_divergence), key_divergences=VALUES(key_divergences)`,
      [j.jurisdiction_code, j.name, j.plan_type, j.agency_name, j.admin_code_citation, j.portal_url, j.standards_url, j.fed_region, j.big_four_divergence, j.key_divergences]
    );
  }

  // 6. Seed Global Industry Lines (5 Core Shield + 7 Specialty) & Sub-Sectors
  const indData = JSON.parse(fs.readFileSync(new URL('../data/v003_industries.json', import.meta.url), 'utf8'));
  for (const line of indData.industryLines) {
    await conn.query(
      `INSERT INTO industry_lines (id, tenant_id, code, name, shield_brand, is_core_shield, federal_baseline, state_overlay_notes, special_rule_alert, default_topics_json, legacy_aliases_json, sort_order, is_active)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE name=VALUES(name), shield_brand=VALUES(shield_brand), federal_baseline=VALUES(federal_baseline), state_overlay_notes=VALUES(state_overlay_notes), special_rule_alert=VALUES(special_rule_alert), default_topics_json=VALUES(default_topics_json), legacy_aliases_json=VALUES(legacy_aliases_json), sort_order=VALUES(sort_order)`,
      [line.id, line.code, line.name, line.shield_brand, line.is_core_shield, line.federal_baseline, line.state_overlay_notes, line.special_rule_alert, JSON.stringify(line.default_topics), JSON.stringify(line.legacy_aliases), line.sort_order]
    );
    let sOrder = 10;
    for (const sub of line.subsectors) {
      const subId = 'sub-' + sub.code.toLowerCase();
      await conn.query(
        `INSERT INTO industry_subsectors (id, industry_line_id, tenant_id, code, name, description, sort_order, is_active)
         VALUES (?, ?, NULL, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), sort_order=VALUES(sort_order)`,
        [subId, line.id, sub.code, sub.name, sub.description, sOrder]
      );
      sOrder += 10;
    }
  }

  // Map existing v0.0.2 forms to Shield codes & categories
  await conn.query("UPDATE forms SET category='maturity' WHERE code='BSA'");
  const formShieldMap = [
    ['AGRI', ['AGF', 'DRY', 'PHP', 'H2A']],
    ['CONST', ['CFA', 'CSH', 'CTH']],
    ['CULINARY', ['HFA', 'HHR', 'HGC']],
    ['FACTORY', ['MGP', 'FND']],
    ['LOGISTICS', ['WHS']],
    ['SERVICE', ['IIP', 'BSA']],
  ];
  for (const [sc, codes] of formShieldMap) {
    await conn.query(`UPDATE forms SET shield_code=? WHERE code IN (${codes.map(() => '?').join(',')}) AND shield_code IS NULL`, [sc, ...codes]);
  }

  // 7. Seed Tenant-Customizable Portfolio Groups ("Gems" for t1, "Client Portfolios" for t2) & Hierarchy
  if (t1Exists.length) {
    const bp = indData.groupPresets.breckpoint_sig_rsa;
    await conn.query("UPDATE tenants SET group_label=?, email_sender_verified=1 WHERE id='t1' AND group_label='Portfolio Groups'", [bp.label]);
    const groupIdsByCode = {};
    for (const g of bp.groups) {
      const gid = 'grp-t1-' + g.code.toLowerCase();
      groupIdsByCode[g.code] = gid;
      await conn.query(
        'INSERT IGNORE INTO tenant_member_groups (id, tenant_id, code, name, group_type, accent_color, billing_mode, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [gid, 't1', g.code, g.name, g.group_type, g.accent_color, g.billing_mode, g.sort_order]
      );
    }
    for (const rt of bp.relationshipTypes) {
      await conn.query(
        'INSERT IGNORE INTO tenant_relationship_types (id, tenant_id, code, label, rolls_up_analytics) VALUES (?, ?, ?, ?, ?)',
        ['rt-t1-' + rt.code.toLowerCase(), 't1', rt.code, rt.label, rt.rolls_up_analytics]
      );
    }
    // Enrich demo members in t1 with Shield industries, Gems, Watch-List tiers, Brokers & Descriptions of Operations
    const memberEnrichments = [
      ['m1', 'ind-logistics', 'LOG-WAREHOUSE', groupIdsByCode.CLP, 'yellow', ['Fleet Telematics Watch'], 'Rebecca Cho', 'rcho@sierraspecialty.com', 'Sierra Specialty Brokerage', 145, 'Regional cold-chain and dry-goods distribution operating 42 Class-8 tractors and two Central Valley cross-dock warehouses.'],
      ['m2', 'ind-agrishield', 'AGRI-CULTIVATOR', groupIdsByCode.CAN, 'green', ['H-2A Housing'], 'Elena Gomez', 'egomez@cvagbrokers.com', 'Central Valley Ag Brokers', 310, 'Grower-packer-shipper of leafy greens and strawberries across 2,400 acres in Salinas Valley with cold-storage packing house and H-2A housing.'],
      ['m3', 'ind-culinaryshield', 'CULINARY-RESORT', groupIdsByCode.CCN, 'none', [], 'David Park', 'dpark@bayshoreins.com', 'Bayshore Insurance Brokerage', 220, 'Full-service coastal resort hotel, banquet kitchen, spa, and 18-hole championship golf course maintenance operation.'],
      ['m4', 'ind-agrishield', 'AGRI-STOCKMAN', groupIdsByCode.CAN, 'orange', ['Gone Quiet >30d', 'Confined Space'], 'Elena Gomez', 'egomez@cvagbrokers.com', 'Central Valley Ag Brokers', 85, 'Commercial dairy milking 3,800 head with double-40 rotary parlor, Commodity feed mill, and anaerobic manure lagoons.'],
      ['m5', 'ind-constructshield', 'CONST-EXECUTIVE', groupIdsByCode.CAP, 'green', ['OCIP High-Rise'], 'David Park', 'dpark@bayshoreins.com', 'Bayshore Insurance Brokerage', 95, 'Commercial general contractor managing structural steel and mid/high-rise multi-trade construction projects.'],
      ['m6', 'ind-culinaryshield', 'CULINARY-FULL', groupIdsByCode.RSA, 'none', ['Retail Fee Account'], 'Megan Holt', 'mholt@westlinerisk.com', 'Westline Risk Partners', 130, 'Multi-unit wood-fired restaurant and catering group operating two Sacramento urban dining locations.'],
      ['m8', 'ind-constructshield', 'CONST-TRADESMAN', groupIdsByCode.CAP, 'red', ['Focus Risk', 'Recent Near-Miss'], 'Megan Holt', 'mholt@westlinerisk.com', 'Westline Risk Partners', 64, 'Commercial low-slope TPO/hot-applied roofing and architectural sheet metal contractor serving Northern California.'],
      ['m9', 'ind-constructshield', 'CONST-HEAVY', groupIdsByCode.CAP, 'yellow', ['Silica Monitoring'], 'Megan Holt', 'mholt@westlinerisk.com', 'Westline Risk Partners', 112, 'Highway asphalt paving, milling, grading, and batch-plant operator with heavy haul fleet.'],
      ['m10', 'ind-constructshield', 'CONST-TRADESMAN', groupIdsByCode.CAP, 'orange', ['Focus Risk', 'Truss Fall Exposure'], 'David Park', 'dpark@bayshoreins.com', 'Bayshore Insurance Brokerage', 78, 'Production residential wood framing and roof truss erection contractor across multi-lot subdivisions.'],
    ];
    for (const [mid, indId, subCode, gid, tier, flags, bName, bEmail, bFirm, empCount, descOps] of memberEnrichments) {
      await conn.query(
        `UPDATE members SET industry_line_id=COALESCE(industry_line_id, ?), subsector_code=COALESCE(subsector_code, ?), group_id=COALESCE(group_id, ?),
         watch_tier=IF(watch_tier='none', ?, watch_tier), flags_json=COALESCE(flags_json, ?), broker_name=COALESCE(broker_name, ?),
         broker_email=COALESCE(broker_email, ?), broker_firm=COALESCE(broker_firm, ?), employee_count=COALESCE(employee_count, ?),
         description_of_operations=COALESCE(description_of_operations, ?) WHERE id=? AND tenant_id='t1'`,
        [indId, subCode, gid, tier, JSON.stringify(flags), bName, bEmail, bFirm, empCount, descOps, mid]
      );
    }
    // Seed sample Parent/Child & GC/Sub relationships in t1
    await conn.query(
      "INSERT IGNORE INTO company_relationships (id, tenant_id, from_member_id, to_member_id, relationship_code, notes) VALUES ('rel-1', 't1', 'm5', 'm8', 'GC_SUB', 'Summit Builders subcontracts roofing scopes to Cal Plains Roofing')",
    );
    await conn.query(
      "INSERT IGNORE INTO company_relationships (id, tenant_id, from_member_id, to_member_id, relationship_code, notes) VALUES ('rel-2', 't1', 'm5', 'm10', 'GC_SUB', 'Summit Builders subcontracts wood framing packages to Sierra Framing')",
    );
    await conn.query(
      "INSERT IGNORE INTO company_relationships (id, tenant_id, from_member_id, to_member_id, relationship_code, notes) VALUES ('rel-3', 't1', 'm2', 'm4', 'SIBLING', 'Shared family agricultural holding group')",
    );
  }

  const [t2Exists] = await conn.query('SELECT id FROM tenants WHERE id=?', ['t2']);
  if (t2Exists.length) {
    const sc = indData.groupPresets.standard_consultancy;
    await conn.query("UPDATE tenants SET group_label=?, email_sender_verified=1 WHERE id='t2'", [sc.label]);
    for (const g of sc.groups) {
      await conn.query(
        'INSERT IGNORE INTO tenant_member_groups (id, tenant_id, code, name, group_type, accent_color, billing_mode, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
        ['grp-t2-' + g.code.toLowerCase(), 't2', g.code, g.name, g.group_type, g.accent_color, g.billing_mode, g.sort_order]
      );
    }
    for (const rt of sc.relationshipTypes) {
      await conn.query(
        'INSERT IGNORE INTO tenant_relationship_types (id, tenant_id, code, label, rolls_up_analytics) VALUES (?, ?, ?, ?, ?)',
        ['rt-t2-' + rt.code.toLowerCase(), 't2', rt.code, rt.label, rt.rolls_up_analytics]
      );
    }
    await conn.query(
      "UPDATE members SET industry_line_id=COALESCE(industry_line_id, 'ind-maritime'), subsector_code=COALESCE(subsector_code, 'MAR-SHIPYARD'), group_id=COALESCE(group_id, 'grp-t2-carrier'), employee_count=COALESCE(employee_count, 160), description_of_operations=COALESCE(description_of_operations, 'Commercial vessel drydock repair, marine coatings, hot work, and dockside crane rigging on the Duwamish Waterway.') WHERE id='m7' AND tenant_id='t2'"
    );
  }

  // 8. Seed Expanded Regulations, Master Book of Recommendations & 6 Master Templates
  const tplData = JSON.parse(fs.readFileSync(new URL('../data/v003_templates.json', import.meta.url), 'utf8'));
  for (const r of tplData.regulations) {
    await conn.query(
      `INSERT IGNORE INTO regulations (reg_id, tenant_id, jurisdiction, agency, code, title, topic, summary, verbatim_text, source_url, verified_on, verified_by, status, superseded_by, notes)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.reg_id, r.jurisdiction, r.agency, r.code, r.title, r.topic, r.summary, r.verbatim_text, r.source_url, r.verified_on, r.verified_by, r.status, r.superseded_by, r.notes]
    );
  }
  // Upgrade source_url on legacy CSV regulations to exact deep-links (permitted by regulations_never_edit trigger!)
  const deepUrlFixes = [
    ['FED-1910-37', 'https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-E/section-1910.37'],
    ['FED-1910-157', 'https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-L/section-1910.157'],
    ['FED-1910-212', 'https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-O/section-1910.212'],
    ['FED-1910-178', 'https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-N/section-1910.178'],
    ['FED-1910-1200', 'https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-Z/section-1910.1200'],
    ['FED-1910-303', 'https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-S/section-1910.303'],
    ['CA-3272', 'https://www.dir.ca.gov/title8/3272.html'],
    ['CA-6151', 'https://www.dir.ca.gov/title8/6151.html'],
    ['CA-3209', 'https://www.dir.ca.gov/title8/3209.html'],
    ['CA-5194', 'https://www.dir.ca.gov/title8/5194.html'],
    ['NV-618', 'https://www.leg.state.nv.us/nac/NAC-618.html'],
    ['WA-296-800', 'https://app.leg.wa.gov/wac/default.aspx?cite=296-800'],
  ];
  for (const [regId, url] of deepUrlFixes) {
    await conn.query('UPDATE regulations SET source_url=? WHERE reg_id=?', [url, regId]);
  }

  for (const br of tplData.bookRecommendations) {
    await conn.query(
      `INSERT IGNORE INTO book_recommendations (id, tenant_id, title, body, trigger_type, priority, scope, topic, reg_id, status)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [br.id, br.title, br.body, br.trigger_type, br.priority, br.scope, br.topic, br.reg_id]
    );
  }

  const allRegs = (await conn.query('SELECT reg_id, jurisdiction, topic FROM regulations WHERE superseded_by IS NULL'))[0];
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

  for (const tpl of tplData.templates) {
    await conn.query(
      `INSERT INTO forms (code, tenant_id, name, industry, shield_code, category, scale, description, allow_additional_findings, is_archived, version, published_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 1, 0, 1, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), shield_code=VALUES(shield_code), category=VALUES(category), scale=VALUES(scale), description=VALUES(description)`,
      [tpl.code, tpl.name, tpl.industry, tpl.shield_code, tpl.category, tpl.scale, tpl.description, nowStr]
    );
    let sortIdx = 0;
    for (const sec of tpl.sections) {
      await conn.query(
        `INSERT INTO form_sections (form_code, section_no, name, max_points)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), max_points=VALUES(max_points)`,
        [tpl.code, sec.section_no, sec.name, sec.max_points]
      );
      for (const q of sec.questions) {
        const answerType = tpl.scale === 'lce_100' ? 'points' : tpl.scale === 'auto_sup_1_5' ? 'score_1_5' : tpl.scale;
        await conn.query(
          `INSERT INTO questions (form_code, question_id, question_key, section_no, sort_order, question_text, answer_type, na_label, requires_rec, photo_required, priority, topic, measure_unit, comparison, threshold, recommendation, is_shared)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Not applicable to this operation', 1, 0, ?, ?, NULL, NULL, ?, ?, 0)
           ON DUPLICATE KEY UPDATE question_text=VALUES(question_text), priority=VALUES(priority), topic=VALUES(topic), threshold=VALUES(threshold), recommendation=VALUES(recommendation)`,
          [tpl.code, q.id, q.key, sec.section_no, sortIdx++, q.text, answerType, q.priority, q.topic, q.threshold ?? null, q.rec]
        );
        // Link primary regulation per jurisdiction for this question's topic
        const matchingByJur = new Map();
        for (const rg of allRegs) {
          if (rg.topic === q.topic && !matchingByJur.has(rg.jurisdiction)) {
            matchingByJur.set(rg.jurisdiction, rg.reg_id);
          }
        }
        for (const [jur, regId] of matchingByJur) {
          await conn.query(
            `INSERT IGNORE INTO question_regulations (question_key, jurisdiction, reg_id, is_primary, threshold)
             VALUES (?, ?, ?, 1, ?)`,
            [q.key, jur, regId, q.threshold ?? null]
          );
        }
      }
    }
  }

  // 9. Seed Sample Submitted Inspections for GAP-IIPP, LCE-100 & RCA-JOB in t1 (if not already present)
  const [sampleExists] = await conn.query("SELECT id FROM inspections WHERE id='I-3001'");
  if (!sampleExists.length && t1Exists.length) {
    const d5 = new Date(); d5.setDate(d5.getDate() - 5);
    const ts5 = d5.toISOString().slice(0, 19).replace('T', ' ');
    const due30 = new Date(); due30.setDate(due30.getDate() + 25);
    const dueStr = due30.toISOString().slice(0, 10);

    // Sample 1: GAP-IIPP at Valley Crest Farms (s3)
    await conn.query(
      `INSERT INTO inspections (id, tenant_id, site_id, form_code, form_version, consultant_id, device_id, meta_json, started_at, submitted_at)
       VALUES ('I-3001', 't1', 's3', 'GAP-IIPP', 1, 'u1', 'web-console', ?, ?, NULL)`,
      [JSON.stringify({ accompaniedBy: 'A. Castillo, Safety Director', policyDocumentReviewed: 'Valley Crest Farms Written IIPP (Rev. March 2024)', generalComments: 'Written IIPP is well-structured and translated into Spanish, but lacks Jan 1, 2026 SB 513 training record fields and explicit 5-business-day employee access instructions.' }), ts5]
    );
    const iippQs = (await conn.query("SELECT question_id, question_key, section_no, priority, recommendation FROM questions WHERE form_code='GAP-IIPP' ORDER BY sort_order"))[0];
    for (let i = 0; i < iippQs.length; i++) {
      const q = iippQs[i];
      const val = (q.question_id === 'IP-18' || q.question_id === 'IP-19') ? 'not_addressed' : (q.question_id === 'IP-07' ? 'partial' : 'addressed');
      const note = val === 'not_addressed'
        ? 'Missing in March 2024 revision — requires policy addendum.'
        : val === 'partial'
          ? 'Suggestion box present in packing house, but non-reprisal language is omitted from Section 3.'
          : 'Verified in Section ' + q.section_no + ' of Written IIPP.';
      await conn.query(
        'INSERT INTO answers (inspection_id, question_id, question_key, value, note, action_owner, target_date, answered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['I-3001', q.question_id, q.question_key, val, note, val === 'addressed' ? null : 'A. Castillo', val === 'addressed' ? null : dueStr, ts5]
      );
    }
    await conn.query(
      `INSERT INTO recommendations (id, tenant_id, inspection_id, question_id, question_key, section_no, rec_number, title, text, trigger_type, scope, is_loss_trend, priority, due_on, status, reg_id, created_by, created_at)
       VALUES ('R-301', 't1', 'I-3001', 'IP-18', 'GAP-IIPP-18', 8, '11/26*01', 'SB 513 Training Record Upgrade', 'Upgrade all safety training logs to capture employee name, date, duration, provider, core competencies, and resulting qualification per CA SB 513 & 8 CCR §3203(b)(2).', 'Record Keeping', 'corporate', 0, 'High', ?, 'open', 'CA-3203', 'u1', ?)`,
      [dueStr, ts5]
    );
    await conn.query(
      `INSERT INTO recommendations (id, tenant_id, inspection_id, question_id, question_key, section_no, rec_number, title, text, trigger_type, scope, is_loss_trend, priority, due_on, status, reg_id, created_by, created_at)
       VALUES ('R-302', 't1', 'I-3001', 'IP-19', 'GAP-IIPP-19', 9, '11/26*02', '5-Business-Day Written IIPP Access Procedure', 'Add explicit 5-business-day employee right-of-access instructions and designated contact into Section 9 of the written IIPP per 8 CCR §3203(a)(8).', 'Regulatory', 'corporate', 0, 'High', ?, 'open', 'CA-3203', 'u1', ?)`,
      [dueStr, ts5]
    );
    await conn.query("UPDATE inspections SET submitted_at=? WHERE id='I-3001'", [ts5]);

    // Sample 2: RCA-JOB (77-item Construction Survey) at Cal Plains Roofing (s13)
    const rcaMeta = {
      employeesOnSite: 8,
      accompaniedBy: 'Jorge Medina, Operations Superintendent',
      valuationDate: '2026-10-31',
      lossSummaryRows: [
        { period: '2025/2026 YTD', alClaims: 2, alIncurred: 34200, apdClaims: 1, apdIncurred: 6800, glClaims: 0, glIncurred: 0, wcClaims: 3, wcIncurred: 18450 },
        { period: '2024/2025', alClaims: 3, alIncurred: 61500, apdClaims: 2, apdIncurred: 11200, glClaims: 1, glIncurred: 42000, wcClaims: 6, wcIncurred: 54900 },
        { period: '2023/2024', alClaims: 1, alIncurred: 14000, apdClaims: 1, apdIncurred: 4300, glClaims: 0, glIncurred: 0, wcClaims: 5, wcIncurred: 48200 },
      ],
      futureTrainingNeeds: ['Portable Ladder Inspection & 36-Inch Landing Extension Stand-Down', 'Defensive Driving & Telematics Coaching'],
      generalComments: 'Crew of 8 roofing mechanics observed installing TPO membrane. 42 applicable items evaluated (39 Acceptable, 3 Needs Improvement = 92.86% Work Site Score).',
    };
    await conn.query(
      `INSERT INTO inspections (id, tenant_id, site_id, form_code, form_version, consultant_id, device_id, meta_json, started_at, submitted_at)
       VALUES ('I-3002', 't1', 's13', 'RCA-JOB', 1, 'u1', 'web-console', ?, ?, NULL)`,
      [JSON.stringify(rcaMeta), ts5]
    );
    const rcaQs = (await conn.query("SELECT question_id, question_key, section_no FROM questions WHERE form_code='RCA-JOB' ORDER BY sort_order"))[0];
    for (let i = 0; i < rcaQs.length; i++) {
      const q = rcaQs[i];
      let val = 'acceptable';
      let note = null;
      if (['RJ-22', 'RJ-34', 'RJ-49'].includes(q.question_id)) {
        val = 'needs_improvement';
        note = q.question_id === 'RJ-34' ? 'West loading dock extension ladder extended only 18 in. above parapet and lacked tie-off.' : 'Corrective action discussed with Superintendent on site.';
      } else if (i >= 42) {
        val = 'na';
      }
      await conn.query(
        'INSERT INTO answers (inspection_id, question_id, question_key, value, na_reason, note, answered_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['I-3002', q.question_id, q.question_key, val, val === 'na' ? 'Not active on job site today' : null, note, ts5]
      );
    }
    await conn.query(
      `INSERT INTO recommendations (id, tenant_id, inspection_id, question_id, question_key, section_no, rec_number, title, text, trigger_type, scope, is_loss_trend, priority, due_on, status, reg_id, created_by, created_at)
       VALUES ('R-303', 't1', 'I-3002', 'RJ-34', 'RCA-JOB-34', 3, '11/26*01', 'Ladder Safety — 36-Inch Extension & Tie-Off', 'Ensure all portable extension ladders extend at least 36 inches above upper landings, are tied/secured against displacement, and bear legible manufacturer labels.', 'Maintenance', 'site_specific', 1, 'High', ?, 'open', 'CA-1675', 'u1', ?)`,
      [dueStr, ts5]
    );
    await conn.query(
      `INSERT INTO recommendations (id, tenant_id, inspection_id, question_id, question_key, section_no, rec_number, title, text, trigger_type, scope, is_loss_trend, priority, due_on, status, reg_id, created_by, created_at)
       VALUES ('R-304', 't1', 'I-3002', 'RJ-49', 'RCA-JOB-49', 4, '11/26*02', 'Temporary 120V GFCI Spider Box Protection', 'Verify functioning GFCI protection on all temporary 120V roof power cords prior to shift start.', 'Regulatory', 'site_specific', 0, 'High', ?, 'open', 'FED-1910-303', 'u1', ?)`,
      [dueStr, ts5]
    );
    await conn.query("UPDATE inspections SET submitted_at=? WHERE id='I-3002'", [ts5]);
  }

  console.log('v0.0.3 schema & catalog migration completed cleanly.');
  if (ownConn) await conn.end();
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('migrate-v003.mjs')) {
  await runMigrateV003();
}

