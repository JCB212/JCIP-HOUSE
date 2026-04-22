# JCIP House Finance — PRD (Product Requirements)

## Visão
App mobile colaborativo de controle financeiro residencial. Permite que moradores
registrem gastos, contribuições e o sistema calcula automaticamente as divisões
e quem deve para quem.

## Stack
- **Frontend**: React Native / Expo (SDK 54), Expo Router
- **Backend**: FastAPI + SQLAlchemy + PyMySQL
- **Banco**: MySQL / MariaDB (para hospedagem Hostinger)
- **Auth**: JWT (email + senha, bcrypt)

## Funcionalidades (MVP implementado)
- Cadastro / Login com JWT
- Criar Casa ou Entrar com código de convite
- Dashboard (saldo da casa, gasto do mês, resumo por morador, quem deve para quem)
- Registrar gastos com:
  - Tipo coletivo ou individual
  - Divisão: igual, por peso, personalizada, individual
  - Categoria e observações
- Registrar contribuições (fundo da casa)
- Lista de gastos com filtro
- Acertos de conta (cálculo otimizado de transferências)
- Gerenciar moradores e pesos
- Múltiplas casas por usuário
- SQL schema pronto para Hostinger (`/app/database.sql`)
- Documentação de build APK (`/app/APK_BUILD_INSTRUCTIONS.md`)

## Banco de dados
Tabelas: users, houses, house_members, categories, expenses,
expense_participants, contributions, payments, activity_logs.

## Pendente (iterações futuras)
- Gamificação (ranking, badges, níveis)
- IA (insights, previsão, sugestões)
- OCR de nota fiscal
- Modo offline com sync
- Gráficos avançados
- Fechamento mensal
