# JCIP House Finance — PRD (v3.0)

## Stack
- **Backend**: Node.js 20 + Express + mysql2 + bcryptjs + jsonwebtoken
- **Frontend**: React Native / Expo SDK 54 (Expo Router)
- **Banco**: MySQL 8 / MariaDB 10.11 (Hostinger compatível)
- **Auth**: JWT (email + senha, bcrypt)

## Arquivos principais
- `/app/backend-node/` — único app Node.js para deploy Hostinger
- `/app/frontend/` — app Expo (gera APK via EAS Build)
- `/app/database.sql` — 13 tabelas prontas pra importar no phpMyAdmin
- `/app/APK_BUILD_INSTRUCTIONS.md` — guia completo passo-a-passo

## Funcionalidades
- Auth JWT (register, login, /me)
- Casas compartilhadas com código de convite
- Pesos por membro (divisão por peso)
- Dashboard com:
  - Seletor de meses (ciclos com start_day configurável 1-28)
  - Saldo do mês + saldo carregado
  - Gastos fixos vs variáveis
  - Gastos por categoria com barras
  - Resumo por morador
  - Otimização de dívidas ("quem deve para quem")
  - Gastos recentes
- Gastos com:
  - 4 modos de divisão (igual / peso / custom / individual)
  - Modo Mercado (lista de itens qtd × preço unitário)
  - Marcador "pago / pendente"
  - Coletivo ou individual
- Contribuições (aportes ao caixa da casa)
- Despesas recorrentes (aluguel, luz…) com geração automática mensal idempotente
- Planos de contribuição mensais (auto-gerados)
- Fechamento de mês com opção de carregar saldo
- Acertos de conta (payments) que afetam dashboard

## Bugs corrigidos na v3
- House type com month_start_day (TypeScript strict)
- Double-fetch no dashboard eliminado
- android.package + ios.bundleIdentifier para EAS Build
- Backend migrado para Node.js (limite de apps Hostinger)

## Pendente (futuras iterações)
- Gamificação (rankings, badges, níveis)
- IA (insights automáticos, sugestão de divisão)
- OCR de nota fiscal
- Modo offline com sync
- Gráficos avançados (trends, previsões)
- Push notifications para alertas
- Cron job de geração automática de recorrentes
