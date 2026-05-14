# JCIP House

Aplicativo mobile de organização financeira pessoal e da casa, com dashboard mensal, divisão de despesas, contribuições, contas a pagar/receber, lista de compras, afazeres, permissões por morador, modo claro/escuro e sincronização com a API Node.js.

## Como rodar

1. Instale as dependências:

   ```bash
   yarn install
   ```

2. Configure a API:

   ```bash
   cp .env.example .env
   ```

   Defina `EXPO_PUBLIC_BACKEND_URL` com a URL do backend publicado na Hostinger.

3. Inicie o app:

   ```bash
   npx expo start
   ```

## Build Android

O APK é gerado a partir deste diretório com:

```bash
npx expo prebuild --platform android --clean
cd android
gradlew.bat assembleRelease
```

## Segurança

Senhas e credenciais ficam em variáveis de ambiente. Não coloque `.env`, senha SMTP, token JWT ou credenciais do banco no GitHub ou dentro do APK.
