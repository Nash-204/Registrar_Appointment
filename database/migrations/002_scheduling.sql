-- Migration 002: scheduling, capacity, walk-ins, document checklists, tracking.
-- Run ONCE after schema.sql. Table and column changes are guarded, but re-running would re-add default
-- checklist items you have since edited or renamed, so avoid running it twice.
-- In MySQL Workbench: File > Open SQL Script, then run the whole script (lightning bolt).
USE civil_registry;
SET SQL_SAFE_UPDATES = 0;

CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(60) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purpose VARCHAR(120) NOT NULL UNIQUE,
  grp VARCHAR(40) NOT NULL,
  icon VARCHAR(30) NOT NULL DEFAULT 'other',
  summary VARCHAR(500) NOT NULL DEFAULT '',
  note VARCHAR(500) NOT NULL DEFAULT '',
  duration_minutes SMALLINT NOT NULL DEFAULT 30,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS service_requirements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_id INT NOT NULL,
  label VARCHAR(300) NOT NULL,
  detail VARCHAR(500) NULL,
  kind ENUM('mandatory','conditional') NOT NULL DEFAULT 'mandatory',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_sample TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employee_services (
  employee_id INT NOT NULL,
  service_id INT NOT NULL,
  PRIMARY KEY (employee_id, service_id),
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employee_schedules (
  employee_id INT NOT NULL,
  weekday TINYINT NOT NULL,            -- 1 = Monday ... 5 = Friday
  is_working TINYINT(1) NOT NULL DEFAULT 1,
  start_time TIME NOT NULL DEFAULT '08:00:00',
  end_time TIME NOT NULL DEFAULT '17:00:00',
  lunch_start TIME NULL DEFAULT '12:00:00',
  lunch_end TIME NULL DEFAULT '13:00:00',
  PRIMARY KEY (employee_id, weekday),
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS blocked_dates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NULL,                -- NULL = the whole office is closed that day
  date DATE NOT NULL,
  reason VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_blocked_date (date),
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Helpers so the ALTERs below only run when needed.
DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
DROP PROCEDURE IF EXISTS add_fk_if_missing;
DELIMITER $$
CREATE PROCEDURE add_column_if_missing(IN tbl VARCHAR(64), IN col VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col) THEN
    SET @s = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', ddl);
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
END$$
CREATE PROCEDURE add_index_if_missing(IN tbl VARCHAR(64), IN idx VARCHAR(64), IN cols VARCHAR(200))
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx) THEN
    SET @s = CONCAT('ALTER TABLE `', tbl, '` ADD INDEX `', idx, '` (', cols, ')');
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
END$$
CREATE PROCEDURE add_fk_if_missing(IN tbl VARCHAR(64), IN fk VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND CONSTRAINT_NAME = fk) THEN
    SET @s = CONCAT('ALTER TABLE `', tbl, '` ADD CONSTRAINT `', fk, '` ', ddl);
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
END$$
DELIMITER ;

-- Extend appointments (existing rows and columns are kept).
CALL add_column_if_missing('appointments', 'service_id', 'INT NULL');
CALL add_column_if_missing('appointments', 'source', "ENUM('online','walk_in') NOT NULL DEFAULT 'online'");
CALL add_column_if_missing('appointments', 'duration_minutes', 'SMALLINT NOT NULL DEFAULT 30');
CALL add_column_if_missing('appointments', 'buffer_minutes', 'SMALLINT NOT NULL DEFAULT 0');
CALL add_column_if_missing('appointments', 'end_time', 'TIME NULL');
CALL add_column_if_missing('appointments', 'arrival_time', 'TIME NULL');
CALL add_column_if_missing('appointments', 'started_at', 'DATETIME NULL');
CALL add_column_if_missing('appointments', 'completed_at', 'DATETIME NULL');
CALL add_column_if_missing('appointments', 'checklist_snapshot', 'JSON NULL');
CALL add_index_if_missing('appointments', 'idx_emp_day', 'handled_by, appointment_date');
CALL add_fk_if_missing('appointments', 'fk_appt_service', 'FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL');

-- Backward-compatible statuses: old values stay valid. Walk-ins may have no email.
ALTER TABLE appointments MODIFY status ENUM('pending','confirmed','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending';
ALTER TABLE appointments MODIFY email VARCHAR(160) NULL;

DROP PROCEDURE add_column_if_missing;
DROP PROCEDURE add_index_if_missing;
DROP PROCEDURE add_fk_if_missing;

-- Settings (INSERT IGNORE keeps any value an admin already changed).

INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
('office_open', '08:00'),
('office_close', '17:00'),
('booking_start', '09:00'),
('booking_end', '16:00'),
('buffer_minutes', '5'),
('slot_step_minutes', '10'),
('daily_online_limit', '65'),
('walkin_enabled', '1'),
('walkin_reserve_percent', '20'),
('walkin_release', 'never'),
('walkin_release_time', '14:00'),
('max_days_ahead', '60'),
('checklist_notice', 'Requirements may depend on your circumstances and the applicable civil registry rules. This list is a guide. Our staff will confirm exactly what you need, and may ask for additional documents.');

-- Services and default durations (admin can change these in the dashboard).
INSERT IGNORE INTO services (purpose, grp, icon, summary, note, duration_minutes, sort_order) VALUES
('Register of Birth', 'Register', 'register', 'Record a new birth in the civil registry. This is normally done within 30 days of the birth.', 'Births filed after 30 days are handled as Late Registration.', 20, 1),
('Register of Death', 'Register', 'register', 'Record a death in the civil registry. This is normally done within 30 days of the death.', 'Ask our staff about burial permits when you arrive.', 20, 2),
('Register of Marriage', 'Register', 'register', 'Record a marriage after the ceremony. The marriage certificate is normally filed within 15 days.', 'Applying for a marriage license is a separate process. Ask our staff.', 20, 3),
('Correction of Birth', 'Correction', 'correction', 'Fix a misspelled name or other clerical error, or change a first name, in a birth record.', 'Fees depend on the type of petition. Staff will tell you how many supporting documents are needed.', 60, 4),
('Correction of Death', 'Correction', 'correction', 'Fix a clerical error in a death record.', 'Staff will tell you how many supporting documents are needed.', 60, 5),
('Correction of Marriage', 'Correction', 'correction', 'Fix a clerical error in a marriage record.', 'Staff will tell you how many supporting documents are needed.', 60, 6),
('Request of Birth', 'Request', 'request', 'Get a certified copy of a birth record on file.', 'Fees apply per copy.', 20, 7),
('Request of Death', 'Request', 'request', 'Get a certified copy of a death record on file.', 'Fees apply per copy.', 20, 8),
('Request of Marriage', 'Request', 'request', 'Get a certified copy of a marriage record on file.', 'Fees apply per copy.', 20, 9),
('Late Registration', 'Other services', 'late', 'Register a birth, death or marriage that was not filed within the required period.', 'Adults are usually asked to appear in person. Requirements can vary.', 30, 10),
('Supplemental', 'Other services', 'supplemental', 'Add information that was left out of a record that is already registered, using a supplemental report.', '', 30, 11),
('Acknowledgment', 'Other services', 'acknowledgment', 'A father acknowledges a child born outside of marriage so the record can be annotated.', 'Both parents are usually asked to come in person.', 30, 12),
('Legitimation', 'Other services', 'legitimation', 'Recognize a child as legitimate when the parents, who were free to marry, marry each other later.', 'The parents must have been free to marry each other when the child was conceived.', 30, 13),
('Out of Town', 'Other services', 'out', 'File or request a record for an event that happened in a different city or municipality.', 'Processing can take longer because the other office must receive and act on the record.', 30, 14),
('Others', 'Other services', 'other', 'Anything not listed here, such as annotations, endorsements or other concerns.', '', 30, 15);

-- SAMPLE document checklists. These are placeholders for the office to verify and replace
-- in Admin > Services & documents. Editing an item there clears its "sample" flag.
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Certificate of Live Birth, filled out and signed by the attending doctor, midwife or hospital', 'mandatory', 1 FROM services s WHERE s.purpose = 'Register of Birth' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Certificate of Live Birth, filled out and signed by the attending doctor, midwife or hospital');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Valid ID of the parent or informant filing the birth', 'mandatory', 2 FROM services s WHERE s.purpose = 'Register of Birth' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Valid ID of the parent or informant filing the birth');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Parents’ marriage certificate, if the parents are married', 'conditional', 3 FROM services s WHERE s.purpose = 'Register of Birth' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Parents’ marriage certificate, if the parents are married');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Certificate of Death, filled out and signed by the attending physician or health officer', 'mandatory', 1 FROM services s WHERE s.purpose = 'Register of Death' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Certificate of Death, filled out and signed by the attending physician or health officer');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Valid ID of the person filing (the informant)', 'mandatory', 2 FROM services s WHERE s.purpose = 'Register of Death' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Valid ID of the person filing (the informant)');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Any ID or record showing the deceased person’s full details', 'conditional', 3 FROM services s WHERE s.purpose = 'Register of Death' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Any ID or record showing the deceased person’s full details');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Marriage certificate signed by the couple, the solemnizing officer and the witnesses', 'mandatory', 1 FROM services s WHERE s.purpose = 'Register of Marriage' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Marriage certificate signed by the couple, the solemnizing officer and the witnesses');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Valid IDs of both spouses', 'mandatory', 2 FROM services s WHERE s.purpose = 'Register of Marriage' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Valid IDs of both spouses');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Marriage license, if one was issued', 'conditional', 3 FROM services s WHERE s.purpose = 'Register of Marriage' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Marriage license, if one was issued');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'PSA and local copy of the record that has the error', 'mandatory', 1 FROM services s WHERE s.purpose = 'Correction of Birth' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'PSA and local copy of the record that has the error');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Documents that show the correct entry, such as a baptismal certificate, school records, voter’s record or IDs', 'mandatory', 2 FROM services s WHERE s.purpose = 'Correction of Birth' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Documents that show the correct entry, such as a baptismal certificate, school records, voter’s record or IDs');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Valid government-issued ID', 'mandatory', 3 FROM services s WHERE s.purpose = 'Correction of Birth' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Valid government-issued ID');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'A petition in affidavit form. Our staff will help you prepare it', 'mandatory', 4 FROM services s WHERE s.purpose = 'Correction of Birth' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'A petition in affidavit form. Our staff will help you prepare it');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Extra supporting documents for changes to the day or month of birth, or to sex', 'conditional', 5 FROM services s WHERE s.purpose = 'Correction of Birth' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Extra supporting documents for changes to the day or month of birth, or to sex');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'PSA and local copy of the record that has the error', 'mandatory', 1 FROM services s WHERE s.purpose = 'Correction of Death' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'PSA and local copy of the record that has the error');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Documents that show the correct entry, such as the deceased’s ID, medical or hospital records', 'mandatory', 2 FROM services s WHERE s.purpose = 'Correction of Death' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Documents that show the correct entry, such as the deceased’s ID, medical or hospital records');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Your valid ID and proof of your relationship to the deceased', 'mandatory', 3 FROM services s WHERE s.purpose = 'Correction of Death' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Your valid ID and proof of your relationship to the deceased');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'PSA and local copy of the record that has the error', 'mandatory', 1 FROM services s WHERE s.purpose = 'Correction of Marriage' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'PSA and local copy of the record that has the error');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Documents that show the correct entry, such as birth certificates, baptismal certificates or IDs', 'mandatory', 2 FROM services s WHERE s.purpose = 'Correction of Marriage' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Documents that show the correct entry, such as birth certificates, baptismal certificates or IDs');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Valid government-issued ID', 'mandatory', 3 FROM services s WHERE s.purpose = 'Correction of Marriage' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Valid government-issued ID');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Marriage contract copy, if you have one', 'conditional', 4 FROM services s WHERE s.purpose = 'Correction of Marriage' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Marriage contract copy, if you have one');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Valid government-issued ID', 'mandatory', 1 FROM services s WHERE s.purpose = 'Request of Birth' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Valid government-issued ID');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Full name of the person on the record, birth date, place of birth and parents’ full names', 'mandatory', 2 FROM services s WHERE s.purpose = 'Request of Birth' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Full name of the person on the record, birth date, place of birth and parents’ full names');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'If you are not the owner or an immediate family member: authorization letter and a copy of the owner’s ID', 'conditional', 3 FROM services s WHERE s.purpose = 'Request of Birth' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'If you are not the owner or an immediate family member: authorization letter and a copy of the owner’s ID');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Valid government-issued ID', 'mandatory', 1 FROM services s WHERE s.purpose = 'Request of Death' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Valid government-issued ID');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Full name of the deceased, date of death and place of death', 'mandatory', 2 FROM services s WHERE s.purpose = 'Request of Death' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Full name of the deceased, date of death and place of death');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Proof of relationship, or an authorization letter if you are requesting for someone else', 'conditional', 3 FROM services s WHERE s.purpose = 'Request of Death' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Proof of relationship, or an authorization letter if you are requesting for someone else');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Valid government-issued ID', 'mandatory', 1 FROM services s WHERE s.purpose = 'Request of Marriage' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Valid government-issued ID');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Full names of both spouses, date of marriage and place of marriage', 'mandatory', 2 FROM services s WHERE s.purpose = 'Request of Marriage' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Full names of both spouses, date of marriage and place of marriage');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'If you are not one of the spouses: authorization letter and a copy of a spouse’s ID', 'conditional', 3 FROM services s WHERE s.purpose = 'Request of Marriage' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'If you are not one of the spouses: authorization letter and a copy of a spouse’s ID');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'PSA Certificate of No Record (Negative Certification), which is only valid for a limited time', 'mandatory', 1 FROM services s WHERE s.purpose = 'Late Registration' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'PSA Certificate of No Record (Negative Certification), which is only valid for a limited time');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Accomplished Certificate of Live Birth, Death or Marriage', 'mandatory', 2 FROM services s WHERE s.purpose = 'Late Registration' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Accomplished Certificate of Live Birth, Death or Marriage');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Affidavit for delayed registration explaining why it was not filed on time', 'mandatory', 3 FROM services s WHERE s.purpose = 'Late Registration' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Affidavit for delayed registration explaining why it was not filed on time');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Affidavits of two persons who know the facts of the event', 'mandatory', 4 FROM services s WHERE s.purpose = 'Late Registration' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Affidavits of two persons who know the facts of the event');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Valid government-issued ID', 'mandatory', 5 FROM services s WHERE s.purpose = 'Late Registration' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Valid government-issued ID');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Supporting records such as baptismal certificate, school records or medical records', 'conditional', 6 FROM services s WHERE s.purpose = 'Late Registration' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Supporting records such as baptismal certificate, school records or medical records');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'PSA and local copy of the record that needs the added information', 'mandatory', 1 FROM services s WHERE s.purpose = 'Supplemental' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'PSA and local copy of the record that needs the added information');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Documents that prove the missing information, such as baptismal certificate, school records or IDs', 'mandatory', 2 FROM services s WHERE s.purpose = 'Supplemental' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Documents that prove the missing information, such as baptismal certificate, school records or IDs');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Valid government-issued ID', 'mandatory', 3 FROM services s WHERE s.purpose = 'Supplemental' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Valid government-issued ID');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Supplemental report form. Our staff will provide it', 'mandatory', 4 FROM services s WHERE s.purpose = 'Supplemental' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Supplemental report form. Our staff will provide it');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Child’s birth certificate (PSA and local copy)', 'mandatory', 1 FROM services s WHERE s.purpose = 'Acknowledgment' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Child’s birth certificate (PSA and local copy)');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Affidavit of Acknowledgment or Admission of Paternity. Our staff will provide the form', 'mandatory', 2 FROM services s WHERE s.purpose = 'Acknowledgment' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Affidavit of Acknowledgment or Admission of Paternity. Our staff will provide the form');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Valid IDs of the father and the mother', 'mandatory', 3 FROM services s WHERE s.purpose = 'Acknowledgment' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Valid IDs of the father and the mother');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Affidavit to Use the Surname of the Father, if the child will use it', 'conditional', 4 FROM services s WHERE s.purpose = 'Acknowledgment' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Affidavit to Use the Surname of the Father, if the child will use it');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Child’s birth certificate (PSA and local copy)', 'mandatory', 1 FROM services s WHERE s.purpose = 'Legitimation' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Child’s birth certificate (PSA and local copy)');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Parents’ marriage certificate', 'mandatory', 2 FROM services s WHERE s.purpose = 'Legitimation' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Parents’ marriage certificate');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Affidavit of Legitimation signed by both parents. Our staff will provide the form', 'mandatory', 3 FROM services s WHERE s.purpose = 'Legitimation' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Affidavit of Legitimation signed by both parents. Our staff will provide the form');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Valid IDs of both parents', 'mandatory', 4 FROM services s WHERE s.purpose = 'Legitimation' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Valid IDs of both parents');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Complete details of the event: names, date and place', 'mandatory', 1 FROM services s WHERE s.purpose = 'Out of Town' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Complete details of the event: names, date and place');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Valid government-issued ID', 'mandatory', 2 FROM services s WHERE s.purpose = 'Out of Town' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Valid government-issued ID');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'The same documents required for that type of registration or request', 'conditional', 3 FROM services s WHERE s.purpose = 'Out of Town' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'The same documents required for that type of registration or request');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Valid government-issued ID', 'mandatory', 1 FROM services s WHERE s.purpose = 'Others' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Valid government-issued ID');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'Any records related to your concern', 'conditional', 2 FROM services s WHERE s.purpose = 'Others' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'Any records related to your concern');
INSERT INTO service_requirements (service_id, label, kind, sort_order) SELECT s.id, 'A short description of your concern when you book, so our staff can prepare', 'conditional', 3 FROM services s WHERE s.purpose = 'Others' AND NOT EXISTS (SELECT 1 FROM service_requirements r WHERE r.service_id = s.id AND r.label = 'A short description of your concern when you book, so our staff can prepare');

-- Link existing appointments to services and give them a duration and end time.
UPDATE appointments SET purpose = 'Request of Birth' WHERE purpose = 'Request of Birth Certificate';
UPDATE appointments a
  LEFT JOIN services s ON s.purpose = a.purpose
  SET a.service_id = s.id,
      a.duration_minutes = COALESCE(s.duration_minutes, 30),
      a.end_time = ADDTIME(a.appointment_time, SEC_TO_TIME(COALESCE(s.duration_minutes, 30) * 60))
  WHERE a.end_time IS NULL;

-- Default Monday-Friday schedule (8:00-17:00, lunch 12:00-13:00) for every existing employee.
INSERT IGNORE INTO employee_schedules (employee_id, weekday)
  SELECT u.id, d.n FROM users u
  CROSS JOIN (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) d
  WHERE u.role = 'employee';

-- Existing employees start qualified for every service; narrow this in Admin > Employees.
INSERT IGNORE INTO employee_services (employee_id, service_id)
  SELECT u.id, s.id FROM users u CROSS JOIN services s WHERE u.role = 'employee';
