import { q, one } from './db';
import type { Session } from './session';
import { todayISO, type RecStatus, type Priority } from './format';

// Supervisors see their crew; consultants see their own work; owners, admins, underwriting & viewers see tenant-wide (subject to groupScopes).
export async function crewIds(s: Session): Promise<string[] | null> {
  if (s.role === 'owner' || s.role === 'admin' || s.role === 'underwriting' || s.role === 'viewer') return null;
  if (s.role === 'consultant') return [s.user.id];
  const rows = await q<{ id: string }>('SELECT id FROM users WHERE tenant_id=? AND (id=? OR supervisor_id=?)', [s.tenantId, s.user.id, s.user.id]);
  return rows.map(r => r.id);
}

export async function canActOn(s: Session, consultantId: string) {
  const crew = await crewIds(s);
  return !crew || crew.includes(consultantId);
}

export type Tenant = {
  id: string;
  name: string;
  custom_domain: string | null;
  email_sender: string | null;
  email_sender_verified?: number;
  accent: string;
  logo_key: string | null;
  brand_scopes: Record<string, boolean>;
  ai_config_json?: Record<string, any> | null;
  ai_credentials_enc?: string | null;
  sso_config_json?: Record<string, any> | null;
  group_label?: string;
  seats_purchased: number;
  plan?: string;
  status?: string;
  payment_provider: string | null;
};
export async function getTenant(s: Session) {
  const t = await one<any>('SELECT * FROM tenants WHERE id=?', [s.tenantId]);
  if (t && typeof t.brand_scopes === 'string') t.brand_scopes = JSON.parse(t.brand_scopes);
  if (t && typeof t.ai_config_json === 'string') {
    try { t.ai_config_json = JSON.parse(t.ai_config_json); } catch { t.ai_config_json = null; }
  }
  if (t && typeof t.sso_config_json === 'string') {
    try { t.sso_config_json = JSON.parse(t.sso_config_json); } catch { t.sso_config_json = null; }
  }
  return t as Tenant;
}

export async function listUserWorkspaces(email: string) {
  const [plat, tenantRows] = await Promise.all([
    one<{ id: string; role: string; name: string }>(
      "SELECT id, role, name FROM platform_users WHERE LOWER(email)=LOWER(?) AND status='active'",
      [email]
    ),
    q<{ user_id: string; role: string; tenant_id: string; tenant_name: string; accent: string }>(
      `SELECT u.id AS user_id, u.role, t.id AS tenant_id, t.name AS tenant_name, t.accent
         FROM users u
         JOIN tenants t ON t.id = u.tenant_id
        WHERE LOWER(u.email)=LOWER(?) AND u.status='active' AND t.status <> 'suspended'
        ORDER BY t.name`,
      [email]
    ),
  ]);
  return { platform: plat, tenants: tenantRows };
}

export async function listAllTenants() {
  const rows = await q<any>(
    `SELECT t.id, t.name, t.custom_domain, t.email_sender, t.email_sender_verified, t.accent, t.logo_key,
            t.brand_scopes, t.group_label, t.seats_purchased, t.plan, t.status, t.payment_provider, t.created_at,
            (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND u.role NOT IN ('admin','viewer') AND u.is_complimentary_seat = 0 AND u.status <> 'suspended') AS paid_seats_used,
            (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) AS total_users,
            (SELECT COUNT(*) FROM members m WHERE m.tenant_id = t.id) AS member_count,
            (SELECT COUNT(*) FROM inspections i WHERE i.tenant_id = t.id) AS inspection_count,
            (SELECT COUNT(*) FROM recommendations r WHERE r.tenant_id = t.id AND r.status = 'open') AS open_recs
       FROM tenants t
       ORDER BY t.created_at, t.id`
  );
  return rows.map(r => ({
    ...r,
    brand_scopes: typeof r.brand_scopes === 'string' ? JSON.parse(r.brand_scopes) : r.brand_scopes,
  }));
}

export type RecRow = {
  id: string; text: string; priority: Priority; due_on: string; status: RecStatus; question_id: string | null; question_key: string | null;
  inspection_id: string; form_code: string; consultant_id: string; consultant: string;
  member_id: string; member: string; site: string; jurisdiction: string; reg_code: string | null;
  is_repeat: number;
};
export async function listRecs(s: Session): Promise<RecRow[]> {
  const crew = await crewIds(s);
  const params: unknown[] = [s.tenantId];
  let where = 'r.tenant_id = ?';
  if (crew) { where += ' AND i.consultant_id IN (?)'; params.push(crew); }
  if (s.groupScopes.length) { where += ' AND m.group_id IN (?)'; params.push(s.groupScopes); }
  return q<RecRow>(
    `SELECT r.id, r.text, r.priority, r.due_on, r.status, r.question_id, r.question_key, r.is_repeat,
            i.id AS inspection_id, i.form_code, i.consultant_id,
            u.name AS consultant, m.id AS member_id, m.name AS member, st.name AS site, st.jurisdiction, g.code AS reg_code
       FROM recommendations r
       JOIN inspections i ON i.id = r.inspection_id
       JOIN users u ON u.id = i.consultant_id
       JOIN sites st ON st.id = i.site_id
       JOIN members m ON m.id = st.member_id
       LEFT JOIN regulations g ON g.reg_id = r.reg_id
      WHERE ${where}
      ORDER BY r.due_on, r.id`,
    params
  );
}

