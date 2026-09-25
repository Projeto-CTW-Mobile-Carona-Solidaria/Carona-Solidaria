# Carona Solidária

Aplicação de mobilidade para colaboradores da WEG, baseada em `Documentação carona solidaria.pdf` e nos critérios transcritos em `link.txt`.

- **Mobile:** React Native, Expo SDK 57, TypeScript e Expo Router. Uso exclusivo de colaboradores.
- **Backend:** Java 17, Spring Boot 3.5.16, Spring Security, JPA e API REST.
- **Administração desktop:** Java Swing e cliente HTTP. RH analisa veículos e administra convites; ADMIN também gerencia a equipe de RH.
- **Persistência:** H2 em arquivo no desenvolvimento, PostgreSQL configurável; cache mobile em AsyncStorage e sessão nativa em SecureStore.

## Executar

Requisitos: Node 24 LTS, JDK 17+ e Maven 3.6.3+. O backend e o desktop são módulos do `pom.xml` na raiz.

### 1. Backend

Na primeira execução, defina a conta administrativa. Nenhuma senha padrão é criada:

```powershell
$env:ADMIN_EMAIL = 'administrador@empresa.com'
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host 'Senha inicial (mínimo 10 caracteres)' -AsSecureString)).Password
mvn -pl backend spring-boot:run
```

A API atende em `http://localhost:8080`; `GET /api/health` informa a disponibilidade. Os dados são gravados no diretório `data/` do processo e sobrevivem à reinicialização. As variáveis de bootstrap não alteram um administrador existente.

Configuração opcional: `PORT`, `DATABASE_URL` (URL JDBC), `DATABASE_USER`, `DATABASE_PASSWORD` e `CORS_ORIGINS` (origens separadas por vírgula). Exemplo de PostgreSQL: `jdbc:postgresql://localhost:5432/carona`. Esta versão usa atualização de esquema pelo Hibernate; migrações versionadas devem preceder implantação em produção.

### 2. Desktop de admin e RH

Em outro terminal:

```powershell
mvn -pl desktop -am package
java -jar desktop/target/desktop-1.0.0.jar
```

O desktop abre uma janela nativa, sem navegador. Entre com o administrador e cadastre o RH na aba **Equipe de RH**. RH e ADMIN podem verificar o vínculo de um colaborador e gerar seu convite na aba **Colaboradores**. Entregue o código de uso único por um canal interno após confirmar a identidade. Convites ainda não utilizados podem ser renovados. A verificação de vínculo é manual pelo RH; não há integração com diretório corporativo/SSO nesta versão.

Na aba **Veículos**, clique em Atualizar, selecione uma solicitação pendente e aprove ou reprove com justificativa. A aba **Grupos e vagas especiais** permite consultar participantes e elegibilidade. O cliente aceita HTTP em localhost; servidores remotos exigem HTTPS. `CARONA_API_URL` define o endereço inicial, também editável na tela de login.

### 3. Mobile

```powershell
npm install
# Copie .env.example para .env e ajuste EXPO_PUBLIC_API_URL ao dispositivo.
npm start
```

- Emulador Android: `EXPO_PUBLIC_API_URL=http://10.0.2.2:8080`.
- Dispositivo físico: endereço de rede local do computador, por exemplo `http://192.168.1.10:8080`. Ambos devem estar na mesma rede e a porta 8080 deve estar acessível.
- Preview web: `http://localhost:8080` e `npm run web`.
- Build de produção exige URL HTTPS. Variáveis `EXPO_PUBLIC_*` são públicas; nunca coloque segredos nelas.

O colaborador ativa seu convite com e-mail, matrícula e código, define a senha e completa perfil/WhatsApp. Pode buscar caronas ou solicitar análise de um veículo. Depois da aprovação do veículo, pode oferecer caronas e responder aos passageiros.

O projeto removia referências a ícones inexistentes do template: a configuração atual não depende desses arquivos. Identidade visual segue a paleta azul já existente; comparação visual detalhada com o Figma e validação em dispositivo permanecem no plano de testes.

## Offline e recursos nativos

As buscas e **Minhas caronas** armazenam cópias por usuário e servidor. Depois de uma consulta online, essas informações podem ser consultadas sem conexão, inclusive após reabrir o app nativo enquanto a sessão estiver válida. A tela informa a data da cópia e desabilita alterações no modo offline. `Atualizar` ou retornar ao app consulta o servidor e substitui o cache; não há fila de operações de reserva offline.

Erros de autenticação não usam cache como alternativa. Sair limpa sessão e cache. Sessões expiram após 12 horas. Contatos do grupo são consultados online; as cópias de caronas não armazenam placa ou telefones dos participantes. No preview web, o token fica somente em memória; no Android/iOS, no cofre do sistema via SecureStore.

1. **Geolocalização:** busca por proximidade (até 20 km) e ponto aproximado de saída, mediante permissão em primeiro plano. Recusar mantém busca por bairro disponível; a tela oferece configurações quando a permissão não pode ser solicitada novamente. A distância é em linha reta. Não há rastreamento em segundo plano.
2. **Compartilhamento nativo:** compartilha trajeto, dias e horário pela folha de compartilhamento do sistema, sem contatos pessoais. Não exige permissão adicional de câmera, arquivos ou localização.

## Regras implementadas

- Somente colaboradores convidados pelo RH podem ativar contas de membro; papéis administrativos são definidos no servidor.
- Senhas com BCrypt; tokens aleatórios de 256 bits, armazenados no servidor apenas como hash e revogados ao sair/desativar a conta.
- Veículos precisam de aprovação antes da oferta. Reprovação exige motivo; correção volta à fila de análise.
- Solicitações pendentes não ocupam vaga. A aprovação bloqueia a carona em transação e confere a capacidade novamente.
- Caronas lotadas desaparecem da busca; saída/remoção de passageiro libera vaga.
- Apenas o motorista responde solicitações e remove participantes; contatos são restritos ao grupo confirmado, motorista e equipe administrativa.
- Parentes ocupam assentos, mas não contam para a elegibilidade de vaga especial. Na ausência de um limiar detalhado no PDF, considera-se elegível um grupo ativo com veículo aprovado e ao menos um passageiro confirmado que não seja parente. Isso é um indicador de elegibilidade, não uma reserva de estacionamento.
- Desativar um colaborador revoga sessões, encerra caronas que dirige e remove suas participações. Reativar a conta não reabre caronas encerradas.

## Verificação e organização

```powershell
npm test
npm run typecheck
npx expo export --platform android
mvn test
mvn package
```

Também há `scripts/java.ps1 -Action test|build|backend|desktop`, com `-Maven caminho/para/mvn.cmd` opcional.

Consulte [requisitos e proposta](docs/REQUISITOS.md), [plano e registro de testes](docs/TESTES.md), [Kanban](docs/KANBAN.md) e [contrato da API](docs/API.md). O registro de testes diferencia resultados executados de verificações pendentes; esta implementação não substitui a apresentação em dispositivo exigida na avaliação.

Referências técnicas utilizadas: [Expo 57](https://docs.expo.dev/versions/v57.0.0/), [Location 57](https://docs.expo.dev/versions/v57.0.0/sdk/location/), [Spring Boot 3.5](https://docs.spring.io/spring-boot/3.5/system-requirements.html) e [Share do React Native](https://reactnative.dev/docs/share).
