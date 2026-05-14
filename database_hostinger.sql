-- =====================================================================
-- JCIP House Finance - SQL COMPLETO PARA HOSTINGER / phpMyAdmin
-- Banco zerado: u251982692_jciphouse
-- Multi-tenant por casa/organizacao (tabela houses)
-- Compatibilidade: MySQL/MariaDB Hostinger
-- Observacoes:
-- 1. Selecione o banco no phpMyAdmin antes de importar.
-- 2. Nao coloque senha do banco dentro do APK. Use a API Node.js.
-- 3. Este arquivo remove tabelas antigas do mesmo projeto e recria tudo.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `activity_logs`;
DROP TABLE IF EXISTS `idempotency_keys`;
DROP TABLE IF EXISTS `sync_cursors`;
DROP TABLE IF EXISTS `sync_events`;
DROP TABLE IF EXISTS `reminders`;
DROP TABLE IF EXISTS `ai_insights`;
DROP TABLE IF EXISTS `document_extractions`;
DROP TABLE IF EXISTS `documents`;
DROP TABLE IF EXISTS `house_chore_assignments`;
DROP TABLE IF EXISTS `house_chores`;
DROP TABLE IF EXISTS `shopping_list_items`;
DROP TABLE IF EXISTS `cash_transactions`;
DROP TABLE IF EXISTS `bill_payments`;
DROP TABLE IF EXISTS `bills`;
DROP TABLE IF EXISTS `budget_categories`;
DROP TABLE IF EXISTS `budgets`;
DROP TABLE IF EXISTS `financial_accounts`;
DROP TABLE IF EXISTS `user_devices`;
DROP TABLE IF EXISTS `contribution_plans`;
DROP TABLE IF EXISTS `recurring_expenses`;
DROP TABLE IF EXISTS `payments`;
DROP TABLE IF EXISTS `contributions`;
DROP TABLE IF EXISTS `expense_items`;
DROP TABLE IF EXISTS `expense_participants`;
DROP TABLE IF EXISTS `expenses`;
DROP TABLE IF EXISTS `months`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `password_reset_tokens`;
DROP TABLE IF EXISTS `user_consents`;
DROP TABLE IF EXISTS `house_members`;
DROP TABLE IF EXISTS `houses`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE IF NOT EXISTS `users` (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_users_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `houses` (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    invite_code VARCHAR(12) UNIQUE NOT NULL,
    currency VARCHAR(6) NOT NULL DEFAULT 'BRL',
    owner_id VARCHAR(36) NOT NULL,
    gamification_enabled TINYINT(1) NOT NULL DEFAULT 1,
    month_start_day INT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    INDEX idx_houses_invite (invite_code),
    FOREIGN KEY (owner_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `house_members` (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    weight DOUBLE NOT NULL DEFAULT 1,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    permissions_json LONGTEXT NULL,
    joined_at DATETIME NOT NULL,
    UNIQUE KEY uq_house_user (house_id, user_id),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    email VARCHAR(255) NOT NULL,
    code_hash VARCHAR(128) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_reset_user_email (user_id, email),
    INDEX idx_reset_expires (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_consents` (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    consent_type VARCHAR(60) NOT NULL,
    version VARCHAR(20) NOT NULL,
    accepted_at DATETIME NOT NULL,
    ip_address VARCHAR(80) NULL,
    user_agent VARCHAR(500) NULL,
    UNIQUE KEY uq_user_consent_version (user_id, consent_type, version),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `categories` (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    parent_id VARCHAR(36) NULL,
    name VARCHAR(80) NOT NULL,
    icon VARCHAR(40) NOT NULL DEFAULT 'tag',
    color VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
    is_market_style TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `months` (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    year INT NOT NULL,
    month_number INT NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'open',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    carried_balance DOUBLE NOT NULL DEFAULT 0,
    closed_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uq_house_month (house_id, year, month_number),
    INDEX idx_months_house (house_id),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `expenses` (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    month_id VARCHAR(36) NULL,
    payer_id VARCHAR(36) NOT NULL,
    category_id VARCHAR(36) NULL,
    description VARCHAR(255) NOT NULL,
    amount DOUBLE NOT NULL,
    expense_date DATE NOT NULL,
    expense_type VARCHAR(20) NOT NULL DEFAULT 'collective',
    split_type VARCHAR(20) NOT NULL DEFAULT 'equal',
    has_items TINYINT(1) NOT NULL DEFAULT 0,
    is_paid TINYINT(1) NOT NULL DEFAULT 1,
    is_recurring_instance TINYINT(1) NOT NULL DEFAULT 0,
    recurring_source_id VARCHAR(36) NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_expense_house_date (house_id, expense_date),
    INDEX idx_expense_month (month_id),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE SET NULL,
    FOREIGN KEY (payer_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `expense_participants` (
    id VARCHAR(36) PRIMARY KEY,
    expense_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    share_amount DOUBLE NOT NULL,
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `expense_items` (
    id VARCHAR(36) PRIMARY KEY,
    expense_id VARCHAR(36) NOT NULL,
    name VARCHAR(180) NOT NULL,
    quantity DOUBLE NOT NULL DEFAULT 1,
    unit_price DOUBLE NOT NULL,
    total DOUBLE NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contributions` (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    month_id VARCHAR(36) NULL,
    user_id VARCHAR(36) NOT NULL,
    amount DOUBLE NOT NULL,
    description VARCHAR(255) NULL,
    contribution_date DATE NOT NULL,
    is_auto TINYINT(1) NOT NULL DEFAULT 0,
    plan_id VARCHAR(36) NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_contrib_house (house_id),
    INDEX idx_contrib_month (month_id),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payments` (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    from_user_id VARCHAR(36) NOT NULL,
    to_user_id VARCHAR(36) NOT NULL,
    amount DOUBLE NOT NULL,
    note VARCHAR(255) NULL,
    payment_date DATE NOT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_pay_house (house_id),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recurring_expenses` (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    name VARCHAR(180) NOT NULL,
    amount DOUBLE NOT NULL,
    category_id VARCHAR(36) NULL,
    payer_id VARCHAR(36) NOT NULL,
    frequency VARCHAR(10) NOT NULL DEFAULT 'monthly',
    day_of_month INT NOT NULL DEFAULT 1,
    expense_type VARCHAR(20) NOT NULL DEFAULT 'collective',
    split_type VARCHAR(20) NOT NULL DEFAULT 'equal',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_generated_month VARCHAR(7) NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_rec_house (house_id),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (payer_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contribution_plans` (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    amount DOUBLE NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_generated_month VARCHAR(7) NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uq_plan_house_user (house_id, user_id),
    INDEX idx_plan_house (house_id),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_devices` (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    device_name VARCHAR(160) NULL,
    platform VARCHAR(40) NULL,
    app_version VARCHAR(40) NULL,
    push_token VARCHAR(500) NULL,
    last_seen_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_device_user (user_id),
    INDEX idx_device_push_token (push_token(191)),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `financial_accounts` (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    owner_user_id VARCHAR(36) NULL,
    name VARCHAR(120) NOT NULL,
    account_type VARCHAR(30) NOT NULL DEFAULT 'cash',
    institution_name VARCHAR(120) NULL,
    currency VARCHAR(6) NOT NULL DEFAULT 'BRL',
    opening_balance DOUBLE NOT NULL DEFAULT 0,
    current_balance DOUBLE NOT NULL DEFAULT 0,
    credit_limit DOUBLE NULL,
    closing_day INT NULL,
    due_day INT NULL,
    is_shared TINYINT(1) NOT NULL DEFAULT 1,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NULL,
    INDEX idx_accounts_house (house_id),
    INDEX idx_accounts_owner (owner_user_id),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `budgets` (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NULL,
    name VARCHAR(120) NOT NULL,
    period VARCHAR(20) NOT NULL DEFAULT 'monthly',
    amount DOUBLE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NULL,
    INDEX idx_budgets_house (house_id),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `budget_categories` (
    id VARCHAR(36) PRIMARY KEY,
    budget_id VARCHAR(36) NOT NULL,
    category_id VARCHAR(36) NOT NULL,
    amount DOUBLE NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uq_budget_category (budget_id, category_id),
    FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bills` (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NULL,
    account_id VARCHAR(36) NULL,
    category_id VARCHAR(36) NULL,
    bill_type VARCHAR(20) NOT NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT NULL,
    amount DOUBLE NOT NULL,
    paid_amount DOUBLE NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    paid_at DATETIME NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    party_name VARCHAR(180) NULL,
    recurrence_rule VARCHAR(120) NULL,
    source_type VARCHAR(40) NULL,
    source_id VARCHAR(36) NULL,
    created_by_user_id VARCHAR(36) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NULL,
    INDEX idx_bills_house_due (house_id, due_date),
    INDEX idx_bills_house_status (house_id, status),
    INDEX idx_bills_type (bill_type),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (account_id) REFERENCES financial_accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bill_payments` (
    id VARCHAR(36) PRIMARY KEY,
    bill_id VARCHAR(36) NOT NULL,
    account_id VARCHAR(36) NULL,
    amount DOUBLE NOT NULL,
    paid_at DATETIME NOT NULL,
    note VARCHAR(255) NULL,
    created_by_user_id VARCHAR(36) NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_bill_payments_bill (bill_id),
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES financial_accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cash_transactions` (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    account_id VARCHAR(36) NULL,
    user_id VARCHAR(36) NULL,
    direction VARCHAR(10) NOT NULL,
    amount DOUBLE NOT NULL,
    transaction_date DATE NOT NULL,
    description VARCHAR(255) NOT NULL,
    source_type VARCHAR(40) NULL,
    source_id VARCHAR(36) NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_cash_house_date (house_id, transaction_date),
    INDEX idx_cash_account (account_id),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES financial_accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shopping_list_items` (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    created_by_user_id VARCHAR(36) NULL,
    name VARCHAR(180) NOT NULL,
    quantity DOUBLE NOT NULL DEFAULT 1,
    unit VARCHAR(30) NULL,
    notes VARCHAR(255) NULL,
    is_checked TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NULL,
    INDEX idx_shopping_house_checked (house_id, is_checked),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `house_chores` (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT NULL,
    due_at DATETIME NULL,
    recurrence VARCHAR(30) NOT NULL DEFAULT 'none',
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_by_user_id VARCHAR(36) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NULL,
    INDEX idx_chores_house_due (house_id, due_at),
    INDEX idx_chores_status (status),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `house_chore_assignments` (
    id VARCHAR(36) PRIMARY KEY,
    chore_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    completed_at DATETIME NULL,
    completed_by_user_id VARCHAR(36) NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uq_chore_user (chore_id, user_id),
    INDEX idx_chore_assignment_user (user_id, status),
    FOREIGN KEY (chore_id) REFERENCES house_chores(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (completed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `documents` (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NULL,
    document_type VARCHAR(40) NOT NULL DEFAULT 'receipt',
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NULL,
    storage_path VARCHAR(500) NULL,
    file_hash VARCHAR(128) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'uploaded',
    captured_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_documents_house (house_id),
    INDEX idx_documents_hash (file_hash),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `document_extractions` (
    id VARCHAR(36) PRIMARY KEY,
    document_id VARCHAR(36) NOT NULL,
    provider VARCHAR(60) NULL,
    model VARCHAR(80) NULL,
    raw_text MEDIUMTEXT NULL,
    structured_json LONGTEXT NULL,
    confidence DOUBLE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_extractions_document (document_id),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ai_insights` (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NULL,
    insight_type VARCHAR(60) NOT NULL,
    title VARCHAR(180) NOT NULL,
    message TEXT NOT NULL,
    payload_json LONGTEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new',
    created_at DATETIME NOT NULL,
    read_at DATETIME NULL,
    INDEX idx_ai_house_status (house_id, status),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reminders` (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NULL,
    bill_id VARCHAR(36) NULL,
    title VARCHAR(180) NOT NULL,
    remind_at DATETIME NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    sent_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_reminders_due (status, remind_at),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sync_events` (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NULL,
    user_id VARCHAR(36) NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id VARCHAR(36) NOT NULL,
    action VARCHAR(20) NOT NULL,
    payload_json LONGTEXT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_sync_events_house_created (house_id, created_at),
    INDEX idx_sync_events_user_created (user_id, created_at),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sync_cursors` (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    device_id VARCHAR(36) NULL,
    house_id VARCHAR(36) NULL,
    last_event_at DATETIME NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_sync_cursor_scope (user_id, device_id, house_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES user_devices(id) ON DELETE CASCADE,
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `idempotency_keys` (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    request_hash VARCHAR(128) NULL,
    response_json LONGTEXT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uq_user_idempotency_key (user_id, idempotency_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `activity_logs` (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NULL,
    action VARCHAR(80) NOT NULL,
    details TEXT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_log_house (house_id),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Total de tabelas: 27
-- Tabelas: users, houses, house_members, password_reset_tokens, user_consents, categories, months, expenses, expense_participants, expense_items, contributions, payments, recurring_expenses, contribution_plans, user_devices, financial_accounts, budgets, budget_categories, bills, bill_payments, cash_transactions, shopping_list_items, house_chores, house_chore_assignments, documents, document_extractions, ai_insights, reminders, sync_events, sync_cursors, idempotency_keys, activity_logs
