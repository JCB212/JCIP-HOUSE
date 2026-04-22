# 📦 JCIP House Finance - Guia de Build do APK Android

Este documento explica como você mesmo pode gerar o arquivo `.apk` do JCIP House Finance para instalar no seu celular Android (fora do Emergent/Expo Go).

---

## 🧾 Pré-requisitos

1. **Conta Expo (gratuita)** — https://expo.dev/signup
2. **Node.js 20+** instalado na sua máquina
3. **Git** instalado
4. Acesso ao código-fonte (faça "Save to GitHub" pelo Emergent)

---

## 🚀 Opção 1 — EAS Build na nuvem (RECOMENDADO)

### Passo 1 — Clonar o repo

```bash
git clone <seu-repo-github>
cd <seu-repo>/frontend
yarn install
```

### Passo 2 — Instalar o CLI do EAS

```bash
npm install -g eas-cli
eas login     # entre com sua conta Expo
```

### Passo 3 — Configurar o projeto

Dentro de `/frontend`:

```bash
eas build:configure
```

Isso criará um arquivo `eas.json`. Substitua pelo conteúdo abaixo para gerar
um APK direto (não um AAB):

```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "production": {
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    }
  },
  "submit": { "production": {} }
}
```

### Passo 4 — Apontar a API para seu servidor de produção

Edite `/frontend/.env` e defina:

```
EXPO_PUBLIC_BACKEND_URL=https://seu-backend.com
```

> Esse deve ser o endereço onde você vai hospedar o backend FastAPI
> (ex.: Hostinger VPS, Railway, Render, DigitalOcean, etc.) e que se conecta
> ao seu MySQL da Hostinger.

### Passo 5 — Gerar o APK

```bash
eas build --profile preview --platform android
```

- O Expo vai compilar na nuvem (leva 10-15 min).
- Quando terminar, você recebe um link para baixar o `.apk`.
- Instale no celular (pode precisar habilitar "Fontes desconhecidas").

---

## 🏗️ Opção 2 — Build local (avançado)

Requer Android Studio + JDK 17 + Android SDK instalados.

```bash
cd frontend
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

O APK fica em `frontend/android/app/build/outputs/apk/release/app-release.apk`

---

## 🔧 Hospedagem do Backend (FastAPI + MySQL Hostinger)

O APK só é útil se o backend estiver rodando num servidor público. Opções:

### Rápida: Railway / Render
1. Conecte seu GitHub
2. Aponte para a pasta `/backend`
3. Adicione as variáveis de ambiente:
   ```
   MYSQL_URL=mysql+pymysql://USUARIO:SENHA@HOST_HOSTINGER:3306/NOMEDB?charset=utf8mb4
   JWT_SECRET=uma-string-longa-e-secreta
   JWT_ALGORITHM=HS256
   JWT_EXPIRE_DAYS=30
   ```
4. Comando de start:
   ```
   uvicorn server:app --host 0.0.0.0 --port $PORT
   ```

### VPS Hostinger
```bash
ssh usuario@seu-vps
git clone <seu-repo>
cd <seu-repo>/backend
pip install -r requirements.txt
# Edite o .env como acima
uvicorn server:app --host 0.0.0.0 --port 8001
# (use systemd ou pm2 para manter rodando)
```

### Banco de dados
Importe o arquivo `/app/database.sql` no phpMyAdmin da Hostinger.

---

## ❓ Problemas comuns

- **App não conecta ao backend**: verifique se `EXPO_PUBLIC_BACKEND_URL` aponta
  para um HTTPS válido (Android 9+ bloqueia HTTP puro).
- **MySQL Hostinger não aceita conexão remota**: ative a opção "acesso remoto"
  no hPanel e libere o IP do servidor onde o backend está hospedado.
- **Build do EAS falha**: confira que `app.json` tem os campos `android.package`
  e `ios.bundleIdentifier` preenchidos (ex.: `com.seunome.jcip`).
