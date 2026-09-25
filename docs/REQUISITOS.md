# Proposta e rastreabilidade

## Proposta para aprovação pelo professor

**Problema:** combinar caronas por mensagens dispersas dificulta encontrar trajetos compatíveis, saber quantas vagas existem e verificar quais veículos participam do programa.

**Contexto:** deslocamento de colaboradores para unidades da WEG. Oportunidade Kaizen: reduzir o esforço de coordenação das viagens e tornar o processo de aprovação visível.

**Usuários:** colaboradores passageiros e motoristas no mobile; RH e administradores no desktop.

**Solução:** cadastro restrito por convite, perfil de dias/contato, aprovação de veículo pelo RH, busca por trajeto/dia/proximidade e grupos com capacidade controlada no servidor. Consulta offline ajuda o colaborador a rever o trajeto quando a conexão falhar. O compartilhamento nativo facilita combinar pontos de encontro.

**Indicadores sugeridos para validação:** tempo para encontrar um trajeto compatível; taxa de ocupação; quantidade de aprovações de veículos pendentes. Não foram coletadas medições reais nesta implementação.

## Fontes

- `Documentação carona solidaria.pdf`: papéis, grupos, regras de capacidade, aprovação e parentesco; links de protótipos na página 3.
- `link.txt`: texto completo dos critérios de Programação de Aplicativos Mobile, relido após a atualização do usuário.
- `AGENTS.md`: consulta obrigatória à documentação versionada do Expo 57 antes de codificar.
- Paleta inicial em `src/theme/colors.ts`: referência visual preservada.

## Requisitos do PDF

| Requisito | Implementação |
| --- | --- |
| Login restrito a membros WEG | Convite de uso único emitido após verificação manual pelo RH; Spring Security |
| Cadastro/edição, WhatsApp e dias | Primeiro acesso e Perfil |
| Caronas disponíveis e próximas | Busca por bairro/dia; GPS e raio; filtro de vagas na API |
| Solicitar/sair, visualizar participantes | Busca, Minhas caronas e Grupo; acesso aos contatos após confirmação |
| Veículo e formulário do motorista | Meu veículo e Oferecer; aprovação validada novamente no servidor |
| Receber/aceitar/recusar/remover | Tela Grupo; autorização do motorista |
| RH aprovar/reprovar com motivo | Desktop, aba Veículos; reenvio do cadastro mobile |
| Admin cadastrar/gerenciar RH | Desktop, aba Equipe de RH; API exclusiva ADMIN |
| Grupo com ID, veículo, motorista, dias e vagas | Domínio persistido, cartões e detalhes |
| Parentes não contam para o programa | Declaração no pedido e indicador de elegibilidade independente dos assentos |

## Critérios da avaliação

| Critério | Evidência no código / entrega |
| --- | --- |
| API REST: leitura e escrita | `ApiController`, `services/api.ts`, cliente HTTP desktop |
| Persistência local e remota | AsyncStorage para caronas, JPA/H2 ou PostgreSQL para domínio |
| Fluxo offline relevante | Consulta de Minhas caronas e buscas previamente carregadas |
| Atualização/sincronização | Read-through cache, ação Atualizar, retorno do app ao primeiro plano |
| Dois recursos nativos | Geolocalização e compartilhamento de trajeto |
| Permissões concedidas/negadas | `services/native.ts`; busca por bairro sem GPS |
| Navegação | Expo Router: autenticação, abas e detalhes do grupo |
| Interface mobile | Formulários com teclado apropriado, scroll, áreas seguras, alvos de toque, estados |
| Carregamento, erro, vazio e sucesso | Componentes Busy/Notice; estados em cada fluxo |
| Validação | Formulários, Bean Validation, invariantes no serviço e restrições no banco |
| Segurança | Convites, BCrypt, SecureStore, tokens revogáveis, papéis e propriedade de registros |
| Organização do código | Componentes, serviços, hooks, domínio, DTOs, repositórios e módulos Java |
| Metodologia ágil | `KANBAN.md` e critérios de conclusão |
| Planejamento e registro de testes | `TESTES.md`, testes Node e integração Spring |

## Decisões a validar com os responsáveis

- O PDF não define uma regra formal de elegibilidade para estacionamento além do parentesco. O MVP usa ao menos um passageiro não parente confirmado; não reserva uma vaga física.
- Um colaborador mantém um veículo cadastrado; alterações exigem encerrar suas caronas ativas e passar por nova análise.
- Cada grupo descreve um trajeto recorrente semanal. A reserva vale para os dias daquele grupo; não há bilhetes por data individual.
- Homologação do vínculo com a empresa é responsabilidade do RH nesta versão; integração com SSO não foi implementada.
- Aprovação do professor e evidências de uso em dispositivo precisam ser obtidas pela equipe; não são presumidas a partir do código.