export async function getRec(s: Session, id: string) {
  const rec = await one<any>(
    `SELECT r.*, i.form_code, i.consultant_id, i.started_at, u.name AS consultant, m.name AS member, m.group_id, st.name AS site, st.jurisdiction,
            COALESCE(qn.question_text, 'Additional site finding') AS question_text,
            COALESCE(qn.topic, 'general') AS topic,
            COALESCE(fs.name, 'General') AS section_name,
            g.code AS reg_code, g.title AS reg_title, g.verified_on AS reg_verified_on, g.status AS reg_status, g.source_url AS reg_source_url,
            rev.name AS revised_by_name,
            (SELECT name FROM member_contacts c WHERE c.member_id = m.id AND c.is_primary = 1 LIMIT 1) AS contact
       FROM recommendations r
       JOIN inspections i ON i.id = r.inspection_id
       JOIN users u ON u.id = i.consultant_id
       JOIN sites st ON st.id = i.site_id
       JOIN members m ON m.id = st.member_id
       LEFT JOIN questions qn ON qn.form_code = i.form_code AND qn.question_id = r.question_id
       LEFT JOIN form_sections fs ON fs.form_code = i.form_code AND fs.section_no = COALESCE(r.section_no, qn.section_no)
       LEFT JOIN regulations g ON g.reg_id = r.reg_id
       LEFT JOIN users rev ON rev.id = r.revised_by
      WHERE r.id = ? AND r.tenant_id = ?`,
    [id, s.tenantId]
  );
  if (!rec || !(await canActOn(s, rec.consultant_id))) return null;
  if (s.groupScopes.length && (!rec.group_id || !s.groupScopes.includes(rec.group_id))) return null;
  const events = await q<any>(
    `SELECT e.at, e.kind, e.note, u.name AS user_name, c.name AS contact_name
       FROM rec_events e LEFT JOIN users u ON u.id = e.actor_user_id LEFT JOIN member_contacts c ON c.id = e.actor_contact_id
      WHERE e.rec_id = ? ORDER BY e.at, e.id`,
    [id]
  );
  return { rec, events, canRevise: s.permissions.has('team:qc.approve') };
}

export async function listInspections(s: Session, search = '') {
  const crew = await crewIds(s);
  const params: unknown[] = [s.tenantId];
  let where = 'i.tenant_id = ?';
  if (crew) { where += ' AND i.consultant_id IN (?)'; params.push(crew); }
  if (s.groupScopes.length) { where += ' AND m.group_id IN (?)'; params.push(s.groupScopes); }
  if (search) { where += ' AND CONCAT_WS(" ", m.name, st.name, f.name, f.code, u.name) LIKE ?'; params.push('%' + search + '%'); }
  return q<any>(
    `SELECT i.id, i.started_at, i.submitted_at, i.form_code, f.name AS form_name, f.scale, f.category, u.name AS consultant, m.name AS member, st.name AS site, st.jurisdiction,
            (SELECT COUNT(*) FROM answers a WHERE a.inspection_id = i.id AND a.value IN ('unsafe','not_addressed','needs_improvement')) AS unsafe,
            (SELECT COUNT(*) FROM recommendations r WHERE r.inspection_id = i.id) AS recs
       FROM inspections i JOIN forms f ON f.code = i.form_code JOIN users u ON u.id = i.consultant_id
       JOIN sites st ON st.id = i.site_id JOIN members m ON m.id = st.member_id
      WHERE ${where} ORDER BY i.started_at DESC`,
    params
  );
}

export async function getInspection(s: Session, id: string) {
  const insp = await one<any>(
    `SELECT i.*, f.name AS form_name, f.scale, f.category, u.name AS consultant, m.name AS member, m.group_id, st.name AS site, st.jurisdiction,
            (SELECT name FROM member_contacts c WHERE c.member_id = m.id AND c.is_primary = 1 LIMIT 1) AS contact,
            (SELECT COUNT(*) FROM questions qq WHERE qq.form_code = i.form_code) AS question_count
       FROM inspections i JOIN forms f ON f.code = i.form_code JOIN users u ON u.id = i.consultant_id
       JOIN sites st ON st.id = i.site_id JOIN members m ON m.id = st.member_id
      WHERE i.id = ? AND i.tenant_id = ?`,
    [id, s.tenantId]
  );
  if (!insp || !(await canActOn(s, insp.consultant_id))) return null;
  if (s.groupScopes.length && (!insp.group_id || !s.groupScopes.includes(insp.group_id))) return null;
  const tallies = await q<{ value: string; n: number }>('SELECT value, COUNT(*) AS n FROM answers WHERE inspection_id=? GROUP BY value', [id]);
  const findings = await q<any>(
    `SELECT r.id, r.rec_number, r.title, r.text, r.original_text, r.revised_at, rev.name AS revised_by_name,
            r.trigger_type, r.scope, r.is_loss_trend, r.priority, r.due_on, r.status, COALESCE(r.question_id, 'ADD') AS question_id, r.question_key,
            COALESCE(fs.name, 'Additional Findings') AS section_name, g.code AS reg_code, g.source_url AS reg_source_url
       FROM recommendations r
       LEFT JOIN questions qn ON qn.form_code = ? AND qn.question_id = r.question_id
       LEFT JOIN form_sections fs ON fs.form_code = ? AND fs.section_no = COALESCE(r.section_no, qn.section_no)
       LEFT JOIN regulations g ON g.reg_id = r.reg_id
       LEFT JOIN users rev ON rev.id = r.revised_by
      WHERE r.inspection_id = ? ORDER BY COALESCE(qn.sort_order, 9999), r.id`,
    [insp.form_code, insp.form_code, id]
  );
  const maturity = insp.scale === 'maturity'
    ? await q<any>(
        `SELECT fs.section_no, fs.name,
                AVG(CASE a.value WHEN 'absent' THEN 0 WHEN 'written' THEN 1 WHEN 'practiced' THEN 2 WHEN 'owned' THEN 3 END) AS avg_level,
                COUNT(a.question_id) AS items
           FROM form_sections fs
           JOIN questions qn ON qn.form_code = fs.form_code AND qn.section_no = fs.section_no
           LEFT JOIN answers a ON a.inspection_id = ? AND a.question_id = qn.question_id AND a.value <> 'na'
          WHERE fs.form_code = ? GROUP BY fs.section_no, fs.name ORDER BY fs.section_no`,
        [id, insp.form_code]
      )
    : [];
  return { insp, tallies: Object.fromEntries(tallies.map(t => [t.value, Number(t.n)])), findings, maturity };
}

