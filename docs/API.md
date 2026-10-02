# API REST

Base: `http://localhost:8079/api`. JSON UTF-8. Use `Authorization: Bearer <token>` nos endpoints protegidos. Token expira em 12 horas e só seu hash é persistido. Senhas e convites não são retornados em consultas de usuários.

| Método e rota | Acesso | Operação |
| --- | --- | --- |
| GET `/health` | Público | Disponibilidade |
| POST `/auth/login` | Público | `{email,password}` → `{token,expiresAt,user}` |
| POST `/auth/register` | Convite | `{email,employeeId,invitationCode,password}` → sessão |
| POST `/auth/logout` | Autenticado | Revoga token atual (204) |
| GET `/me` | Autenticado | Perfil |
| PUT `/me` | MEMBER | `{name,whatsapp,neighborhood,days}` |
| GET/PUT `/me/vehicle` | MEMBER | Consultar / enviar `{plate,model,color,seats}` |
| GET `/me/rides` | MEMBER | Grupos dirigidos e histórico de participações |
| GET `/me/requests` | MEMBER | Status, dias e aprovações das próprias solicitações, sem contatos |
| GET `/rides` | MEMBER | Busca: `query`, `day`, `latitude`, `longitude`, `radius` opcionais |
| POST `/rides` | MEMBER | `{origin,destination,departureTime,capacity,days,latitude?,longitude?}` |
| GET `/rides/{id}` | Motorista / confirmado / equipe | Grupo e contatos; motorista/equipe veem pendentes |
| POST `/rides/{id}/requests` | MEMBER | Solicitar com `{relative:boolean,days:["MONDAY",...]}`; dias obrigatórios e contidos na oferta |
| PATCH `/rides/{id}/requests/{requestId}` | Motorista proprietário / RH / ADMIN | `{accepted:boolean}`; registra a decisão do motorista ou da equipe de RH conforme o usuário autenticado |
| DELETE `/rides/{id}/membership` | Próprio passageiro | Cancelar pedido / sair (204) |
| DELETE `/rides/{id}/participants/{requestId}` | Motorista proprietário | Remover aprovado (204) |
| DELETE `/rides/{id}` | Motorista proprietário | Encerrar grupo (204) |
| GET `/rh/vehicles` | RH / ADMIN | Fila e histórico de análise |
| PATCH `/rh/vehicles/{id}` | RH / ADMIN | `{approved:boolean,reason?:string}`; motivo obrigatório para reprovar |
| GET/POST `/rh/members` | RH / ADMIN | Listar / convidar `{name,email,employeeId}` |
| POST `/rh/members/{id}/invitation` | RH / ADMIN | Renovar convite ainda não consumido |
| PATCH `/rh/members/{id}` | RH / ADMIN | `{name,active:boolean}` |
| GET `/rh/groups` | RH / ADMIN | Consulta de grupos e elegibilidade |
| GET/POST `/admin/rh` | ADMIN | Listar / cadastrar `{name,email,employeeId,password}` |
| PATCH `/admin/rh/{id}` | ADMIN | `{name,active:boolean}` |

Dias usam `MONDAY` a `SUNDAY`; horário `HH:mm`; telefone usa DDI+DDD+número, somente dígitos. `seats`/`capacity` excluem o motorista. A solicitação pode conter qualquer subconjunto não vazio dos dias semanais oferecidos; não são reservas por data do calendário.

Cada participação retorna `days`, `driverApproved` e `rhApproved`. A primeira aprovação mantém `status: "PENDING"` e não ocupa vagas nem libera os contatos do grupo ao passageiro. Somente as duas aprovações, em qualquer ordem, mudam o status para `ACCEPTED` e ocupam uma vaga em cada dia solicitado. RH e ADMIN compartilham a decisão da equipe; duas aprovações administrativas não substituem o motorista. A repetição da mesma aprovação retorna 409. Uma recusa de qualquer lado encerra a solicitação com `REJECTED`; um novo pedido reinicia ambas as aprovações e substitui os dias anteriores.

Cada carona retorna `availableSeatsByDay`, por exemplo `{"MONDAY":0,"WEDNESDAY":1}`. O campo `availableSeats` representa o mínimo de vagas entre todos os dias oferecidos; interfaces devem usar o mapa para mostrar a disponibilidade de cada dia. A busca com `day` exige vaga naquele dia; sem filtro, basta existir vaga em algum dia. Grupos em que o solicitante já está pendente/confirmado são omitidos. Solicitar exige disponibilidade em todos os dias escolhidos e a segunda aprovação confere a capacidade novamente, sob lock. Saída, remoção e desativação liberam somente os dias ocupados.

Na atualização de uma base anterior, solicitações sem dias recebem todos os dias da carona. Participações aceitas pelo fluxo antigo preservam a aprovação do motorista e voltam a `PENDING` para análise do RH. Nenhuma aprovação administrativa é presumida. A conversão é executada uma vez por registro ao iniciar a API; caronas novas e registros já convertidos mantêm seu estado.

Erros de negócio: `{ "message": "explicação" }`, com HTTP 400 (validação), 401 (sessão), 403 (permissão), 404 (registro), 409 (conflito, duplicidade ou capacidade). Clientes devem atualizar o grupo depois de um 409. Operações de capacidade usam lock pessimista na carona dentro da transação.
