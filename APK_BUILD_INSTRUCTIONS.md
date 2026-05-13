# JCIP House Finance - Deploy na Hostinger + APK

Este projeto tem tres partes:

- `frontend`: app mobile em Expo/React Native. Ele vira o APK.
- `backend-node`: API Node.js/Express. Ela deve rodar na Hostinger.
- MySQL Hostinger: banco de dados em nuvem.

O APK nao deve conectar direto no MySQL. As credenciais do banco ficam somente na API Node.js. O app mobile usa SQLite local para cache/fila offline e sincroniza com a API quando a internet voltar.

## 1. Criar o banco MySQL na Hostinger

1. Abra o hPanel da Hostinger.
2. Entre em `Websites` > selecione seu site/domínio > `Dashboard`.
3. No menu lateral, abra `Databases` > `Management` ou `MySQL Databases`.
4. Crie o banco com estes dados, se forem os mesmos do seu painel:
   - Database name: `u251982692_jciphouse`
   - Database username: `u251982692_jciphouse`
   - Password: a senha criada no hPanel
5. Guarde tambem o host do banco. Em app Node.js dentro da Hostinger, use primeiro `127.0.0.1`.

## 2. Importar as tabelas

1. No hPanel, abra o `phpMyAdmin` do banco criado.
2. Selecione o banco `u251982692_jciphouse`.
3. Clique em `Importar`.
4. Selecione o arquivo `database_hostinger.sql`.
5. Execute a importacao.
6. Ao terminar, o banco deve ter 27 tabelas.

Use `database_hostinger.sql` para a Hostinger. Ele foi preparado para MySQL/MariaDB e phpMyAdmin.

## 3. Publicar a API Node.js pela tela da Hostinger

Na tela `Implante seu web app em Node.js`, escolha `Importar repositorio Git` e clique em `Conecte-se com GitHub`.

1. Autorize a Hostinger no GitHub.
2. Selecione o repositorio:
   - `JCB212/JCIP-HOUSE`
3. Selecione a branch:
   - `main`
4. Se a Hostinger mostrar campo de pasta raiz/root directory/application directory, preencha:
   - `backend-node`
5. Configure o app:
   - Framework: `Express.js` se aparecer; se nao aparecer, use `Other`.
   - Node.js version: `20.x` ou `22.x`.
   - Entry file: `server.js`.
   - Install command: `npm install` ou `npm ci`.
   - Build command: deixe vazio/none, porque a API nao precisa de build.
   - Start command: `npm start`.
   - Output directory: deixe vazio.
6. Clique em `Deploy`.

Importante: o repositorio e um monorepo, entao o `package.json` da API esta dentro de `backend-node`. Se a Hostinger nao aceitar escolher essa subpasta e acusar `Unsupported framework` ou `invalid project structure`, use uma destas alternativas:

- Alternativa A: na tela da Hostinger escolha `Faca upload dos arquivos` e envie um `.zip` contendo somente o conteudo da pasta `backend-node`, nao o projeto inteiro.
- Alternativa B: crie um segundo repositorio so para a API, com o conteudo de `backend-node` na raiz, e importe esse repositorio na Hostinger.

## 4. Configurar variaveis de ambiente

No dashboard do Node.js App na Hostinger, abra `Environment Variables` e cadastre:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=u251982692_jciphouse
DB_PASSWORD=COLE_A_SENHA_REAL_DO_HPANEL
DB_NAME=u251982692_jciphouse

JWT_SECRET=COLOQUE_UMA_STRING_LONGA_ALEATORIA_AQUI
JWT_EXPIRE_DAYS=30
```

Sobre `PORT`:

- Se a Hostinger pedir `App port`, use `8001` e adicione `PORT=8001`.
- Se a Hostinger ja gerenciar a porta automaticamente, nao cadastre `PORT`; o app aceita `process.env.PORT`.

Depois de salvar as variaveis, clique em `Restart` ou faca `Redeploy`.

## 5. Testar a API publicada

Troque `api.seudominio.com` pelo dominio ou subdominio configurado na Hostinger.

1. Teste status da API:

```text
https://api.seudominio.com/api/
```

Resposta esperada:

```json
{"message":"JCIP House Finance API (Node.js)","status":"online"}
```

2. Teste conexao com banco:

```text
https://api.seudominio.com/api/health
```

Resposta esperada:

```json
{
  "status": "ok",
  "api": "online",
  "database": "online",
  "db_configured": true
}
```

## 6. Apontar o APK para a API

No projeto mobile, crie/edite `frontend/.env`:

```env
EXPO_PUBLIC_BACKEND_URL=https://api.seudominio.com
```

Nao coloque host, usuario ou senha do MySQL no APK.

Depois gere o APK:

```bash
cd frontend
yarn install
npx eas-cli build --profile production --platform android
```

O arquivo `frontend/eas.json` ja esta configurado para gerar APK Android em `production`.

## 7. Checklist final

- Banco MySQL criado.
- `database_hostinger.sql` importado.
- Node.js App publicado apontando para `backend-node`.
- Variaveis de ambiente preenchidas.
- `/api/` retorna `status: online`.
- `/api/health` retorna `database: online`.
- `frontend/.env` aponta para a URL HTTPS da API.
- APK instalado e testado.
- Teste offline: depois do primeiro login, crie dados sem internet, reconecte e confirme a sincronizacao.

## 8. Problemas comuns

- `Unsupported framework`: a Hostinger nao achou o `package.json`. Use root directory `backend-node` ou envie ZIP somente da pasta `backend-node`.
- `Access denied for user`: confira `DB_USER`, `DB_PASSWORD`, `DB_NAME` e se o usuario esta vinculado ao banco.
- `Access denied for user ... @::1`: troque `DB_HOST=localhost` por `DB_HOST=127.0.0.1` e reinicie o app.
- `Cannot connect to MySQL server`: confirme o host do banco no hPanel. Quando API e banco estao na mesma hospedagem Hostinger, tente `127.0.0.1` primeiro.
- `/api/health` falha, mas `/api/` abre: a API subiu, mas o banco esta com variavel errada ou schema ausente.
- APK nao conecta: use HTTPS e confirme `EXPO_PUBLIC_BACKEND_URL` sem barra no final, por exemplo `https://api.seudominio.com`.
- Alterou variavel de ambiente: sempre faca `Restart` ou `Redeploy`.