export async function listVisits(s: Session, limit?: number) {
  const crew = await crewIds(s);
  const params: unknown[] = [s.tenantId, todayISO()];
  let extra = '';
  if (crew) { extra += ' AND (v.lead_user_id IN (?) OR v.lead_user_id IS NULL)'; params.push(crew); }
  if (s.groupScopes.length) { extra += ' AND m.group_id IN (?)'; params.push(s.groupScopes); }
  const rows = await q<any>(
    `SELECT v.id, v.site_id, v.scheduled_for, v.start_time, v.duration_minutes, v.origin, v.form_code, f.name AS form_name,
            v.lead_user_id, u.name AS lead, cb.name AS created_by_name,
            v.site_contact_name, v.site_contact_phone, v.site_contact_email,
            v.confirm_token, v.confirm_status, v.confirmed_by_name, v.confirmed_by_phone, v.confirm_notes, v.confirmed_at,
            v.required_certs, v.job_id,
            m.id AS member_id, m.name AS member, st.name AS site, st.address AS site_address, st.jurisdiction,
            (SELECT COUNT(*) FROM visit_attendees va WHERE va.visit_id = v.id) AS attendees,
            (SELECT GROUP_CONCAT(va.user_id SEPARATOR ',') FROM visit_attendees va WHERE va.visit_id = v.id) AS attendee_csv
       FROM visits v JOIN forms f ON f.code = v.form_code JOIN sites st ON st.id = v.site_id JOIN members m ON m.id = st.member_id
       LEFT JOIN users u ON u.id = v.lead_user_id JOIN users cb ON cb.id = v.created_by
      WHERE v.tenant_id = ? AND v.scheduled_for >= ?${extra}
      ORDER BY v.scheduled_for, v.start_time ${limit ? 'LIMIT ' + Number(limit) : ''}`,
    params
  );
  return rows.map(r => ({
    ...r,
    attendee_ids: r.attendee_csv ? String(r.attendee_csv).split(',').filter(Boolean) : [],
  }));
}

export async function listMembers(s: Session) {
  const crew = await crewIds(s);
  const members = await q<any>(
    `SELECT m.*,
            g.code AS group_code, g.name AS group_name, g.accent_color AS group_color, g.group_type,
            il.code AS shield_code, il.shield_brand, il.name AS industry_line_name
       FROM members m
       LEFT JOIN tenant_member_groups g ON g.id = m.group_id
       LEFT JOIN industry_lines il ON il.id = m.industry_line_id
      WHERE m.tenant_id=?
      ORDER BY m.name`,
    [s.tenantId]
  );
  const sites = await q<any>('SELECT st.* FROM sites st JOIN members m ON m.id = st.member_id WHERE m.tenant_id=? ORDER BY st.name', [s.tenantId]);
  const assign = await q<any>('SELECT a.member_id, u.id, u.name, u.role FROM member_assignments a JOIN users u ON u.id = a.user_id WHERE u.tenant_id=?', [s.tenantId]);
  const contacts = await q<any>('SELECT c.member_id, c.name, c.email FROM member_contacts c JOIN members m ON m.id = c.member_id WHERE m.tenant_id=? AND c.is_primary=1', [s.tenantId]);
  const rels = await q<any>(
    `SELECT cr.*, mfrom.name AS from_name, mto.name AS to_name
       FROM company_relationships cr
       JOIN members mfrom ON mfrom.id = cr.from_member_id
       JOIN members mto ON mto.id = cr.to_member_id
      WHERE cr.tenant_id=?`,
    [s.tenantId]
  );
  const open = await q<any>(
    `SELECT st.member_id, COUNT(*) AS n FROM recommendations r JOIN inspections i ON i.id = r.inspection_id JOIN sites st ON st.id = i.site_id
      WHERE r.tenant_id=? AND r.status='open' GROUP BY st.member_id`, [s.tenantId]);
  return members
    .map(m => {
      const c = contacts.find(x => x.member_id === m.id);
      let flags: string[] = [];
      if (Array.isArray(m.flags_json)) flags = m.flags_json;
      else if (typeof m.flags_json === 'string' && m.flags_json.trim()) {
        try { flags = JSON.parse(m.flags_json); } catch { flags = []; }
      }
      return {
        ...m,
        flags,
        sites: sites.filter(x => x.member_id === m.id),
        team: assign.filter(a => a.member_id === m.id),
        relationships: rels.filter(r => r.from_member_id === m.id || r.to_member_id === m.id),
        contact: c?.name ?? '',
        contact_email: c?.email ?? '',
        open: Number(open.find(o => o.member_id === m.id)?.n ?? 0),
      };
    })
    .filter(m => (!crew || m.team.some((t: any) => crew.includes(t.id))) && (!s.groupScopes.length || (m.group_id && s.groupScopes.includes(m.group_id))));
}

