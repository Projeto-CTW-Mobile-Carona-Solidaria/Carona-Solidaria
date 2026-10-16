# Deploy gratuito: Render + Neon

O `Dockerfile` empacota as três aplicações em um serviço Java, com uma única URL HTTPS:

- `/`: versão web do app Expo para colaboradores.
- `/admin/`: painel de RH e ADMIN.
- `/api/health`: verificação de disponibilidade da API.

O `render.yaml` seleciona explicitamente o plano **Free** e desativa deploys automáticos. O banco fica no plano **Free da Neon**, fora do filesystem efêmero da Render. Não use H2 em arquivo nesse ambiente.

## Variáveis locais

O backend lê `.env` na raiz quando iniciado da raiz ou de `backend/`. Variáveis do sistema têm prioridade. Use o formato `CHAVE=valor` sem aspas; o arquivo é interpretado como Java properties. A senha de administrador gerada fica somente na `.env`, ignorada pelo Git e pelo Docker. Ela só define a conta na primeira inicialização de uma base nova.

`web/.env` usa a API pelo proxy local do Vite. `mobile/.env` aponta para `http://localhost:8079` para o preview web; para dispositivo físico, use o IP de rede do computador, e para emulador Android use `http://10.0.2.2:8079`.

## Publicação

1. Conecte as contas Render e Neon. Mantenha ambas nos planos gratuitos. Para evitar cobranças de excedentes na Render, use uma conta sem forma de pagamento; se ela já tiver pagamento cadastrado, confira os controles de gastos antes de criar o serviço.
2. Crie um projeto PostgreSQL **Free** na Neon, preferencialmente na região US East próxima à Render Virginia. Use as credenciais de conexão direta, com SSL.
3. Disponibilize esta versão do código em um repositório acessível pela Render. Arquivos locais não publicados não entram no deploy; não envie `.env` nem dados locais.
4. Crie um Blueprint na Render a partir do `render.yaml` e informe:

   | Variável | Valor |
   | --- | --- |
   | `DATABASE_URL` | URL JDBC da Neon: `jdbc:postgresql://HOST/neondb?sslmode=require` (substitua host e banco reais; sem usuário/senha na URL) |
   | `DATABASE_USER` | Usuário fornecido pela Neon |
   | `DATABASE_PASSWORD` | Senha fornecida pela Neon |
   | `ADMIN_EMAIL` | E-mail da conta administradora |

   A Render gera `ADMIN_PASSWORD` aleatoriamente. Consulte-a nas variáveis privadas do serviço após a criação. O perfil `cloud` exige as configurações do banco externo e não usa credenciais padrão.

5. Aguarde o build e a aprovação de `/api/health`. A Render atribui a URL definitiva `https://<nome-disponivel>.onrender.com`; o nome exato só é conhecido após a criação.
6. Verifique app, login administrativo e API nessa URL. Para o aplicativo nativo, substitua `EXPO_PUBLIC_API_URL` em `mobile/.env` pela URL HTTPS definitiva e reinicie o Expo/recompile o app. O build web do Docker ignora `.env` locais e usa a mesma origem automaticamente.

## Limites gratuitos

- A Render suspende o serviço após 15 minutos sem acessos; o próximo acesso pode levar cerca de um minuto para iniciar. A URL continua a mesma enquanto o serviço existir.
- A Render concede 750 horas gratuitas por workspace/mês, compartilhadas entre serviços. Também há limites de tráfego e build.
- A Neon Free tem limites de armazenamento e computação; confira o painel antes de publicar. O pool JDBC usa até quatro conexões e libera conexões ociosas para permitir a suspensão do banco.
- Esses planos servem para demonstração e uso leve; a gratuidade não garante disponibilidade contínua.

Fontes: [Render Free](https://render.com/docs/free), [Neon Free](https://neon.com/pricing), [Blueprints](https://render.com/docs/blueprint-spec), [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/config/app/).

## Verificação local dos builds

```powershell
npm --prefix web ci
npm --prefix web run build -- --base=/admin/
npm --prefix mobile ci
npm --prefix mobile run typecheck
npm --prefix mobile test
mvn -pl backend test
```

O `Dockerfile` executa o export web do Expo sem variáveis locais e inclui os testes do backend no build. Com Docker iniciado, valide o empacotamento completo com `docker build -t carona-solidaria .`. O container usa o perfil `cloud` e requer as variáveis reais do banco para iniciar.
