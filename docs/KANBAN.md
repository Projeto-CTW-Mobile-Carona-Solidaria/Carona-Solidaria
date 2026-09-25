# Kanban — Carona Solidária

Atualizado em 25/09/2026. Política: uma funcionalidade só vai para **Validado** depois da execução dos testes aplicáveis. Código escrito sem execução permanece em **Em validação**.

## Validado

- Política de cache: 7 testes Node executados, cobrindo atualização, falha de rede, primeiro acesso offline, erros de autorização, falha de disco e troca de sessão.
- Leitura dos requisitos do PDF e do texto completo de `link.txt`.

## Em validação

- API Spring: autenticação, convite, perfil, veículos, caronas, participantes e gestão de contas.
- Concorrência da última vaga: teste de integração implementado; aguarda execução com dependências Java.
- Desktop Swing: login, análise de veículos, convites, gestão de RH e consulta dos grupos.
- Mobile: navegação, formulários, API, cache, GPS e compartilhamento.
- Compilação TypeScript, empacotamento Expo e Maven: dependências ainda precisam ser concluídas no ambiente de execução.

## A fazer — evidências e homologação

- Executar o roteiro em Android físico/emulador e registrar capturas, incluindo modo avião e permissão de localização negada.
- Homologar desktop admin/RH e o fluxo completo entre os três clientes.
- Comparar telas com o protótipo Figma e ajustar espaçamentos/identidade com a equipe.
- Obter aprovação da proposta pelo professor e confirmar a regra de vagas especiais com o RH.
- Registrar indicadores reais e discutir melhorias após os testes com usuários.

## Critério de conclusão

Requisito rastreado, implementação revisada, testes relevantes aprovados e evidência de execução anexada. Para fluxos de dispositivo, testes unitários não substituem demonstração em hardware/emulador. Novas falhas entram como cartões com cenário de reprodução, resultado esperado, correção e reteste.