export async function listFieldStaff(s: Session) {
  const crew = await crewIds(s);
  const rows = await q<any>(
    `SELECT id, name, email, role, status, supervisor_id FROM users
      WHERE tenant_id=? AND role IN ('owner','supervisor','consultant') AND status <> 'suspended'
      ORDER BY FIELD(role,'owner','supervisor','consultant'), name`,
    [s.tenantId]
  );
  return crew ? rows.filter(r => crew.includes(r.id)) : rows;
}

export async function listTeam(s: Session) {
  const [users, overrides, groupScopes] = await Promise.all([
    q<any>(
      `SELECT u.id, u.tenant_id, u.name, u.email, u.role, u.status, u.supervisor_id,
              u.is_platform_admin, u.is_complimentary_seat, u.created_at,
              sup.name AS supervisor_name,
              (SELECT GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ') FROM users c WHERE c.supervisor_id = u.id) AS crew
         FROM users u LEFT JOIN users sup ON sup.id = u.supervisor_id
        WHERE u.tenant_id=? ORDER BY FIELD(u.role,'owner','admin','supervisor','consultant','underwriting','viewer'), u.name`,
      [s.tenantId]
    ),
    q<{ user_id: string; permission_key: string; effect: 'allow' | 'deny' }>(
      'SELECT user_id, permission_key, effect FROM user_permission_overrides WHERE tenant_id=?',
      [s.tenantId]
    ),
    q<{ user_id: string; group_id: string }>(
      'SELECT ugs.user_id, ugs.group_id FROM user_group_scopes ugs JOIN users u ON u.id = ugs.user_id WHERE u.tenant_id=?',
      [s.tenantId]
    ),
  ]);
  return users.map(u => ({
    ...u,
    acl_overrides: overrides.filter(o => o.user_id === u.id),
    group_scopes: groupScopes.filter(g => g.user_id === u.id).map(g => g.group_id),
  }));
}

export async function listSeatRequests(s: Session) {
  return q<any>(
    `SELECT sr.*, req.name AS requested_by_name, decider.name AS decided_by_name
       FROM seat_requests sr
       JOIN users req ON req.id = sr.requested_by
       LEFT JOIN users decider ON decider.id = sr.decided_by
      WHERE sr.tenant_id=?
      ORDER BY FIELD(sr.status,'pending','declined','approved'), sr.created_at DESC`,
    [s.tenantId]
  );
}

export async function listForms(tenantId?: string, opts?: { includeArchived?: boolean }) {
  const archiveFilter = opts?.includeArchived ? '' : ' AND f.is_archived = 0';
  const archiveWhereOnly = opts?.includeArchived ? '' : 'WHERE f.is_archived = 0';
  if (tenantId) {
    return q<any>(
      `SELECT f.code, f.tenant_id, f.name, f.industry, f.shield_code, f.subsector_code, f.category, f.scale, f.description,
              f.allow_additional_findings, f.version, f.published_at, f.is_archived,
              COUNT(qn.question_id) AS n,
              (SELECT COUNT(*) FROM form_sections fs WHERE fs.form_code = f.code) AS sections,
              (SELECT COUNT(*) FROM inspections i WHERE i.form_code = f.code) AS inspection_count,
              (SELECT COUNT(*) FROM visits v WHERE v.form_code = f.code) AS visit_count,
              COALESCE(SUM(qn.is_shared), 0) AS shared
         FROM forms f LEFT JOIN questions qn ON qn.form_code = f.code
        WHERE (f.tenant_id IS NULL OR f.tenant_id = ?)${archiveFilter}
        GROUP BY f.code, f.tenant_id, f.name, f.industry, f.shield_code, f.subsector_code, f.category, f.scale, f.description, f.allow_additional_findings, f.version, f.published_at, f.is_archived
        ORDER BY f.is_archived ASC, f.tenant_id DESC, f.category, f.industry, f.code`,
      [tenantId]
    );
  }
  return q<any>(
    `SELECT f.code, f.tenant_id, f.name, f.industry, f.shield_code, f.subsector_code, f.category, f.scale, f.description,
            f.allow_additional_findings, f.version, f.published_at, f.is_archived,
            COUNT(qn.question_id) AS n,
            (SELECT COUNT(*) FROM form_sections fs WHERE fs.form_code = f.code) AS sections,
            (SELECT COUNT(*) FROM inspections i WHERE i.form_code = f.code) AS inspection_count,
            (SELECT COUNT(*) FROM visits v WHERE v.form_code = f.code) AS visit_count,
            COALESCE(SUM(qn.is_shared), 0) AS shared
       FROM forms f LEFT JOIN questions qn ON qn.form_code = f.code
      ${archiveWhereOnly}
      GROUP BY f.code, f.tenant_id, f.name, f.industry, f.shield_code, f.subsector_code, f.category, f.scale, f.description, f.allow_additional_findings, f.version, f.published_at, f.is_archived
      ORDER BY f.is_archived ASC, f.category, f.industry, f.code`
  );
}

