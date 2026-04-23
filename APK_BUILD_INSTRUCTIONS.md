# 🏡 JCIP House Finance — Guia Completo de Deploy (Hostinger)

## 📦 O que você tem pronto

### 1. Backend (Node.js + Express + MySQL)
- **Pasta**: `/app/backend-node/`
- Stack: Express 4, mysql2, bcryptjs, jsonwebtoken
- **Única aplicação Node.js** — atende ao limite de apps da Hostinger
- Endpoint base: `/api/*` (todos os endpoints)

### 2. Frontend (React Native / Expo)
- **Pasta**: `/app/frontend/`
- Expo SDK 54, Expo Router
- Gera **APK nativo** Android via EAS Build (grátis)

### 3. Banco de dados SQL
- **Arquivo**: `/app/database.sql` — 13 tabelas prontas para importar

---

## 🚀 Passo-a-passo na Hostinger

### PASSO 1 — Criar banco MySQL na Hostinger

1. Entre no **hPanel** → **Bancos de dados MySQL**
2. Clique em **Criar novo banco**
3. Escolha um nome (ex.: `u123456789_jcip`) + usuário + senha forte
4. **Guarde** essas 4 informações:
   - Host (ex.: `mysql.hostinger.com` ou IP)
   - Nome do banco
   - Usuário
   - Senha
5. Habilite **"Acesso remoto MySQL"** e adicione o IP do servidor onde seu backend rodará (`%` libera tudo — ou o IP específico do Node App)

### PASSO 2 — Importar o schema

1. Abra o **phpMyAdmin** (hPanel → Bancos de Dados → phpMyAdmin)
2. Selecione o banco criado
3. Aba **Importar** → selecione `database.sql` → **Executar**
4. Você verá as 13 tabelas criadas

### PASSO 3 — Deploy do Backend Node.js (Hostinger)

A Hostinger oferece **"Aplicativos Node.js"** (em planos Business+). Se o seu plano não tiver, use um VPS Hostinger (mais completo).

#### Opção A — Hostinger Business/Cloud (Node.js App)

1. hPanel → **Avançado** → **Node.js**
2. **Criar aplicativo**:
   - Versão Node.js: **20.x**
   - Modo: `Production`
   - Raiz do aplicativo: `public_html/jcip-backend` (ou similar)
   - URL: seu domínio ou subdomínio (ex.: `api.seudominio.com`)
   - Arquivo de entrada: `server.js`
3. Faça upload dos arquivos da pasta `/app/backend-node/` (via File Manager ou FTP):
   - `server.js`
   - `db.js`
   - `migrations.js`
   - `utils.js`
   - `package.json`
   - `.env` (ajustado — veja abaixo)
4. No painel Node.js: clique **Executar NPM Install**
5. Configure o `.env`:

```
DB_HOST=mysql.hostinger.com
DB_PORT=3306
DB_USER=u123456789_jcip
DB_PASSWORD=sua_senha_forte
DB_NAME=u123456789_jcip

JWT_SECRET=coloque-uma-string-longa-e-aleatoria-aqui
JWT_EXPIRE_DAYS=30

PORT=8001
```

6. Clique **Iniciar aplicação**
7. Teste: abrir `https://api.seudominio.com/api/` → deve retornar JSON `{"message":"JCIP House Finance API (Node.js)","status":"online"}`

#### Opção B — VPS Hostinger (se preferir)

```bash
ssh root@seu-vps
apt install -y nodejs npm
git clone <seu-repo>  # ou envie via SCP
cd backend-node
npm install
# configure .env como acima
# Use pm2 para manter rodando:
npm install -g pm2
pm2 start server.js --name jcip-api
pm2 save
pm2 startup
```

### PASSO 4 — Build do APK Android

1. No seu computador:

```bash
git clone <seu-repo>
cd frontend
yarn install
npm install -g eas-cli
eas login
```

2. Edite `/frontend/.env`:

```
EXPO_PUBLIC_BACKEND_URL=https://api.seudominio.com
```

3. Crie `/frontend/eas.json`:

```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "production": {
      "android": { "buildType": "apk" }
    }
  }
}
```

4. Gere o APK:

```bash
eas build --profile production --platform android
```

5. Ao terminar (~10-15 min), o Expo retorna um link → baixe o `.apk` → instale no Android (habilite "Fontes desconhecidas")

---

## ✅ Checklist de verificação

- [ ] Banco criado na Hostinger + schema importado
- [ ] Acesso remoto MySQL liberado
- [ ] Backend Node.js rodando em `https://api.seudominio.com`
- [ ] `/api/` retorna JSON de status
- [ ] `EXPO_PUBLIC_BACKEND_URL` apontando pro backend
- [ ] APK gerado via EAS Build
- [ ] APK instalado e funcional no Android

---

## ❓ Troubleshooting

- **Backend retorna 500 de banco**: confira `.env` do backend, especialmente `DB_HOST`. Alguns hosts exigem o IP/hostname específico mostrado no hPanel.
- **APK não conecta**: Android 9+ exige HTTPS. Certifique-se de que o domínio tem SSL (Let's Encrypt grátis via Hostinger).
- **CORS**: o backend já está com CORS `*` por padrão. Se quiser restringir, edite em `server.js` → `app.use(cors(...))`.
- **Mês não abre automaticamente**: o endpoint `/api/houses/:id/months` cria o mês atual na hora que é chamado. Basta abrir o dashboard.

---

## 💡 Manutenção

### Atualizar backend
```
# SSH ou File Manager
git pull
cd backend-node && npm install
# No painel Node.js: Restart App
```

### Backup do banco
Hostinger faz backup automático. Para manual: phpMyAdmin → Exportar → formato SQL.

### Adicionar novas features
O projeto é modular. Futuras features sugeridas: OCR, IA, gamificação, gráficos, fechamento automático agendado via cron.
