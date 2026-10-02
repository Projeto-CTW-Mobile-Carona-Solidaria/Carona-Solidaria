# Carona Solidária

Plataforma de caronas para colaboradores da WEG. Cada aplicação fica em seu próprio diretório e se comunica com a mesma API REST.

```text
mobile/       Aplicativo dos colaboradores — React Native, Expo SDK 57 e TypeScript
web/          Painel desktop no navegador — React, TypeScript e Vite
backend/      API e banco de dados — Java 17, Spring Boot e JPA
scripts/      Atalhos para executar e validar o backend
docs/         Requisitos, contrato da API e registro de validação
```

O painel web substitui o cliente Java Swing. Não é necessário instalar um aplicativo desktop nem executar um JAR de interface. Mobile e web possuem dependências independentes, com seus próprios `package.json`, `package-lock.json` e `node_modules`.

## Backend

Requisitos: JDK 17+ e Maven 3.6.3+. Na raiz do repositório:

```powershell
mvn -pl backend spring-boot:run
```

A API atende em `http://localhost:8079`; `GET /api/health` informa sua disponibilidade. O banco de desenvolvimento fica em `backend/data/` quando iniciado pelo comando acima. `ADMIN_EMAIL` e `ADMIN_PASSWORD` configuram o administrador inicial; não alteram uma conta existente. Defina essas variáveis antes de iniciar uma nova base.

Configuração opcional: `PORT`, `DATABASE_URL` (URL JDBC), `DATABASE_USER`, `DATABASE_PASSWORD` e `CORS_ORIGINS` (origens separadas por vírgula). O desenvolvimento usa H2 em arquivo; PostgreSQL pode ser configurado. O Hibernate atualiza o esquema automaticamente nesta versão.

O banco anteriormente localizado em `data/` na raiz foi preservado em `backend/data-from-root/`, sem substituir `backend/data/`. Para usar aquela base, configure explicitamente sua URL JDBC. Arquivos gerados do Swing foram preservados em `.tools/legacy-desktop/`, fora do código ativo.

## Painel web desktop

Requisito: Node 24 LTS. Em outro terminal:

```powershell
cd web
npm ci
npm run dev
```

Abra `http://localhost:5173` no navegador. Entre com uma conta de **RH** ou **ADMIN**. O Vite encaminha `/api` para `http://localhost:8079`; não é necessário configurar CORS para esse proxy local. Para outro servidor, copie `web/.env.example` para `web/.env`, configure `VITE_API_URL` e autorize a origem do painel em `CORS_ORIGINS` na API.

- **Veículos:** buscar por nome, placa ou modelo; filtrar situação; aprovar ou recusar com motivo.
- **Colaboradores:** convidar, copiar o código, renovar convites, editar nome e ativar/desativar contas. Confirme o vínculo com a empresa e entregue o convite por um canal interno após verificar a identidade.
- **Caronas e solicitações:** consultar grupos, vagas por dia, participantes e elegibilidade a estacionamento; aprovar ou recusar pelo RH.
- **Equipe de RH:** cadastrar e gerenciar contas de RH; disponível somente ao ADMIN.

A interface inclui tabelas, navegação lateral, busca, filtros e diálogos acessíveis pelo teclado. Também se adapta a janelas menores. Operações administrativas exigem conexão. A sessão fica somente na memória: recarregar ou fechar a aba exige novo login; sair revoga o token e limpa a sessão local.

```powershell
# Dentro de web/
npm run build
npm run preview
```

O build estático fica em `web/dist/`. O preview atende em `http://localhost:4173` e usa o mesmo proxy da API. Na hospedagem, sirva os arquivos por HTTPS e encaminhe `/api` ao backend por proxy reverso, ou defina `VITE_API_URL` para a URL HTTPS da API antes do build e configure CORS. Variáveis `VITE_*` são públicas.

## Mobile

```powershell
cd mobile
npm ci
npm start
```

Copie `mobile/.env.example` para `mobile/.env` e ajuste `EXPO_PUBLIC_API_URL` quando necessário:

- Emulador Android: `http://10.0.2.2:8079`.
- Dispositivo físico: IP local do computador, por exemplo `http://192.168.1.10:8079`; ambos na mesma rede.
- Preview web dos colaboradores: `http://localhost:8079`, com `npm run web` dentro de `mobile/`.
- Produção: URL HTTPS. Variáveis `EXPO_PUBLIC_*` são públicas; nunca coloque segredos nelas.

O colaborador ativa o convite no app, define sua senha e completa perfil/WhatsApp. Pode buscar ou oferecer caronas, cadastrar o veículo e acompanhar solicitações. RH e ADMIN usam o painel em `web/`.

## Regras das caronas

- Veículos precisam de aprovação do RH antes da oferta; correções exigem nova análise.
- O passageiro escolhe um subconjunto dos dias da semana oferecidos com vagas.
- A participação só é confirmada após aprovação do motorista e do RH (ou ADMIN), em qualquer ordem. Enquanto faltar uma aprovação, não ocupa vaga. Qualquer lado pode recusar.
- A segunda aprovação confere todos os dias solicitados sob lock transacional. Cada passageiro ocupa uma vaga somente nesses dias; passageiros em dias diferentes podem compartilhar a capacidade semanal.
- A busca por dia considera a disponibilidade daquele dia; sem filtro, basta haver vaga em um dos dias. Saída ou remoção libera os dias ocupados.
- Contatos são restritos ao grupo confirmado, motorista e equipe administrativa. Somente o motorista remove participantes.
- Parentes ocupam vagas, mas não contam para a elegibilidade de estacionamento especial. O indicador exige ao menos um passageiro confirmado sem parentesco; não reserva uma vaga física.
- Desativar um colaborador revoga sessões, encerra as caronas que dirige e remove suas participações. Reativar não reabre caronas encerradas.

Na primeira inicialização após a atualização das aprovações, pedidos antigos recebem todos os dias da carona. Participações antes aceitas preservam a aprovação do motorista e passam a aguardar o RH; voltam a ocupar vagas após confirmação conjunta. A conversão é idempotente.

## Offline e recursos nativos

O mobile mantém cópias de buscas e de **Minhas caronas**, por usuário e servidor, em AsyncStorage. A tela informa a data da cópia e bloqueia alterações offline; não existe fila de reservas offline. Erros de autenticação não recuperam dados do cache. Sair limpa sessão e cache. No Android/iOS, a sessão é armazenada em SecureStore; no preview web, permanece na memória. Contatos do grupo são consultados online.

A localização em primeiro plano permite buscar caronas próximas, mediante permissão. Recusar mantém a busca por bairro. O compartilhamento nativo envia trajeto, dias e horário, sem contatos pessoais.

## Comandos na raiz

Após instalar as dependências em cada aplicação:

```powershell
npm run mobile
npm run web
npm run build:web
npm run typecheck:mobile
npm run test:mobile
mvn test
```

`npm run desktop` também inicia o painel web. `scripts/java.ps1 -Action test|build|backend` é exclusivo do backend.

Consulte [requisitos](docs/REQUISITOS.md), [contrato da API](docs/API.md), [refinamento visual](docs/DESIGN.md), [validação](docs/TESTES.md) e [Kanban](docs/KANBAN.md).