export async function getForm(code: string, sectionNo?: number, tenantId?: string | null) {
  const form = await one<any>(
    tenantId
      ? `SELECT f.*,
                (SELECT COUNT(*) FROM inspections i WHERE i.form_code = f.code) AS inspection_count,
                (SELECT COUNT(*) FROM visits v WHERE v.form_code = f.code) AS visit_count
           FROM forms f WHERE f.code=? AND (f.tenant_id IS NULL OR f.tenant_id=?)`
      : `SELECT f.*,
                (SELECT COUNT(*) FROM inspections i WHERE i.form_code = f.code) AS inspection_count,
                (SELECT COUNT(*) FROM visits v WHERE v.form_code = f.code) AS visit_count
           FROM forms f WHERE f.code=?`,
    tenantId ? [code, tenantId] : [code]
  );
  if (!form) return null;
  const sections = await q<any>(
    `SELECT fs.section_no, fs.name, fs.max_points, COUNT(qn.question_id) AS n
       FROM form_sections fs
       LEFT JOIN questions qn ON qn.form_code = fs.form_code AND qn.section_no = fs.section_no
      WHERE fs.form_code=?
      GROUP BY fs.section_no, fs.name, fs.max_points
      ORDER BY fs.section_no`,
    [code]
  );
  const total = sections.reduce((a, x) => a + Number(x.n), 0);
  const current = sections.find(x => x.section_no === sectionNo) ?? sections[0] ?? { section_no: 1, name: 'General', max_points: null, n: 0 };
  const questions = sections.length
    ? await q<any>(
        `SELECT qn.*,
                (SELECT COUNT(DISTINCT q2.form_code) FROM questions q2 WHERE q2.question_key = qn.question_key) AS shared_forms_count
           FROM questions qn
          WHERE qn.form_code=? AND qn.section_no=? ORDER BY qn.sort_order`,
        [code, current.section_no]
      )
    : [];
  return { form, sections, current, questions, total };
}

export async function listRegs(tenantId?: string | null) {
  if (tenantId) {
    return q<any>('SELECT * FROM regulations WHERE tenant_id IS NULL OR tenant_id = ? ORDER BY jurisdiction, code', [tenantId]);
  }
  return q<any>('SELECT * FROM regulations ORDER BY jurisdiction, code');
}

export async function listJurisdictionPortals() {
  return q<any>(
    `SELECT jp.*,
            jp.agency_name AS agency,
            jp.key_divergences AS divergence_summary,
            jp.big_four_divergence AS diverges_from_fed
       FROM jurisdiction_portals jp
      ORDER BY FIELD(jp.plan_type,'master_repo','federal_master','complete_state_plan','public_sector_state_plan','federal_osha'), jp.name`
  );
}

export async function listIndustryCatalog(tenantId?: string | null) {
  const [lines, subs, disabled] = await Promise.all([
    q<any>(
      tenantId
        ? 'SELECT * FROM industry_lines WHERE (tenant_id IS NULL OR tenant_id = ?) AND is_active = 1 ORDER BY sort_order, name'
        : 'SELECT * FROM industry_lines WHERE is_active = 1 ORDER BY sort_order, name',
      tenantId ? [tenantId] : []
    ),
    q<any>(
      tenantId
        ? 'SELECT * FROM industry_subsectors WHERE (tenant_id IS NULL OR tenant_id = ?) AND is_active = 1 ORDER BY sort_order, name'
        : 'SELECT * FROM industry_subsectors WHERE is_active = 1 ORDER BY sort_order, name',
      tenantId ? [tenantId] : []
    ),
    tenantId
      ? q<{ industry_line_id: string }>('SELECT industry_line_id FROM tenant_disabled_industries WHERE tenant_id=?', [tenantId])
      : Promise.resolve([]),
  ]);
  const disabledSet = new Set(disabled.map(d => d.industry_line_id));
  return lines.map(l => ({
    ...l,
    default_topics: typeof l.default_topics_json === 'string' ? JSON.parse(l.default_topics_json) : (l.default_topics_json || []),
    legacy_aliases: typeof l.legacy_aliases_json === 'string' ? JSON.parse(l.legacy_aliases_json) : (l.legacy_aliases_json || []),
    disabled_for_tenant: disabledSet.has(l.id),
    subsectors: subs.filter(s => s.industry_line_id === l.id),
  }));
}

export async function listTenantTaxonomy(tenantId: string) {
  const [tenant, groups, relTypes, relationships] = await Promise.all([
    one<{ group_label: string }>('SELECT group_label FROM tenants WHERE id=?', [tenantId]),
    q<any>('SELECT * FROM tenant_member_groups WHERE tenant_id=? AND is_active=1 ORDER BY sort_order, name', [tenantId]),
    q<any>('SELECT * FROM tenant_relationship_types WHERE tenant_id=? ORDER BY label', [tenantId]),
    q<any>(
      `SELECT cr.*, mf.name AS from_member_name, mt.name AS to_member_name
         FROM company_relationships cr
         JOIN members mf ON mf.id = cr.from_member_id
         JOIN members mt ON mt.id = cr.to_member_id
        WHERE cr.tenant_id=? ORDER BY cr.created_at DESC`,
      [tenantId]
    ),
  ]);
  return {
    groupLabel: tenant?.group_label || 'Portfolio Groups',
    groups,
    relationshipTypes: relTypes,
    relationships,
  };
}

export async function listBookRecommendations(tenantId?: string | null) {
  return q<any>(
    `SELECT br.*, g.code AS reg_code, g.jurisdiction AS reg_jurisdiction, g.source_url AS reg_source_url
       FROM book_recommendations br
       LEFT JOIN regulations g ON g.reg_id = br.reg_id
      WHERE (br.tenant_id IS NULL ${tenantId ? 'OR br.tenant_id = ?' : ''}) AND br.status = 'active'
      ORDER BY br.tenant_id DESC, br.trigger_type, br.title`,
    tenantId ? [tenantId] : []
  );
}

export async function seatUsage(s: Session) {
  const [rows, paidRow] = await Promise.all([
    q<{ role: string; n: number }>("SELECT role, COUNT(*) AS n FROM users WHERE tenant_id=? AND status <> 'suspended' GROUP BY role", [s.tenantId]),
    one<{ n: number }>(
      "SELECT COUNT(*) AS n FROM users WHERE tenant_id=? AND status <> 'suspended' AND role NOT IN ('admin','viewer') AND is_complimentary_seat = 0",
      [s.tenantId]
    ),
  ]);
  const by = Object.fromEntries(rows.map(r => [r.role, Number(r.n)])) as Record<string, number>;
  // Admin, Viewer, and Platform-Attached Complimentary users consume 0 licensed client seats
  const paid = Number(paidRow?.n ?? 0);
  const t = await getTenant(s);
  return { by, paid, purchased: t.seats_purchased, free: t.seats_purchased - paid };
}

