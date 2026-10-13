CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY, email VARCHAR(254) NOT NULL, name VARCHAR(80) NOT NULL, password_hash VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(2048) NULL, locale VARCHAR(20) NOT NULL DEFAULT 'es-CO', timezone VARCHAR(80) NOT NULL DEFAULT 'America/Bogota',
  email_verified_at DATETIME(3) NULL, deactivated_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_users_email (email), KEY idx_users_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash VARCHAR(64) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  user_agent VARCHAR(512) NULL, ip_hash VARCHAR(64) NULL,
  KEY idx_sessions_user (user_id), KEY idx_sessions_expiry (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash VARCHAR(64) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, expires_at DATETIME(3) NOT NULL, used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY idx_password_reset_user (user_id), KEY idx_password_reset_expiry (expires_at),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `groups` (
  id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, description TEXT NULL, avatar_url VARCHAR(2048) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'COP', locale VARCHAR(20) NOT NULL DEFAULT 'es-CO', timezone VARCHAR(80) NOT NULL DEFAULT 'America/Bogota',
  created_by VARCHAR(36) NOT NULL, archived_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_groups_creator (created_by), KEY idx_groups_archived (archived_at),
  CONSTRAINT fk_groups_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS group_members (
  id VARCHAR(36) PRIMARY KEY, group_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL, role VARCHAR(12) NOT NULL DEFAULT 'member', status VARCHAR(12) NOT NULL DEFAULT 'active',
  joined_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), left_at DATETIME(3) NULL,
  UNIQUE KEY uq_group_members_group_user (group_id,user_id), KEY idx_group_members_user_status (user_id,status), KEY idx_group_members_group_status (group_id,status),
  CONSTRAINT fk_members_group FOREIGN KEY (group_id) REFERENCES `groups`(id), CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS group_role_permissions (
  id VARCHAR(36) PRIMARY KEY, group_id VARCHAR(36) NOT NULL, role VARCHAR(12) NOT NULL, permissions JSON NOT NULL, updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), updated_by VARCHAR(36) NOT NULL,
  UNIQUE KEY uq_group_role_permissions (group_id,role), CONSTRAINT fk_permissions_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE, CONSTRAINT fk_permissions_user FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS group_invitations (
  id VARCHAR(36) PRIMARY KEY, group_id VARCHAR(36) NOT NULL, invited_by VARCHAR(36) NOT NULL, invited_email VARCHAR(254) NULL, role VARCHAR(12) NOT NULL DEFAULT 'member', token_hash VARCHAR(64) NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'pending', expires_at DATETIME(3) NOT NULL, accepted_by VARCHAR(36) NULL, accepted_at DATETIME(3) NULL, revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE KEY uq_group_invitation_token (token_hash), KEY idx_invitation_group_status (group_id,status), KEY idx_invitation_expiry (expires_at),
  CONSTRAINT fk_invitation_group FOREIGN KEY (group_id) REFERENCES `groups`(id), CONSTRAINT fk_invitation_actor FOREIGN KEY (invited_by) REFERENCES users(id), CONSTRAINT fk_invitation_acceptor FOREIGN KEY (accepted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(36) PRIMARY KEY, group_id VARCHAR(36) NULL, name VARCHAR(60) NOT NULL, icon VARCHAR(40) NOT NULL DEFAULT 'circle', color VARCHAR(7) NOT NULL DEFAULT '#64748b',
  is_default BOOLEAN NOT NULL DEFAULT FALSE, created_by VARCHAR(36) NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_categories_group (group_id), UNIQUE KEY uq_categories_group_name (group_id,name), CONSTRAINT fk_categories_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  CONSTRAINT fk_categories_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(36) PRIMARY KEY, group_id VARCHAR(36) NOT NULL, title VARCHAR(160) NOT NULL, description TEXT NULL,
  amount_minor BIGINT NOT NULL, currency CHAR(3) NOT NULL, settlement_amount_minor BIGINT NOT NULL, settlement_currency CHAR(3) NOT NULL,
  fx_rate DECIMAL(24,12) NULL, fx_source VARCHAR(80) NULL, fx_as_of DATETIME(3) NULL, paid_by VARCHAR(36) NOT NULL, created_by VARCHAR(36) NOT NULL,
  split_type VARCHAR(12) NOT NULL, category_id VARCHAR(36) NULL, expense_date DATE NOT NULL, archived_at DATETIME(3) NULL, version INT NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_expenses_group_date (group_id,expense_date), KEY idx_expenses_paid_by (paid_by), KEY idx_expenses_category (category_id), KEY idx_expenses_created_by (created_by),
  CONSTRAINT fk_expenses_group FOREIGN KEY (group_id) REFERENCES `groups`(id), CONSTRAINT fk_expenses_payer FOREIGN KEY (paid_by) REFERENCES users(id),
  CONSTRAINT fk_expenses_creator FOREIGN KEY (created_by) REFERENCES users(id), CONSTRAINT fk_expenses_category FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS expense_shares (
  id VARCHAR(36) PRIMARY KEY, expense_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL, amount_minor BIGINT NOT NULL, original_amount_minor BIGINT NOT NULL, percentage_basis_points INT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE KEY uq_expense_share_expense_user (expense_id,user_id), KEY idx_expense_share_user (user_id), KEY idx_expense_share_expense (expense_id),
  CONSTRAINT fk_shares_expense FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE, CONSTRAINT fk_shares_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS settlements (
  id VARCHAR(36) PRIMARY KEY, group_id VARCHAR(36) NOT NULL, from_user_id VARCHAR(36) NOT NULL, to_user_id VARCHAR(36) NOT NULL,
  amount_minor BIGINT NOT NULL, currency CHAR(3) NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'declared', declared_at DATETIME(3) NOT NULL,
  confirmed_at DATETIME(3) NULL, disputed_at DATETIME(3) NULL, dispute_reason VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_settlements_group_status (group_id,status), KEY idx_settlements_from (from_user_id), KEY idx_settlements_to (to_user_id),
  CONSTRAINT fk_settlements_group FOREIGN KEY (group_id) REFERENCES `groups`(id), CONSTRAINT fk_settlements_from FOREIGN KEY (from_user_id) REFERENCES users(id), CONSTRAINT fk_settlements_to FOREIGN KEY (to_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS settlement_events (
  id VARCHAR(36) PRIMARY KEY, settlement_id VARCHAR(36) NOT NULL, actor_user_id VARCHAR(36) NOT NULL, event VARCHAR(24) NOT NULL, reason VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY idx_settlement_events_settlement (settlement_id),
  CONSTRAINT fk_settlement_events_settlement FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE CASCADE, CONSTRAINT fk_settlement_events_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, operation VARCHAR(120) NOT NULL, `key` VARCHAR(100) NOT NULL, payload_hash VARCHAR(64) NOT NULL,
  response_json JSON NULL, status_code INT NOT NULL DEFAULT 200, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_idempotency_user_operation_key (user_id,operation,`key`), KEY idx_idempotency_created (created_at), CONSTRAINT fk_idempotency_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS audit_events (
  id VARCHAR(36) PRIMARY KEY, request_id VARCHAR(64) NULL, actor_user_id VARCHAR(36) NULL, action VARCHAR(100) NOT NULL, resource_type VARCHAR(60) NOT NULL, resource_id VARCHAR(36) NULL,
  outcome VARCHAR(16) NOT NULL DEFAULT 'success', metadata JSON NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_audit_actor_time (actor_user_id,created_at), KEY idx_audit_resource (resource_type,resource_id), KEY idx_audit_request (request_id),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS receipts (
  id VARCHAR(36) PRIMARY KEY, expense_id VARCHAR(36) NOT NULL, uploaded_by VARCHAR(36) NOT NULL, original_name VARCHAR(255) NOT NULL, mime_type VARCHAR(80) NOT NULL,
  size_bytes INT NOT NULL, sha256 VARCHAR(64) NOT NULL, storage_key VARCHAR(100) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_receipts_expense (expense_id), KEY idx_receipts_uploader (uploaded_by), UNIQUE KEY uq_receipts_storage_key (storage_key),
  CONSTRAINT fk_receipts_expense FOREIGN KEY (expense_id) REFERENCES expenses(id), CONSTRAINT fk_receipts_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS fx_rate_cache (
  id VARCHAR(36) PRIMARY KEY, base_currency CHAR(3) NOT NULL, quote_currency CHAR(3) NOT NULL, rate DECIMAL(24,12) NOT NULL, source VARCHAR(80) NOT NULL,
  as_of DATETIME(3) NOT NULL, expires_at DATETIME(3) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_fx_pair (base_currency,quote_currency), KEY idx_fx_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
