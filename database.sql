-- =====================================================================
-- JCIP House Finance — Database Schema (MySQL/MariaDB)
-- =====================================================================
-- Banco de dados para hospedar na Hostinger (ou outro MySQL)
-- Versão: 1.0
--
-- Instruções de uso na Hostinger:
-- 1) Acesse hPanel -> MySQL Databases
-- 2) Crie um banco (ex.: u123456789_jcip) e um usuário com permissão
-- 3) Em phpMyAdmin -> Importar -> selecione este arquivo .sql
--    OU rode manualmente cada bloco.
-- 4) Copie as credenciais no arquivo backend/.env:
--      MYSQL_URL="mysql+pymysql://USUARIO:SENHA@HOST:3306/NOME_DO_BANCO?charset=utf8mb4"
-- =====================================================================

-- Se o banco ainda não existir, crie-o.
-- Obs.: Na Hostinger, o banco normalmente já é criado pelo hPanel com nome
-- como "u123456789_jcip". Neste caso, pule o CREATE DATABASE e apenas
-- selecione o banco antes de rodar o restante.

CREATE DATABASE IF NOT EXISTS `jcip_house_finance`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `jcip_house_finance`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================
-- TABELAS
-- =====================================================================

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
  `name` varchar(80) NOT NULL,
  `icon` varchar(40) NOT NULL,
  `color` varchar(20) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `house_id` (`house_id`),
  CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `contributions` (
  `id` varchar(36) NOT NULL,
  `house_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `amount` float NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `contribution_date` date NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `ix_contributions_house_id` (`house_id`),
  CONSTRAINT `contributions_ibfk_1` FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `contributions_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
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
  `payer_id` varchar(36) NOT NULL,
  `category_id` varchar(36) DEFAULT NULL,
  `description` varchar(255) NOT NULL,
  `amount` float NOT NULL,
  `expense_date` date NOT NULL,
  `expense_type` varchar(20) NOT NULL,
  `split_type` varchar(20) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `payer_id` (`payer_id`),
  KEY `category_id` (`category_id`),
  KEY `ix_expenses_house_id` (`house_id`),
  KEY `ix_expense_house_date` (`house_id`,`expense_date`),
  CONSTRAINT `expenses_ibfk_1` FOREIGN KEY (`house_id`) REFERENCES `houses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `expenses_ibfk_2` FOREIGN KEY (`payer_id`) REFERENCES `users` (`id`),
  CONSTRAINT `expenses_ibfk_3` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
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
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_houses_invite_code` (`invite_code`),
  KEY `owner_id` (`owner_id`),
  CONSTRAINT `houses_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
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
-- OBSERVAÇÕES IMPORTANTES
-- =====================================================================
-- - Todas as tabelas usam InnoDB para suportar foreign keys.
-- - Os IDs são UUIDs (VARCHAR(36)) gerados pela aplicação.
-- - Datas usam DATETIME (UTC) para compatibilidade global.
-- - O "invite_code" em `houses` é único e permite que outros moradores
--   entrem na casa digitando-o no app.
-- - Categorias padrão (Alimentação, Supermercado, Moradia, etc.) são
--   criadas automaticamente quando uma casa nova é gerada.
--
-- RELAÇÕES:
-- users 1-N house_members N-1 houses
-- houses 1-N expenses 1-N expense_participants
-- houses 1-N contributions N-1 users
-- houses 1-N payments (acertos de dívidas)
-- houses 1-N categories
-- =====================================================================