export async function getInspectionReportData(id: string) {
  const insp = await one<any>(
    `SELECT i.*, f.name AS form_name, f.scale, f.category, f.industry, f.shield_code, f.description AS form_description,
            u.name AS consultant, u.email AS consultant_email,
            m.id AS member_id, m.name AS member, m.city AS member_city, m.group_id AS group_id,
            m.description_of_operations AS member_operations, m.employee_count AS member_employees,
            m.broker_name, m.broker_email, m.broker_firm, m.watch_tier,
            g.code AS group_code, g.name AS group_name, g.accent_color AS group_color,
            st.name AS site, st.address AS site_address, st.jurisdiction, st.employee_count AS site_employees,
            st.description_of_operations AS site_operations,
            (SELECT name FROM member_contacts c WHERE c.member_id = m.id AND c.is_primary = 1 LIMIT 1) AS contact,
            (SELECT email FROM member_contacts c WHERE c.member_id = m.id AND c.is_primary = 1 LIMIT 1) AS contact_email,
            (SELECT COUNT(*) FROM questions qq WHERE qq.form_code = i.form_code) AS question_count
       FROM inspections i
       JOIN forms f ON f.code = i.form_code
       JOIN users u ON u.id = i.consultant_id
       JOIN sites st ON st.id = i.site_id
       JOIN members m ON m.id = st.member_id
       LEFT JOIN tenant_member_groups g ON g.id = m.group_id
      WHERE i.id = ?`,
    [id]
  );
  if (!insp) return null;
  if (typeof insp.meta_json === 'string' && insp.meta_json.trim()) {
    try { insp.meta = JSON.parse(insp.meta_json); } catch { insp.meta = {}; }
  } else {
    insp.meta = insp.meta_json || {};
  }
  const tenant = await one<any>('SELECT id, name, custom_domain, email_sender, accent, logo_key, brand_scopes, group_label FROM tenants WHERE id=?', [insp.tenant_id]);
  if (tenant && typeof tenant.brand_scopes === 'string') tenant.brand_scopes = JSON.parse(tenant.brand_scopes);

  const tallies = await q<{ value: string; n: number }>('SELECT value, COUNT(*) AS n FROM answers WHERE inspection_id=? GROUP BY value', [id]);
  const sections = await q<any>('SELECT section_no, name, max_points FROM form_sections WHERE form_code=? ORDER BY section_no', [insp.form_code]);
  const answers = await q<any>(
    `SELECT qn.question_id, qn.question_key, qn.section_no, qn.question_text, qn.recommendation, qn.priority,
            qn.measure_unit, qn.comparison, qn.threshold,
            a.value, a.measured_value, a.na_reason, a.note, a.action_owner, a.target_date
       FROM questions qn
       LEFT JOIN answers a ON a.inspection_id = ? AND a.question_id = qn.question_id
      WHERE qn.form_code = ?
      ORDER BY qn.sort_order`,
    [id, insp.form_code]
  );
  const findings = await q<any>(
    `SELECT r.*, COALESCE(r.question_id, 'ADD') AS q_label,
            COALESCE(fs.name, 'Additional Findings') AS section_name,
            qn.question_text,
            g.code AS reg_code, g.title AS reg_title, g.agency AS reg_agency,
            g.summary AS reg_summary, g.verbatim_text AS reg_verbatim,
            g.verified_on AS reg_verified_on, g.source_url AS reg_source_url,
            rev.name AS revised_by_name
       FROM recommendations r
       LEFT JOIN questions qn ON qn.form_code = ? AND qn.question_id = r.question_id
       LEFT JOIN form_sections fs ON fs.form_code = ? AND fs.section_no = COALESCE(r.section_no, qn.section_no)
       LEFT JOIN regulations g ON g.reg_id = r.reg_id
       LEFT JOIN users rev ON rev.id = r.revised_by
      WHERE r.inspection_id = ?
      ORDER BY COALESCE(qn.sort_order, 9999), r.id`,
    [insp.form_code, insp.form_code, id]
  );
  const photos = await q<any>(
    `SELECT p.*, r.rec_number, r.title AS rec_title
       FROM photos p
       LEFT JOIN recommendations r ON r.id = p.rec_id
      WHERE p.inspection_id = ?
      ORDER BY p.captured_at, p.id`,
    [id]
  );
  const maturity = insp.scale === 'maturity'
    ? await q<any>(
        `SELECT fs.section_no, fs.name,
                AVG(CASE a.value WHEN 'absent' THEN 0 WHEN 'written' THEN 1 WHEN 'practiced' THEN 2 WHEN 'owned' THEN 3 END) AS avg_level,
                COUNT(a.question_id) AS items
           FROM form_sections fs
           JOIN questions qn ON qn.form_code = fs.form_code AND qn.section_no = fs.section_no
           LEFT JOIN answers a ON a.inspection_id = ? AND a.question_id = qn.question_id AND a.value <> 'na'
          WHERE fs.form_code = ? GROUP BY fs.section_no, fs.name ORDER BY fs.section_no`,
        [id, insp.form_code]
      )
    : [];

  return {
    insp,
    tenant,
    tallies: Object.fromEntries(tallies.map(t => [t.value, Number(t.n)])),
    sections,
    answers,
    findings,
    photos,
    maturity,
  };
}

