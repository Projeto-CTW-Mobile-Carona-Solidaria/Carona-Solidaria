# Kanban — Carona Solidária

Atualizado em 02/10/2026. Política: uma funcionalidade só vai para **Validado** depois da execução dos testes aplicáveis. Testes automatizados não substituem homologação visual e em dispositivo. Evidências em [TESTES.md](TESTES.md).

## Validado

- Política de cache: 7 testes Node executados, cobrindo atualização, falha de rede, primeiro acesso offline, erros de autorização, falha de disco e troca de sessão.
- Leitura dos requisitos do PDF e do texto completo de `link.txt`.
- API: 20 testes de integração aprovados, incluindo concorrência da última vaga, aprovações conjuntas, dias individuais e conversão dos dados antigos.
- Painel web: 8 testes DOM aprovados; build de produção e TypeScript concluídos após o redesign.
- Mobile: TypeScript e exportação Android concluídos após o redesign.
- Separação dos projetos em `mobile/`, `web/` e `backend/`; smoke HTTP do painel via proxy Vite com banco isolado em memória.

## Em validação

- Redesign corporativo implementado: componentes e tokens compartilhados, formulários por seções, tabelas compactas e navegação refinada. Revisão visual em navegador/dispositivo pendente; ver [DESIGN.md](DESIGN.md).
- Mobile em dispositivo: navegação, formulários, cache, GPS e compartilhamento nativo.

## A fazer — evidências e homologação

- Executar o roteiro em Android físico/emulador e registrar capturas, incluindo modo avião e permissão de localização negada.
- Homologar painel web admin/RH e o fluxo completo entre os três clientes.
- Revisar telas com a equipe preservando a identidade atual e o refinamento corporativo solicitado.
- Obter aprovação da proposta pelo professor e confirmar a regra de vagas especiais com o RH.
- Registrar indicadores reais e discutir melhorias após os testes com usuários.

## Critério de conclusão

Requisito rastreado, implementação revisada, testes relevantes aprovados e evidência de execução anexada. Para fluxos de dispositivo, testes unitários não substituem demonstração em hardware/emulador. Novas falhas entram como cartões com cenário de reprodução, resultado esperado, correção e reteste.
