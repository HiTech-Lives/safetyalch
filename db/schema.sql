-- The Safety Alchemist · MySQL 8 schema
-- Statements are separated by "-- @@" lines so scripts/apply-schema.mjs can run triggers without DELIMITER.

CREATE TABLE tenants (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  custom_domain VARCHAR(190) NULL UNIQUE,
  email_sender VARCHAR(190) NULL,
  accent CHAR(7) NOT NULL DEFAULT '#4b2454',
  logo_key VARCHAR(255) NULL,
  brand_scopes JSON NOT NULL,
  ai_config_json JSON NULL,
  seats_purchased INT NOT NULL DEFAULT 1,
  plan VARCHAR(40) NOT NULL DEFAULT 'professional',
  status ENUM('active','trial','suspended') NOT NULL DEFAULT 'active',
  payment_provider VARCHAR(40) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NULL,
  role ENUM('owner','admin','supervisor','consultant') NOT NULL,
  status ENUM('active','invited','suspended') NOT NULL DEFAULT 'invited',
  supervisor_id VARCHAR(36) NULL,
  is_platform_admin TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_email (tenant_id, email),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (supervisor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TRIGGER users_max_two_owners BEFORE INSERT ON users FOR EACH ROW
BEGIN
  IF NEW.role = 'owner' AND NEW.status <> 'suspended' AND (SELECT COUNT(*) FROM users WHERE tenant_id = NEW.tenant_id AND role = 'owner' AND status <> 'suspended') >= 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'An account can have at most two Owners.';
  END IF;
END
-- @@
CREATE TRIGGER users_max_two_owners_u BEFORE UPDATE ON users FOR EACH ROW
BEGIN
  IF NEW.role = 'owner' AND NEW.status <> 'suspended' AND (OLD.role <> 'owner' OR OLD.status = 'suspended')
     AND (SELECT COUNT(*) FROM users WHERE tenant_id = NEW.tenant_id AND role = 'owner' AND status <> 'suspended' AND id <> NEW.id) >= 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'An account can have at most two Owners.';
  END IF;
END
-- @@
CREATE TABLE seat_requests (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  requested_by VARCHAR(36) NOT NULL,
  invite_email VARCHAR(190) NOT NULL,
  invite_role ENUM('supervisor','consultant') NOT NULL,
  reason VARCHAR(500) NULL,
  status ENUM('pending','approved','declined') NOT NULL DEFAULT 'pending',
  decided_by VARCHAR(36) NULL,
  decided_at DATETIME NULL,
  decline_reason VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (requested_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE members (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(190) NOT NULL,
  industry VARCHAR(80) NOT NULL,
  city VARCHAR(120) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE member_contacts (
  id VARCHAR(36) PRIMARY KEY,
  member_id VARCHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(190) NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (member_id) REFERENCES members(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE member_assignments (
  member_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (member_id, user_id),
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE sites (
  id VARCHAR(36) PRIMARY KEY,
  member_id VARCHAR(36) NOT NULL,
  name VARCHAR(190) NOT NULL,
  address VARCHAR(255) NULL,
  jurisdiction VARCHAR(8) NOT NULL,
  FOREIGN KEY (member_id) REFERENCES members(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE forms (
  code VARCHAR(16) PRIMARY KEY,
  tenant_id VARCHAR(36) NULL,
  name VARCHAR(190) NOT NULL,
  industry VARCHAR(80) NOT NULL,
  scale ENUM('safe_unsafe_na','maturity') NOT NULL DEFAULT 'safe_unsafe_na',
  allow_additional_findings TINYINT(1) NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 1,
  published_at DATETIME NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE form_sections (
  form_code VARCHAR(16) NOT NULL,
  section_no INT NOT NULL,
  name VARCHAR(190) NOT NULL,
  PRIMARY KEY (form_code, section_no),
  FOREIGN KEY (form_code) REFERENCES forms(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE questions (
  form_code VARCHAR(16) NOT NULL,
  question_id VARCHAR(10) NOT NULL,
  question_key VARCHAR(32) NOT NULL,
  section_no INT NOT NULL,
  sort_order INT NOT NULL,
  question_text TEXT NOT NULL,
  answer_type VARCHAR(20) NOT NULL,
  na_label VARCHAR(255) NULL,
  requires_rec TINYINT(1) NOT NULL DEFAULT 1,
  photo_required TINYINT(1) NOT NULL DEFAULT 0,
  priority ENUM('High','Med','Low') NOT NULL DEFAULT 'Med',
  topic VARCHAR(40) NOT NULL,
  measure_unit VARCHAR(20) NULL,
  comparison ENUM('min','max','exact','range') NULL,
  threshold DECIMAL(10,2) NULL,
  threshold_max DECIMAL(10,2) NULL,
  recommendation TEXT NULL,
  is_shared TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (form_code, question_id),
  KEY idx_q_key (question_key),
  KEY idx_q_topic (topic),
  FOREIGN KEY (form_code, section_no) REFERENCES form_sections(form_code, section_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE regulations (
  reg_id VARCHAR(40) PRIMARY KEY,
  jurisdiction VARCHAR(8) NOT NULL,
  agency VARCHAR(60) NOT NULL,
  code VARCHAR(60) NOT NULL,
  title VARCHAR(255) NOT NULL,
  topic VARCHAR(40) NOT NULL,
  summary TEXT NULL,
  verbatim_text MEDIUMTEXT NULL,
  source_url VARCHAR(500) NULL,
  verified_on DATE NULL,
  verified_by VARCHAR(120) NULL,
  status VARCHAR(60) NOT NULL,
  superseded_by VARCHAR(40) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_reg_lookup (jurisdiction, topic)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TRIGGER regulations_never_edit BEFORE UPDATE ON regulations FOR EACH ROW
BEGIN
  IF OLD.verified_on IS NOT NULL AND NOT (
    OLD.code <=> NEW.code AND OLD.title <=> NEW.title AND OLD.summary <=> NEW.summary AND
    OLD.verbatim_text <=> NEW.verbatim_text AND OLD.jurisdiction <=> NEW.jurisdiction AND OLD.topic <=> NEW.topic
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Verified regulation entries are never edited in place. Create a new entry and set superseded_by.';
  END IF;
END
-- @@
CREATE TRIGGER regulations_never_delete BEFORE DELETE ON regulations FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Regulation entries are never deleted. Mark them superseded.';
-- @@
CREATE TABLE question_regulations (
  question_key VARCHAR(32) NOT NULL,
  jurisdiction VARCHAR(8) NOT NULL,
  reg_id VARCHAR(40) NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 1,
  measure_unit VARCHAR(20) NULL,
  comparison ENUM('min','max','exact','range') NULL,
  threshold DECIMAL(10,2) NULL,
  notes TEXT NULL,
  PRIMARY KEY (question_key, jurisdiction, reg_id),
  KEY idx_qr_lookup (question_key, jurisdiction),
  FOREIGN KEY (reg_id) REFERENCES regulations(reg_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE visits (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  site_id VARCHAR(36) NOT NULL,
  form_code VARCHAR(16) NOT NULL,
  lead_user_id VARCHAR(36) NULL,
  scheduled_for DATE NOT NULL,
  start_time VARCHAR(16) NULL DEFAULT '09:00 AM',
  duration_minutes INT NOT NULL DEFAULT 90,
  origin ENUM('assigned','self') NOT NULL,
  site_contact_name VARCHAR(160) NULL,
  site_contact_phone VARCHAR(60) NULL,
  site_contact_email VARCHAR(190) NULL,
  confirm_token VARCHAR(64) NULL UNIQUE,
  confirm_status ENUM('unconfirmed','sent','confirmed','reschedule_requested') NOT NULL DEFAULT 'unconfirmed',
  confirmed_by_name VARCHAR(160) NULL,
  confirmed_by_phone VARCHAR(60) NULL,
  confirm_notes TEXT NULL,
  confirmed_at DATETIME NULL,
  required_certs VARCHAR(255) NULL,
  job_id VARCHAR(36) NULL,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (site_id) REFERENCES sites(id),
  FOREIGN KEY (form_code) REFERENCES forms(code),
  FOREIGN KEY (lead_user_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE visit_attendees (
  visit_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (visit_id, user_id),
  FOREIGN KEY (visit_id) REFERENCES visits(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE inspections (
  id VARCHAR(20) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  visit_id VARCHAR(36) NULL,
  site_id VARCHAR(36) NOT NULL,
  form_code VARCHAR(16) NOT NULL,
  form_version INT NOT NULL DEFAULT 1,
  consultant_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(80) NULL,
  started_at DATETIME NOT NULL,
  submitted_at DATETIME NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (site_id) REFERENCES sites(id),
  FOREIGN KEY (form_code) REFERENCES forms(code),
  FOREIGN KEY (consultant_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TRIGGER inspections_immutable BEFORE UPDATE ON inspections FOR EACH ROW
BEGIN
  IF OLD.submitted_at IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Submitted inspections are immutable for 7 years.';
  END IF;
END
-- @@
CREATE TRIGGER inspections_no_delete BEFORE DELETE ON inspections FOR EACH ROW
BEGIN
  IF OLD.submitted_at IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Submitted inspections cannot be deleted.';
  END IF;
END
-- @@
CREATE TABLE answers (
  inspection_id VARCHAR(20) NOT NULL,
  question_id VARCHAR(10) NOT NULL,
  question_key VARCHAR(32) NOT NULL,
  value ENUM('safe','unsafe','na','absent','written','practiced','owned') NOT NULL,
  measured_value DECIMAL(10,2) NULL,
  na_reason VARCHAR(255) NULL,
  note TEXT NULL,
  answered_at DATETIME NOT NULL,
  PRIMARY KEY (inspection_id, question_id),
  KEY idx_ans_qkey (question_key),
  FOREIGN KEY (inspection_id) REFERENCES inspections(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TRIGGER answers_locked_update BEFORE UPDATE ON answers FOR EACH ROW
BEGIN
  IF (SELECT submitted_at FROM inspections WHERE id = OLD.inspection_id) IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Answers on a submitted inspection are immutable.';
  END IF;
END
-- @@
CREATE TRIGGER answers_locked_delete BEFORE DELETE ON answers FOR EACH ROW
BEGIN
  IF (SELECT submitted_at FROM inspections WHERE id = OLD.inspection_id) IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Answers on a submitted inspection are immutable.';
  END IF;
END
-- @@
CREATE TABLE recommendations (
  id VARCHAR(20) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  inspection_id VARCHAR(20) NOT NULL,
  question_id VARCHAR(10) NULL,
  question_key VARCHAR(32) NULL,
  section_no INT NULL,
  text TEXT NOT NULL,
  original_text TEXT NULL,
  revised_by VARCHAR(36) NULL,
  revised_at DATETIME NULL,
  priority ENUM('High','Med','Low') NOT NULL,
  due_on DATE NOT NULL,
  status ENUM('open','pending','corrected','assumed') NOT NULL DEFAULT 'open',
  reg_id VARCHAR(40) NULL,
  is_repeat TINYINT(1) NOT NULL DEFAULT 0,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL,
  KEY idx_rec_status (tenant_id, status, due_on),
  KEY idx_rec_qkey (question_key),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (inspection_id) REFERENCES inspections(id),
  FOREIGN KEY (reg_id) REFERENCES regulations(reg_id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE rec_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  rec_id VARCHAR(20) NOT NULL,
  at DATETIME NOT NULL,
  actor_user_id VARCHAR(36) NULL,
  actor_contact_id VARCHAR(36) NULL,
  kind VARCHAR(40) NOT NULL,
  note TEXT NULL,
  KEY idx_ev_rec (rec_id, at),
  FOREIGN KEY (rec_id) REFERENCES recommendations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TRIGGER rec_events_append_only_u BEFORE UPDATE ON rec_events FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recommendation history is append-only.';
-- @@
CREATE TRIGGER rec_events_append_only_d BEFORE DELETE ON rec_events FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recommendation history is append-only.';
-- @@
CREATE TABLE photos (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  inspection_id VARCHAR(20) NOT NULL,
  rec_id VARCHAR(20) NULL,
  kind ENUM('finding','correction') NOT NULL,
  storage_key VARCHAR(255) NOT NULL,
  annotated_key VARCHAR(255) NULL,
  captured_at DATETIME NOT NULL,
  uploaded_by_user VARCHAR(36) NULL,
  uploaded_by_contact VARCHAR(36) NULL,
  FOREIGN KEY (inspection_id) REFERENCES inspections(id),
  FOREIGN KEY (rec_id) REFERENCES recommendations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE magic_links (
  id VARCHAR(36) PRIMARY KEY,
  contact_id VARCHAR(36) NOT NULL,
  inspection_id VARCHAR(20) NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES member_contacts(id),
  FOREIGN KEY (inspection_id) REFERENCES inspections(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_user_id VARCHAR(36) NULL,
  action VARCHAR(60) NOT NULL,
  entity VARCHAR(40) NOT NULL,
  entity_id VARCHAR(40) NOT NULL,
  detail JSON NULL,
  KEY idx_audit (tenant_id, at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE sources (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(190) NOT NULL,
  source_type ENUM('carrier','captive','commercial') NOT NULL DEFAULT 'captive',
  contact_name VARCHAR(160) NULL,
  contact_email VARCHAR(190) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE referral_sources (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  source_id VARCHAR(36) NULL,
  name VARCHAR(190) NOT NULL,
  contact_name VARCHAR(160) NULL,
  contact_email VARCHAR(190) NULL,
  contact_phone VARCHAR(60) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (source_id) REFERENCES sources(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE engagements (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  source_id VARCHAR(36) NULL,
  referral_source_id VARCHAR(36) NULL,
  member_id VARCHAR(36) NULL,
  title VARCHAR(220) NOT NULL,
  billing_model ENUM('drawdown','fixed_deliverable','hourly') NOT NULL DEFAULT 'drawdown',
  annual_budget DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  spent_to_date DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  planned_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  billed_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  deliverables_total INT NOT NULL DEFAULT 0,
  deliverables_done INT NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('on_pace','behind','gone_quiet','completed') NOT NULL DEFAULT 'on_pace',
  last_activity_at DATETIME NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (source_id) REFERENCES sources(id),
  FOREIGN KEY (referral_source_id) REFERENCES referral_sources(id),
  FOREIGN KEY (member_id) REFERENCES members(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE engagement_service_lines (
  id VARCHAR(36) PRIMARY KEY,
  engagement_id VARCHAR(36) NOT NULL,
  service_name VARCHAR(190) NOT NULL,
  unit_type ENUM('fixed_fee','hourly','expense','unplanned') NOT NULL DEFAULT 'fixed_fee',
  planned_count DECIMAL(8,2) NULL,
  done_count DECIMAL(8,2) NULL,
  rate_each DECIMAL(10,2) NULL,
  planned_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  spent_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (engagement_id) REFERENCES engagements(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE work_jobs (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  engagement_id VARCHAR(36) NULL,
  source_id VARCHAR(36) NULL,
  referral_source_id VARCHAR(36) NULL,
  member_id VARCHAR(36) NULL,
  site_id VARCHAR(36) NULL,
  title VARCHAR(220) NOT NULL,
  carrier_ref VARCHAR(80) NULL,
  service_type VARCHAR(120) NOT NULL,
  insured_name VARCHAR(190) NOT NULL,
  requested_by VARCHAR(190) NULL,
  site_address VARCHAR(255) NULL,
  site_contact VARCHAR(160) NULL,
  contact_phone VARCHAR(60) NULL,
  contact_email VARCHAR(190) NULL,
  fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status ENUM('received','scheduled','visit_done','client_submitted','in_qc','delivered') NOT NULL DEFAULT 'received',
  billed TINYINT(1) NOT NULL DEFAULT 0,
  billed_at DATETIME NULL,
  assigned_to VARCHAR(36) NULL,
  received_date DATE NOT NULL,
  due_date DATE NULL,
  visit_scheduled_date DATE NULL,
  notes TEXT NULL,
  raw_email_text MEDIUMTEXT NULL,
  visit_id VARCHAR(36) NULL,
  inspection_id VARCHAR(20) NULL,
  quick_report_id VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (engagement_id) REFERENCES engagements(id),
  FOREIGN KEY (source_id) REFERENCES sources(id),
  FOREIGN KEY (referral_source_id) REFERENCES referral_sources(id),
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (site_id) REFERENCES sites(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE user_certifications (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  code VARCHAR(40) NOT NULL,
  issued_on DATE NOT NULL,
  expires_on DATE NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE user_time_away (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason VARCHAR(190) NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE observations (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  job_id VARCHAR(36) NULL,
  member_id VARCHAR(36) NOT NULL,
  site_id VARCHAR(36) NULL,
  created_by VARCHAR(36) NOT NULL,
  title VARCHAR(220) NOT NULL,
  description TEXT NOT NULL,
  corrective_action TEXT NOT NULL,
  specific_location VARCHAR(190) NULL,
  assigned_company VARCHAR(190) NULL,
  priority ENUM('Low','Med','High','Critical') NOT NULL DEFAULT 'High',
  status ENUM('open','in_progress','closed') NOT NULL DEFAULT 'open',
  federal_citation VARCHAR(190) NULL,
  state_citation VARCHAR(190) NULL,
  photo_url VARCHAR(255) NULL,
  photo_kind ENUM('hazard','positive','documentation') NOT NULL DEFAULT 'hazard',
  voice_transcript TEXT NULL,
  ai_generated TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (site_id) REFERENCES sites(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE quick_reports (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  job_id VARCHAR(36) NULL,
  member_id VARCHAR(36) NOT NULL,
  site_id VARCHAR(36) NULL,
  author_id VARCHAR(36) NOT NULL,
  template_type ENUM('post_incident','equipment_breakdown','followup_survey','commercial_supplement') NOT NULL DEFAULT 'post_incident',
  title VARCHAR(220) NOT NULL,
  incident_date DATE NULL,
  sections_json JSON NOT NULL,
  photos_json JSON NOT NULL,
  voice_transcript TEXT NULL,
  field_notes TEXT NULL,
  ai_generated TINYINT(1) NOT NULL DEFAULT 1,
  ai_model_used VARCHAR(120) NULL,
  consultant_verified TINYINT(1) NOT NULL DEFAULT 0,
  verified_by_name VARCHAR(160) NULL,
  verified_at DATETIME NULL,
  status ENUM('draft','submitted','in_qc','delivered') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (site_id) REFERENCES sites(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE expenses (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  engagement_id VARCHAR(36) NULL,
  job_id VARCHAR(36) NULL,
  member_id VARCHAR(36) NULL,
  expense_date DATE NOT NULL,
  merchant VARCHAR(190) NOT NULL,
  category ENUM('lodging','meals','mileage','airfare','supplies','other') NOT NULL DEFAULT 'other',
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  miles DECIMAL(8,1) NULL,
  billable TINYINT(1) NOT NULL DEFAULT 1,
  status ENUM('waiting','approved','sent_back') NOT NULL DEFAULT 'waiting',
  receipt_url VARCHAR(255) NULL,
  notes VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE timesheets (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  week_start DATE NOT NULL,
  status ENUM('draft','waiting','approved','sent_back') NOT NULL DEFAULT 'waiting',
  total_hours DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  overtime_hours DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  employee_signature_data MEDIUMTEXT NULL,
  employee_signed_at DATETIME NULL,
  policyholder_signed_by VARCHAR(160) NULL,
  policyholder_signed_at DATETIME NULL,
  policyholder_signature_method VARCHAR(60) NULL,
  reviewer_notes VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- @@
CREATE TABLE timesheet_entries (
  id VARCHAR(36) PRIMARY KEY,
  timesheet_id VARCHAR(36) NOT NULL,
  job_id VARCHAR(36) NULL,
  member_id VARCHAR(36) NOT NULL,
  site_id VARCHAR(36) NULL,
  mon_hrs DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  tue_hrs DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  wed_hrs DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  thu_hrs DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  fri_hrs DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  sat_hrs DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  sun_hrs DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  client_sheet_hours DECIMAL(5,2) NULL,
  FOREIGN KEY (timesheet_id) REFERENCES timesheets(id),
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (site_id) REFERENCES sites(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
