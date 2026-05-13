# JCIP House Finance — Arquitetura APK Offline-First

## Decisão principal

O APK não deve conectar direto no MySQL da Hostinger. Isso colocaria usuário, senha e host do banco dentro do aplicativo, e essas credenciais podem ser extraídas do APK.

A arquitetura segura fica assim:

1. **APK no celular/tablet**
   - Frontend React Native / Expo.
   - Regras de negócio do app.
   - Banco local SQLite para cache e fila offline.

2. **API Node.js na Hostinger**
   - Valida JWT e permissões.
   - Recebe sincronizações do app.
   - Conversa com o MySQL usando credenciais guardadas no servidor.

3. **MySQL/MariaDB na Hostinger**
   - Banco em nuvem.
   - Fonte compartilhada entre dispositivos e moradores.

## Como o offline funciona agora

- Todo `GET` bem-sucedido da API é salvo localmente em SQLite.
- Quando o app estiver sem internet, `GET` tenta devolver o último cache salvo.
- `POST`, `PUT`, `PATCH` e `DELETE` autenticados, quando feitos sem internet, entram em uma fila local chamada `sync_outbox`.
- Quando a internet volta, o app tenta reenviar a fila para a API na ordem em que as ações aconteceram.
- A conta/login inicial ainda precisa de internet. Depois de autenticado, o app consegue operar com dados já baixados e fila local.
- Por segurança de estado, criação/entrada de casa e configurações estruturais da casa ainda exigem internet nesta primeira camada.

## Configuração do APK

No frontend, configure:

```env
EXPO_PUBLIC_BACKEND_URL=https://api.seudominio.com
```

Esse domínio deve apontar para o backend Node.js publicado na Hostinger, não diretamente para o MySQL.

## Próxima etapa recomendada

A base genérica de offline já está pronta. A próxima evolução é transformar cada entidade em local-first:

- `houses`
- `members`
- `categories`
- `months`
- `expenses`
- `expense_items`
- `expense_participants`
- `contributions`
- `payments`
- `recurring_expenses`
- `contribution_plans`

Com isso, um gasto criado offline aparece imediatamente no dashboard local antes mesmo da sincronização.
