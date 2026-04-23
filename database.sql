-- =====================================================================
-- JCIP House Finance — Database Schema (MySQL/MariaDB)
-- Versão 3.0 — Backend em Node.js (Express)
-- =====================================================================
-- Como usar na Hostinger:
-- 1) hPanel -> MySQL Databases -> Criar novo banco + usuário + senha
--    (guarde as credenciais — exemplo: u123456789_jcip / senha forte)
-- 2) Em phpMyAdmin do banco criado -> Importar -> selecione este arquivo .sql
-- 3) No seu backend Node.js (/backend-node/.env) defina:
--      DB_HOST=mysql.hostinger.com      (ou o host fornecido)
--      DB_PORT=3306
--      DB_USER=u123456789_jcip
--      DB_PASSWORD=sua_senha
--      DB_NAME=u123456789_jcip
--      JWT_SECRET=uma-string-longa-aleatoria
--      PORT=8001
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
  KEY `idx_log_house` (`house_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `activity_logs_ibfk_1` FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `activity_logs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `categories` (
  `id` varchar(36) NOT NULL,
  `house_id` varchar(36) NOT NULL,
  `parent_id` varchar(36) DEFAULT NULL,
  `name` varchar(80) NOT NULL,
  `icon` varchar(40) NOT NULL DEFAULT 'tag',
  `color` varchar(20) NOT NULL DEFAULT '#3b82f6',
  `is_market_style` tinyint(1) NOT NULL DEFAULT 0,
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
  `amount` double NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_generated_month` varchar(7) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_plan_house_user` (`house_id`,`user_id`),
  KEY `idx_plan_house` (`house_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `contribution_plans_ibfk_1` FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `contribution_plans_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `contributions` (
  `id` varchar(36) NOT NULL,
  `house_id` varchar(36) NOT NULL,
  `month_id` varchar(36) DEFAULT NULL,
  `user_id` varchar(36) NOT NULL,
  `amount` double NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `contribution_date` date NOT NULL,
  `is_auto` tinyint(1) NOT NULL DEFAULT 0,
  `plan_id` varchar(36) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_contrib_house` (`house_id`),
  KEY `idx_contrib_month` (`month_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `contributions_ibfk_1` FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `contributions_ibfk_2` FOREIGN KEY (`month_id`) REFERENCES `months` (`id`) ON DELETE SET NULL,
  CONSTRAINT `contributions_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `expense_items` (
  `id` varchar(36) NOT NULL,
  `expense_id` varchar(36) NOT NULL,
  `name` varchar(180) NOT NULL,
  `quantity` double NOT NULL DEFAULT 1,
  `unit_price` double NOT NULL,
  `total` double NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `expense_id` (`expense_id`),
  CONSTRAINT `expense_items_ibfk_1` FOREIGN KEY (`expense_id`) REFERENCES `expenses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `expense_participants` (
  `id` varchar(36) NOT NULL,
  `expense_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `share_amount` double NOT NULL,
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
  `amount` double NOT NULL,
  `expense_date` date NOT NULL,
  `expense_type` varchar(20) NOT NULL DEFAULT 'collective',
  `split_type` varchar(20) NOT NULL DEFAULT 'equal',
  `has_items` tinyint(1) NOT NULL DEFAULT 0,
  `is_paid` tinyint(1) NOT NULL DEFAULT 1,
  `is_recurring_instance` tinyint(1) NOT NULL DEFAULT 0,
  `recurring_source_id` varchar(36) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_expense_house_date` (`house_id`,`expense_date`),
  KEY `idx_expense_month` (`month_id`),
  KEY `payer_id` (`payer_id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `expenses_ibfk_1` FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `expenses_ibfk_2` FOREIGN KEY (`month_id`) REFERENCES `months` (`id`) ON DELETE SET NULL,
  CONSTRAINT `expenses_ibfk_3` FOREIGN KEY (`payer_id`) REFERENCES `users` (`id`),
  CONSTRAINT `expenses_ibfk_4` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `house_members` (
  `id` varchar(36) NOT NULL,
  `house_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `weight` double NOT NULL DEFAULT 1,
  `role` varchar(20) NOT NULL DEFAULT 'member',
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
  `currency` varchar(6) NOT NULL DEFAULT 'BRL',
  `owner_id` varchar(36) NOT NULL,
  `gamification_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `month_start_day` int(11) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invite_code` (`invite_code`),
  KEY `idx_houses_invite` (`invite_code`),
  KEY `owner_id` (`owner_id`),
  CONSTRAINT `houses_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `months` (
  `id` varchar(36) NOT NULL,
  `house_id` varchar(36) NOT NULL,
  `year` int(11) NOT NULL,
  `month_number` int(11) NOT NULL,
  `status` varchar(10) NOT NULL DEFAULT 'open',
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `carried_balance` double NOT NULL DEFAULT 0,
  `closed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_house_month` (`house_id`,`year`,`month_number`),
  KEY `idx_months_house` (`house_id`),
  CONSTRAINT `months_ibfk_1` FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `payments` (
  `id` varchar(36) NOT NULL,
  `house_id` varchar(36) NOT NULL,
  `from_user_id` varchar(36) NOT NULL,
  `to_user_id` varchar(36) NOT NULL,
  `amount` double NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `payment_date` date NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pay_house` (`house_id`),
  KEY `from_user_id` (`from_user_id`),
  KEY `to_user_id` (`to_user_id`),
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payments_ibfk_2` FOREIGN KEY (`from_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `payments_ibfk_3` FOREIGN KEY (`to_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `recurring_expenses` (
  `id` varchar(36) NOT NULL,
  `house_id` varchar(36) NOT NULL,
  `name` varchar(180) NOT NULL,
  `amount` double NOT NULL,
  `category_id` varchar(36) DEFAULT NULL,
  `payer_id` varchar(36) NOT NULL,
  `frequency` varchar(10) NOT NULL DEFAULT 'monthly',
  `day_of_month` int(11) NOT NULL DEFAULT 1,
  `expense_type` varchar(20) NOT NULL DEFAULT 'collective',
  `split_type` varchar(20) NOT NULL DEFAULT 'equal',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_generated_month` varchar(7) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_rec_house` (`house_id`),
  KEY `category_id` (`category_id`),
  KEY `payer_id` (`payer_id`),
  CONSTRAINT `recurring_expenses_ibfk_1` FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `recurring_expenses_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
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
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- 13 TABELAS — Visão geral
-- users                 Moradores cadastrados (JWT auth)
-- houses                Casas / grupos (month_start_day configurável)
-- house_members         Vínculo user<->house com peso/role
-- categories            Categorias e subcategorias (parent_id, is_market_style)
-- months                Ciclos mensais (open/closed, carried_balance)
-- expenses              Despesas (ligadas ao mês atual)
-- expense_items         Itens de mercado (qtd + preço unitário)
-- expense_participants  Rateio de cada despesa
-- contributions         Aportes dos moradores para o caixa da casa
-- recurring_expenses    Despesas fixas (aluguel, luz…) auto-geradas
-- contribution_plans    Contribuições mensais automáticas por morador
-- payments              Acertos de dívida entre moradores
-- activity_logs         Auditoria das ações
-- =====================================================================
