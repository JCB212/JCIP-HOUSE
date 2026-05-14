# JCIP House Finance — PRD (v1.2)

## Stack
- **Backend**: Node.js 20 + Express + mysql2 + bcryptjs + jsonwebtoken
- **Frontend**: React Native / Expo SDK 54 (Expo Router)
- **Banco**: MySQL 8 / MariaDB 10.11 (Hostinger compatível)
- **Auth**: JWT (email + senha, bcrypt)
- **Offline local**: SQLite no APK para cache e fila de sincronização

## Arquivos principais
- `backend-node/` — único app Node.js para deploy Hostinger
- `frontend/` — app mobile React Native/Expo que gera o APK
- `database.sql` — schema completo pronto para importar no phpMyAdmin
- `APK_BUILD_INSTRUCTIONS.md` — guia completo passo-a-passo
- `OFFLINE_SYNC_ARCHITECTURE.md` — arquitetura offline-first para APK independente

## Funcionalidades
- Auth JWT (register, login, /me)
- Recuperação de senha por código enviado via SMTP
- Casas compartilhadas com código de convite
- Permissões por morador controladas pelo dono da casa
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
- Extrato consolidado da casa
- Lista de compras compartilhada
- Contas a pagar e a receber
- Afazeres da casa com responsáveis, prazo e registro de conclusão
- Modo claro/escuro com contraste revisado
- Termo LGPD para programa teste
- Lembretes locais para contas e afazeres
- APK independente, configurável via `EXPO_PUBLIC_BACKEND_URL`
- Cache local de respostas e fila local de mutações para sincronizar quando a internet voltar

## Correções da v1.2
- House type com month_start_day (TypeScript strict)
- Double-fetch no dashboard eliminado
- android.package + ios.bundleIdentifier para EAS Build
- Backend migrado para Node.js (limite de apps Hostinger)
- Ícone do app substituído pelo ícone da casa JCIP-HOUSE
- Banner offline trocado por aviso discreto de falta de sincronização
- Recuperação de senha por e-mail
- Permissões por tela/ação para dono e sub-dono

## Pendente (futuras iterações)
- Gamificação (rankings, badges, níveis)
- IA (insights automáticos, sugestão de divisão)
- OCR de nota fiscal
- Local-first completo por entidade (dashboard refletir lançamentos offline imediatamente)
- Gráficos avançados (trends, previsões)
- Cron job de geração automática de recorrentes
