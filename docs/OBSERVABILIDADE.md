# Observabilidade

## Componentes e dashboards

O backend Spring Boot expõe `/actuator/prometheus` com Actuator e Micrometer. O Prometheus coleta essas métricas a cada 15 segundos. A contagem de eventos de log também aparece como `logback_events_total`; o conteúdo dos logs é armazenado no Loki. Essa separação segue as funções do [Prometheus](https://prometheus.io/docs/introduction/overview/) e do [Loki](https://grafana.com/docs/loki/latest/).

O perfil `observability` grava logs ECS em `backend/logs/application.json` quando iniciado pelo script. Alloy acompanha o arquivo e envia as linhas ao Loki. O formato ECS usa o [suporte nativo do Spring Boot 3.5](https://docs.spring.io/spring-boot/3.5/reference/features/logging.html#features.logging.structured).

Os arquivos em `observability/grafana/` provisionam as fontes e dois dashboards na pasta **Carona Solidária**:

| Dashboard | Conteúdo |
| --- | --- |
| API e JVM | Disponibilidade da coleta, requisições por segundo, erros 5xx, p50/p95/p99, tráfego por rota/método, status HTTP, memória, CPU, conexões HikariCP, pausas de GC e eventos de log por nível |
| Logs | Quantidade de eventos/avisos/erros, volume por nível, logs completos e avisos/erros; filtros de nível, texto e `requestId` |

Os painéis usam dados coletados. Latência e taxas precisam de tráfego e de algumas coletas; sem eventos para os filtros escolhidos, os painéis de logs mostram ausência de dados. Não há notificações de alertas configuradas.

## Iniciar no Windows

Requisitos: Docker Desktop com contêineres Linux, Docker Compose v2, JDK 17+ e Maven. Configure antes a `.env` do backend conforme o README, incluindo as credenciais de bootstrap se o banco estiver vazio.

Na raiz do projeto:

```powershell
./scripts/observability.ps1 -Action up
```

O comando gera um token e uma senha aleatórios em `observability/.secrets/`, preserva valores existentes e inicia quatro contêineres. Os segredos ficam fora do Git e do contexto de build Docker. Em outro terminal:

```powershell
./scripts/observability.ps1 -Action backend

# Se o Maven não estiver corretamente configurado no PATH:
./scripts/observability.ps1 -Action backend -Maven 'C:/apache-maven-3.10.0/bin/mvn.cmd'
```

Esse comando inicia a API com `METRICS_TOKEN`, `LOG_FILE` absoluto e o perfil `observability`, preservando outros perfis ativos. Ao encerrar, restaura as variáveis anteriores do terminal. Pare uma API que já estiver usando a porta 8079 antes de iniciar essa instância.

| Acesso | Endereço |
| --- | --- |
| Grafana | http://localhost:3300 |
| Dashboard API/JVM | http://localhost:3300/d/carona-api |
| Dashboard Logs | http://localhost:3300/d/carona-logs |
| Prometheus e seus targets | http://localhost:9090/targets |
| API | http://localhost:8079/api/health |

Entre no Grafana com `admin`. Para consultar a senha local:

```powershell
Get-Content observability/.secrets/grafana-admin-password
```

Grafana e Prometheus publicam portas somente em `127.0.0.1`. Loki e Alloy ficam na rede interna do Compose. Nenhum desses serviços precisa de conta cloud. A senha inicial do Grafana só é aplicada na criação do banco de dados do Grafana; alterações posteriores devem usar a administração do Grafana. Para trocar a porta local do Grafana, defina `GRAFANA_PORT` no terminal antes de iniciar a stack e de executar a verificação.

O Prometheus usa `host.docker.internal:8079` para acessar o backend executado no computador. O Compose inclui o mapeamento `host-gateway` para Linux. Se `PORT` for diferente, ajuste `targets` em `observability/prometheus/prometheus.yml` e reinicie o Prometheus. O coletor espera o arquivo `backend/logs/application.json`; ao mudar `LOG_FILE`, ajuste também o volume e o caminho do Alloy.

## Consultar métricas e logs

Exemplos de PromQL:

```promql
up{job="carona-backend"}
sum by (uri, method) (rate(http_server_requests_seconds_count{job="carona-backend"}[5m]))
histogram_quantile(0.95, sum by (le) (rate(http_server_requests_seconds_bucket{job="carona-backend"}[5m])))
sum by (level) (rate(logback_events_total{job="carona-backend"}[5m]))
```

Exemplos de LogQL, no Explore do Grafana com a fonte **Loki**:

```logql
{application="carona-solidaria"}
{application="carona-solidaria", level=~"WARN|ERROR"}
{application="carona-solidaria"} | json | requestId="ID_RETORNADO_PELA_API"
```

As requisições `/api/**` recebem um `X-Request-ID` gerado no servidor. O log contém esse `requestId`, método, template da rota, status e duração em milissegundos. Requisições bloqueadas antes do controlador usam `UNMATCHED`. O filtro não registra URI bruta, query string, corpo, cabeçalho de autenticação ou identificadores de usuários. O health check não gera log de acesso, e a coleta do Actuator também não passa pelo log de acesso. Logs internos do Spring e das bibliotecas continuam disponíveis; evite ativar logs de SQL e corpos HTTP em ambientes com dados reais.

O pipeline define rótulos de aplicação, job, ambiente e nível; Alloy também inclui o nome do arquivo e Loki pode inferir `service_name`. IDs de requisição permanecem no JSON, evitando um índice de alta cardinalidade. Filtros de texto e requestId no dashboard aceitam expressões regulares RE2.

## Validar e administrar

```powershell
# Validação nativa por promtool, Loki e Alloy.
./scripts/observability.ps1 -Action validate

# Testes do backend, incluindo autenticação das métricas e privacidade do log.
mvn test

# Com API e stack ativas: verifica coleta, ingestão e consultas dos dashboards.
python scripts/verify-observability.py

./scripts/observability.ps1 -Action status
./scripts/observability.ps1 -Action down
```

`down` encerra os serviços e preserva os volumes. Prometheus retém até sete dias ou 1 GB de métricas; Loki remove logs com mais de sete dias pelo compactor. Os arquivos locais giram a cada 10 MB, com histórico de sete dias limitado a 100 MB. Alloy mantém suas posições de leitura em um volume. O coletor acompanha o arquivo ativo; arquivos compactados de rotações antigas não são reimportados automaticamente se o coletor ficar parado durante a rotação. O armazenamento de logs no Loki não tem um limite de bytes configurado; acompanhe o espaço disponível.

Se o target estiver `DOWN`, confira a API, a porta e se ela foi iniciada com o mesmo token em `observability/.secrets/metrics-token`. Um token vazio bloqueia a coleta. Um token de usuário do aplicativo, mesmo de ADMIN, não concede acesso às métricas. O token de coleta também não autentica operações da API. Outros endpoints do Actuator permanecem bloqueados.

Se não aparecerem logs, gere uma requisição da aplicação e confira se `backend/logs/application.json` existe. Aguarde a descoberta do arquivo e o primeiro envio. Para diagnosticar os contêineres:

```powershell
docker compose -f observability/compose.yaml logs --tail=80 alloy loki prometheus grafana
```

## Deploy existente

O Compose monitora o backend local. Não provisiona serviços no Render nem acessa o banco de produção. Para monitorar um backend remoto, configure um target HTTPS, o token `METRICS_TOKEN` correspondente e um pipeline de logs no ambiente hospedado. O Alloy local não lê arquivos do Render. Não publique este Loki sem autenticação na internet; para hospedagem remota, use uma implantação com autenticação e TLS ou fontes gerenciadas.

Os dashboards são provisionados como arquivos e devem ser editados em `observability/grafana/dashboards/`. O Grafana recarrega os arquivos periodicamente, conforme sua [documentação de provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/).