// ---------- Phase 5 (v0.0.2) Loss Control Operating System Queries ----------

export async function listSourcesAndReferrals(s: Session) {
  const [sources, referrals] = await Promise.all([
    q<any>('SELECT * FROM sources WHERE tenant_id=? ORDER BY name', [s.tenantId]),
    q<any>(
      `SELECT r.*, src.name AS source_name, src.source_type
         FROM referral_sources r
         LEFT JOIN sources src ON src.id = r.source_id
        WHERE r.tenant_id=? ORDER BY r.name`,
      [s.tenantId]
    ),
  ]);
  return { sources, referrals };
}

export async function listEngagements(s: Session) {
  const engagements = await q<any>(
    `SELECT e.*,
            src.name AS source_name, src.source_type,
            ref.name AS referral_name, ref.contact_name AS referral_contact,
            m.name AS member_name, m.city AS member_city, m.industry AS member_industry,
            (SELECT COUNT(*) FROM work_jobs j WHERE j.engagement_id = e.id AND j.status = 'delivered' AND j.billed = 0) AS unbilled_delivered_count,
            (SELECT COALESCE(SUM(j.fee), 0) FROM work_jobs j WHERE j.engagement_id = e.id AND j.status = 'delivered' AND j.billed = 0) AS unbilled_delivered_amount
       FROM engagements e
       LEFT JOIN sources src ON src.id = e.source_id
       LEFT JOIN referral_sources ref ON ref.id = e.referral_source_id
       LEFT JOIN members m ON m.id = e.member_id
      WHERE e.tenant_id=?
      ORDER BY e.created_at DESC, e.id`,
    [s.tenantId]
  );
  const serviceLines = await q<any>(
    `SELECT esl.*
       FROM engagement_service_lines esl
       JOIN engagements e ON e.id = esl.engagement_id
      WHERE e.tenant_id=?
      ORDER BY esl.sort_order, esl.id`,
    [s.tenantId]
  );
  return engagements.map(e => ({
    ...e,
    annual_budget: Number(e.annual_budget),
    spent_to_date: Number(e.spent_to_date),
    planned_amount: Number(e.planned_amount),
    billed_amount: Number(e.billed_amount),
    unbilled_delivered_amount: Number(e.unbilled_delivered_amount),
    service_lines: serviceLines
      .filter(l => l.engagement_id === e.id)
      .map(l => ({
        ...l,
        planned_count: l.planned_count !== null ? Number(l.planned_count) : null,
        done_count: l.done_count !== null ? Number(l.done_count) : null,
        rate_each: l.rate_each !== null ? Number(l.rate_each) : null,
        planned_total: Number(l.planned_total),
        spent_total: Number(l.spent_total),
      })),
  }));
}

export async function listWorkJobs(s: Session) {
  const crew = await crewIds(s);
  const params: unknown[] = [s.tenantId];
  let extra = '';
  if (crew) {
    extra = ' AND (j.assigned_to IN (?) OR j.assigned_to IS NULL)';
    params.push(crew);
  }
  const rows = await q<any>(
    `SELECT j.*,
            e.title AS program_title, e.billing_model,
            src.name AS source_name, src.source_type,
            ref.name AS referral_name,
            m.name AS member_name,
            st.name AS site_name, st.jurisdiction,
            u.name AS assigned_to_name
       FROM work_jobs j
       LEFT JOIN engagements e ON e.id = j.engagement_id
       LEFT JOIN sources src ON src.id = j.source_id
       LEFT JOIN referral_sources ref ON ref.id = j.referral_source_id
       LEFT JOIN members m ON m.id = j.member_id
       LEFT JOIN sites st ON st.id = j.site_id
       LEFT JOIN users u ON u.id = j.assigned_to
      WHERE j.tenant_id=?${extra}
      ORDER BY FIELD(j.status,'received','scheduled','visit_done','client_submitted','in_qc','delivered'), j.due_date, j.id`,
    params
  );
  return rows.map(r => ({
    ...r,
    fee: Number(r.fee),
  }));
}

export async function listStaffWithCertifications(s: Session) {
  const [staff, certs, timeAway, visits, jobs] = await Promise.all([
    listFieldStaff(s),
    q<any>('SELECT * FROM user_certifications WHERE tenant_id=? ORDER BY code', [s.tenantId]),
    q<any>('SELECT * FROM user_time_away WHERE tenant_id=? ORDER BY start_date', [s.tenantId]),
    listVisits(s),
    listWorkJobs(s),
  ]);
  return {
    staff: staff.map(u => ({
      ...u,
      certifications: certs.filter(c => c.user_id === u.id),
      time_away: timeAway.filter(t => t.user_id === u.id),
      scheduled_visits: visits.filter(v => v.lead_user_id === u.id || v.attendee_ids.includes(u.id)),
      active_jobs: jobs.filter(j => j.assigned_to === u.id && j.status !== 'delivered'),
    })),
    unassignedJobs: jobs.filter(j => !j.assigned_to),
    unassignedVisits: visits.filter(v => !v.lead_user_id),
    allCerts: ['ALCM', 'ARM', 'CIH', 'CSP', 'CSR', 'FIRST AID/CPR/AED', 'OSHA 500', 'OSHA 510'],
  };
}

export async function listObservations(s: Session, memberId?: string) {
  const params: unknown[] = [s.tenantId];
  let extra = '';
  if (memberId) {
    extra = ' AND o.member_id = ?';
    params.push(memberId);
  }
  return q<any>(
    `SELECT o.*,
            m.name AS member_name,
            st.name AS site_name, st.jurisdiction,
            u.name AS author_name,
            j.title AS job_title, j.carrier_ref
       FROM observations o
       JOIN members m ON m.id = o.member_id
       LEFT JOIN sites st ON st.id = o.site_id
       JOIN users u ON u.id = o.created_by
       LEFT JOIN work_jobs j ON j.id = o.job_id
      WHERE o.tenant_id=?${extra}
      ORDER BY o.created_at DESC, o.id`,
    params
  );
}

