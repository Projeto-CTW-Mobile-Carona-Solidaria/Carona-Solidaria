# API REST

Base: `http://localhost:8080/api`. JSON UTF-8. Use `Authorization: Bearer <token>` nos endpoints protegidos. Token expira em 12 horas e só seu hash é persistido. Senhas e convites não são retornados em consultas de usuários.

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
| GET `/me/requests` | MEMBER | Status das próprias solicitações, sem contatos |
| GET `/rides` | MEMBER | Busca: `query`, `day`, `latitude`, `longitude`, `radius` opcionais |
| POST `/rides` | MEMBER | `{origin,destination,departureTime,capacity,days,latitude?,longitude?}` |
| GET `/rides/{id}` | Motorista / confirmado / equipe | Grupo e contatos; motorista/equipe veem pendentes |
| POST `/rides/{id}/requests` | MEMBER | Solicitar com `{relative:boolean}` |
| PATCH `/rides/{id}/requests/{requestId}` | Motorista proprietário | `{accepted:boolean}` |
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

Dias usam `MONDAY` a `SUNDAY`; horário `HH:mm`; telefone usa DDI+DDD+número, somente dígitos. `seats`/`capacity` excluem o motorista. Busca considera apenas grupos ativos com vagas e remove aqueles em que o solicitante já está pendente/confirmado. Solicitações não consomem vagas até a aprovação.

Erros de negócio: `{ "message": "explicação" }`, com HTTP 400 (validação), 401 (sessão), 403 (permissão), 404 (registro), 409 (conflito, duplicidade ou capacidade). Clientes devem atualizar o grupo depois de um 409. Operações de capacidade usam lock pessimista na carona dentro da transação.
