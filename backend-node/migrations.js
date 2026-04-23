// Auto-create tables on startup
const { query } = require("./db");

const TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_users_email (email)
  ) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS houses (
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
  ) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS house_members (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    weight DOUBLE NOT NULL DEFAULT 1,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    joined_at DATETIME NOT NULL,
    UNIQUE KEY uq_house_user (house_id, user_id),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS categories (
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
  ) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS months (
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
  ) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS expenses (
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
  ) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS expense_participants (
    id VARCHAR(36) PRIMARY KEY,
    expense_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    share_amount DOUBLE NOT NULL,
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS expense_items (
    id VARCHAR(36) PRIMARY KEY,
    expense_id VARCHAR(36) NOT NULL,
    name VARCHAR(180) NOT NULL,
    quantity DOUBLE NOT NULL DEFAULT 1,
    unit_price DOUBLE NOT NULL,
    total DOUBLE NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
  ) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS contributions (
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
  ) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS payments (
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
  ) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS recurring_expenses (
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
  ) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS contribution_plans (
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
  ) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS activity_logs (
    id VARCHAR(36) PRIMARY KEY,
    house_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NULL,
    action VARCHAR(80) NOT NULL,
    details TEXT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_log_house (house_id),
    FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

async function runMigrations() {
  for (const sql of TABLES) {
    await query(sql);
  }
  console.log("[migrations] all 13 tables ready");
}

module.exports = { runMigrations };
