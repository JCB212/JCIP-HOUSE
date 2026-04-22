-- =====================================================================
-- JCIP House Finance — Database Schema (MySQL/MariaDB)
-- =====================================================================
-- Versão: 2.0 (Meses, Mercado, Recorrentes, Planos de Contribuição)
-- Banco para hospedar na Hostinger (phpMyAdmin -> Importar)
--
-- INSTRUÇÕES:
-- 1) hPanel Hostinger -> MySQL Databases -> crie banco + usuário
-- 2) phpMyAdmin -> Importar -> selecione este arquivo .sql
-- 3) No seu backend, defina em .env:
--    MYSQL_URL="mysql+pymysql://USUARIO:SENHA@HOST:3306/NOMEDB?charset=utf8mb4"
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `jcip_house_finance`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `jcip_house_finance`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE `activity_logs` (
  `id` varchar(36) NOT NULL,
  `house_id` varchar(36) NOT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `action` varchar(80) NOT NULL,
  `details` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `ix_activity_logs_house_id` (`house_id`),
  CONSTRAINT `activity_logs_ibfk_1` FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `activity_logs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `categories` (
  `id` varchar(36) NOT NULL,
  `house_id` varchar(36) NOT NULL,
  `parent_id` varchar(36) DEFAULT NULL,
  `name` varchar(80) NOT NULL,
  `icon` varchar(40) NOT NULL,
  `color` varchar(20) NOT NULL,
  `is_market_style` tinyint(1) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `house_id` (`house_id`),
  KEY `parent_id` (`parent_id`),
  CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `categories_ibfk_2` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `contribution_plans` (
  `id` varchar(36) NOT NULL,
  `house_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `amount` float NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `last_generated_month` varchar(7) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_plan_house_user` (`house_id`,`user_id`),
  KEY `user_id` (`user_id`),
  KEY `ix_contribution_plans_house_id` (`house_id`),
  CONSTRAINT `contribution_plans_ibfk_1` FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `contribution_plans_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `contributions` (
  `id` varchar(36) NOT NULL,
  `house_id` varchar(36) NOT NULL,
  `month_id` varchar(36) DEFAULT NULL,
  `user_id` varchar(36) NOT NULL,
  `amount` float NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `contribution_date` date NOT NULL,
  `is_auto` tinyint(1) NOT NULL,
  `plan_id` varchar(36) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `ix_contributions_month_id` (`month_id`),
  KEY `ix_contributions_house_id` (`house_id`),
  CONSTRAINT `contributions_ibfk_1` FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `contributions_ibfk_2` FOREIGN KEY (`month_id`) REFERENCES `months` (`id`) ON DELETE SET NULL,
  CONSTRAINT `contributions_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `expense_items` (
  `id` varchar(36) NOT NULL,
  `expense_id` varchar(36) NOT NULL,
  `name` varchar(180) NOT NULL,
  `quantity` float NOT NULL,
  `unit_price` float NOT NULL,
  `total` float NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `expense_id` (`expense_id`),
  CONSTRAINT `expense_items_ibfk_1` FOREIGN KEY (`expense_id`) REFERENCES `expenses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `expense_participants` (
  `id` varchar(36) NOT NULL,
  `expense_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `share_amount` float NOT NULL,
  PRIMARY KEY (`id`),
  KEY `expense_id` (`expense_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `expense_participants_ibfk_1` FOREIGN KEY (`expense_id`) REFERENCES `expenses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `expense_participants_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `expenses` (
  `id` varchar(36) NOT NULL,
  `house_id` varchar(36) NOT NULL,
  `month_id` varchar(36) DEFAULT NULL,
  `payer_id` varchar(36) NOT NULL,
  `category_id` varchar(36) DEFAULT NULL,
  `description` varchar(255) NOT NULL,
  `amount` float NOT NULL,
  `expense_date` date NOT NULL,
  `expense_type` varchar(20) NOT NULL,
  `split_type` varchar(20) NOT NULL,
  `has_items` tinyint(1) NOT NULL,
  `is_paid` tinyint(1) NOT NULL,
  `is_recurring_instance` tinyint(1) NOT NULL,
  `recurring_source_id` varchar(36) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `payer_id` (`payer_id`),
  KEY `category_id` (`category_id`),
  KEY `ix_expenses_house_id` (`house_id`),
  KEY `ix_expense_house_date` (`house_id`,`expense_date`),
  KEY `ix_expenses_month_id` (`month_id`),
  CONSTRAINT `expenses_ibfk_1` FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `expenses_ibfk_2` FOREIGN KEY (`month_id`) REFERENCES `months` (`id`) ON DELETE SET NULL,
  CONSTRAINT `expenses_ibfk_3` FOREIGN KEY (`payer_id`) REFERENCES `users` (`id`),
  CONSTRAINT `expenses_ibfk_4` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `house_members` (
  `id` varchar(36) NOT NULL,
  `house_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `weight` float NOT NULL,
  `role` varchar(20) NOT NULL,
  `joined_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_house_user` (`house_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `house_members_ibfk_1` FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `house_members_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `houses` (
  `id` varchar(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `invite_code` varchar(12) NOT NULL,
  `currency` varchar(6) NOT NULL,
  `owner_id` varchar(36) NOT NULL,
  `gamification_enabled` tinyint(1) NOT NULL,
  `month_start_day` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_houses_invite_code` (`invite_code`),
  KEY `owner_id` (`owner_id`),
  CONSTRAINT `houses_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `months` (
  `id` varchar(36) NOT NULL,
  `house_id` varchar(36) NOT NULL,
  `year` int(11) NOT NULL,
  `month_number` int(11) NOT NULL,
  `status` varchar(10) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `carried_balance` float NOT NULL,
  `closed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_house_month` (`house_id`,`year`,`month_number`),
  KEY `ix_months_house_id` (`house_id`),
  CONSTRAINT `months_ibfk_1` FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `payments` (
  `id` varchar(36) NOT NULL,
  `house_id` varchar(36) NOT NULL,
  `from_user_id` varchar(36) NOT NULL,
  `to_user_id` varchar(36) NOT NULL,
  `amount` float NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `payment_date` date NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `from_user_id` (`from_user_id`),
  KEY `to_user_id` (`to_user_id`),
  KEY `ix_payments_house_id` (`house_id`),
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payments_ibfk_2` FOREIGN KEY (`from_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `payments_ibfk_3` FOREIGN KEY (`to_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `recurring_expenses` (
  `id` varchar(36) NOT NULL,
  `house_id` varchar(36) NOT NULL,
  `name` varchar(180) NOT NULL,
  `amount` float NOT NULL,
  `category_id` varchar(36) DEFAULT NULL,
  `payer_id` varchar(36) NOT NULL,
  `frequency` varchar(10) NOT NULL,
  `day_of_month` int(11) NOT NULL,
  `expense_type` varchar(20) NOT NULL,
  `split_type` varchar(20) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `last_generated_month` varchar(7) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `category_id` (`category_id`),
  KEY `payer_id` (`payer_id`),
  KEY `ix_recurring_expenses_house_id` (`house_id`),
  CONSTRAINT `recurring_expenses_ibfk_1` FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `recurring_expenses_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`),
  CONSTRAINT `recurring_expenses_ibfk_3` FOREIGN KEY (`payer_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `users` (
  `id` varchar(36) NOT NULL,
  `email` varchar(255) NOT NULL,
  `name` varchar(120) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `avatar_url` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- RELAÇÕES:
-- users 1-N house_members N-1 houses
-- houses 1-N months (ciclos mensais, status open/closed)
-- houses 1-N expenses (cada expense -> month_id)
-- houses 1-N contributions (N-1 users, N-1 months, is_auto flag)
-- houses 1-N recurring_expenses (despesas fixas, geradas no mês)
-- houses 1-N contribution_plans (contribuições mensais automáticas)
-- houses 1-N categories (suporta parent_id para subcategorias)
-- expenses 1-N expense_items (modo Mercado: lista de itens)
-- expenses 1-N expense_participants (quotas de cada morador)
-- =====================================================================