export async function listQuickReports(s: Session) {
  const rows = await q<any>(
    `SELECT qr.*,
            m.name AS member_name,
            st.name AS site_name, st.jurisdiction,
            u.name AS author_name,
            j.title AS job_title, j.carrier_ref, j.fee,
            e.title AS program_title
       FROM quick_reports qr
       JOIN members m ON m.id = qr.member_id
       LEFT JOIN sites st ON st.id = qr.site_id
       JOIN users u ON u.id = qr.author_id
       LEFT JOIN work_jobs j ON j.id = qr.job_id
       LEFT JOIN engagements e ON e.id = j.engagement_id
      WHERE qr.tenant_id=?
      ORDER BY qr.created_at DESC`,
    [s.tenantId]
  );
  return rows.map(r => ({
    ...r,
    sections: typeof r.sections_json === 'string' ? JSON.parse(r.sections_json) : r.sections_json,
    photos: typeof r.photos_json === 'string' ? JSON.parse(r.photos_json) : r.photos_json,
  }));
}

export async function getQuickReportById(id: string) {
  const r = await one<any>(
    `SELECT qr.*,
            m.name AS member_name, m.city AS member_city, m.group_id AS group_id,
            st.name AS site_name, st.address AS site_address, st.jurisdiction,
            u.name AS author_name, u.email AS author_email,
            j.title AS job_title, j.carrier_ref, j.requested_by, j.fee,
            e.title AS program_title,
            src.name AS source_name
       FROM quick_reports qr
       JOIN members m ON m.id = qr.member_id
       LEFT JOIN sites st ON st.id = qr.site_id
       JOIN users u ON u.id = qr.author_id
       LEFT JOIN work_jobs j ON j.id = qr.job_id
       LEFT JOIN engagements e ON e.id = j.engagement_id
       LEFT JOIN sources src ON src.id = j.source_id
      WHERE qr.id=?`,
    [id]
  );
  if (!r) return null;
  const tenant = await one<any>(
    'SELECT id, name, custom_domain, email_sender, accent, logo_key, brand_scopes, group_label FROM tenants WHERE id=?',
    [r.tenant_id]
  );
  if (tenant && typeof tenant.brand_scopes === 'string') tenant.brand_scopes = JSON.parse(tenant.brand_scopes);
  return {
    ...r,
    tenant,
    sections: typeof r.sections_json === 'string' ? JSON.parse(r.sections_json) : r.sections_json,
    photos: typeof r.photos_json === 'string' ? JSON.parse(r.photos_json) : r.photos_json,
  };
}

export async function listTimesheetsAndExpenses(s: Session) {
  const crew = await crewIds(s);
  const params: unknown[] = [s.tenantId];
  let userFilter = '';
  if (crew) {
    userFilter = ' AND t.user_id IN (?)';
    params.push(crew);
  }
  const timesheets = await q<any>(
    `SELECT t.*, u.name AS user_name, u.email AS user_email, u.role AS user_role
       FROM timesheets t
       JOIN users u ON u.id = t.user_id
      WHERE t.tenant_id=?${userFilter}
      ORDER BY t.week_start DESC, u.name`,
    params
  );
  const entries = await q<any>(
    `SELECT te.*,
            m.name AS member_name,
            st.name AS site_name,
            j.title AS job_title, j.carrier_ref
       FROM timesheet_entries te
       JOIN timesheets t ON t.id = te.timesheet_id
       JOIN members m ON m.id = te.member_id
       LEFT JOIN sites st ON st.id = te.site_id
       LEFT JOIN work_jobs j ON j.id = te.job_id
      WHERE t.tenant_id=?
      ORDER BY te.id`,
    [s.tenantId]
  );
  const expenses = await q<any>(
    `SELECT ex.*,
            u.name AS user_name,
            m.name AS member_name,
            j.title AS job_title, j.carrier_ref,
            e.title AS program_title
       FROM expenses ex
       JOIN users u ON u.id = ex.user_id
       LEFT JOIN members m ON m.id = ex.member_id
       LEFT JOIN work_jobs j ON j.id = ex.job_id
       LEFT JOIN engagements e ON e.id = ex.engagement_id
      WHERE ex.tenant_id=?${crew ? ' AND ex.user_id IN (?)' : ''}
      ORDER BY ex.expense_date DESC, ex.id`,
    crew ? [s.tenantId, crew] : [s.tenantId]
  );

  return {
    timesheets: timesheets.map(ts => ({
      ...ts,
      total_hours: Number(ts.total_hours),
      overtime_hours: Number(ts.overtime_hours),
      entries: entries
        .filter(e => e.timesheet_id === ts.id)
        .map(e => ({
          ...e,
          mon_hrs: Number(e.mon_hrs),
          tue_hrs: Number(e.tue_hrs),
          wed_hrs: Number(e.wed_hrs),
          thu_hrs: Number(e.thu_hrs),
          fri_hrs: Number(e.fri_hrs),
          sat_hrs: Number(e.sat_hrs),
          sun_hrs: Number(e.sun_hrs),
          client_sheet_hours: e.client_sheet_hours !== null ? Number(e.client_sheet_hours) : null,
        })),
    })),
    expenses: expenses.map(ex => ({
      ...ex,
      amount: Number(ex.amount),
      miles: ex.miles !== null ? Number(ex.miles) : null,
    })),
  };
}

