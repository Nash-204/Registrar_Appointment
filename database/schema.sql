CREATE DATABASE IF NOT EXISTS civil_registry CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE civil_registry;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','employee') NOT NULL DEFAULT 'employee',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reference_code VARCHAR(30) NOT NULL UNIQUE,
  purpose VARCHAR(120) NOT NULL,
  custom_purpose VARCHAR(255) NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
  handled_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_slot (appointment_date, appointment_time),
  FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS blocked_slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  date DATE NOT NULL,
  time_slot TIME NOT NULL,
  reason VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_block (employee_id, date, time_slot),
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  visitor_name VARCHAR(120) NOT NULL,
  visitor_email VARCHAR(160) NULL,
  visitor_token VARCHAR(64) NOT NULL,
  status ENUM('bot','waiting_handoff','assigned','closed') NOT NULL DEFAULT 'bot',
  assigned_employee_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_employee_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  sender_type ENUM('bot','visitor','employee') NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session (session_id, id),
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor VARCHAR(120) NOT NULL,
  action VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample appointments (no user dependency). Users and blocked slots are created by
-- `npm run seed` in /server so passwords are stored as bcrypt hashes.
INSERT INTO appointments (reference_code, purpose, custom_purpose, full_name, email, phone, appointment_date, appointment_time, status) VALUES
('CR-SAMPLE-0001','Request of Birth',NULL,'Juan Dela Cruz','juan@example.com','09171234567',DATE_ADD(CURDATE(), INTERVAL 3 DAY),'09:00','pending'),
('CR-SAMPLE-0002','Late Registration',NULL,'Liza Santos','liza@example.com','09181234567',DATE_ADD(CURDATE(), INTERVAL 3 DAY),'10:00','confirmed'),
('CR-SAMPLE-0003','Others','Certified true copy of an annotated record','Pedro Reyes','pedro@example.com','09191234567',DATE_ADD(CURDATE(), INTERVAL 4 DAY),'13:00','pending');
