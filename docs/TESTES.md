# Registro de validação

Atualizado em 02/10/2026.

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| Backend — `mvn test` | 20 testes de integração aprovados, nenhuma falha ou erro |
| Mobile — `npm run typecheck:mobile` na raiz | TypeScript sem erros após o redesign |
| Mobile — `npm run test:mobile` na raiz | 7 testes de política de cache aprovados |
| Android — `npx expo export --platform android --output-dir dist/structure-validation` em `mobile/` | Bundle Hermes e assets exportados após o redesign |
| Web — `npm run test:web` na raiz | 8 testes DOM aprovados após o redesign |
| Web — `npm run build:web` na raiz | TypeScript e build de produção concluídos |

O backend foi validado durante a implementação das aprovações por motorista/RH, dias individuais e separação dos projetos. Não houve alteração de backend na etapa de redesign visual.

### Cobertura de comportamento

- Backend: convite e ativação, autenticação e papéis, validações HTTP, análise de veículo, capacidade, parentesco, duplicidade, remoção, encerramento, concorrência na última vaga, desativação, logout/expiração, filtros de busca, ambas as ordens de aprovação, dias distintos, rollback por falta de vaga, recusa/reentrada e conversão idempotente de dados antigos.
- Web (`web/tests/panel.test.tsx`): acesso de RH e ADMIN, recusa de conta de colaborador com revogação do token, criação de RH, convite, motivo obrigatório na recusa de veículo, aprovação conjunta e vagas por dia, recuperação após falha de rede e expiração de sessão. Usa jsdom e API simulada; abertura/fechamento do diálogo são simulados.
- Mobile: atualização online, leitura offline, 401/403 sem recuperar cache, primeiro acesso sem dados, falha de gravação, troca de sessão durante consulta e isolamento de cache.
- Smoke HTTP adicional: Vite encaminhando `/api` para backend com H2 em memória; autenticação, convite/ativação, veículo, pedido por dias, aprovações conjuntas, capacidade por dia, duplicidade e logout exercitados sem usar o banco persistente do usuário.

## Limites e homologação pendente

Empacotamento Android não equivale a instalação de APK ou execução em aparelho. Testes jsdom não validam CSS/renderização real. O navegador controlável e o dispositivo/emulador não estavam disponíveis nesta sessão.

Roteiro de homologação:

1. Web em larguras 1440, 1024, 768 e 390: navegação, filtros, tabelas com rolagem, diálogos, zoom e conteúdo longo.
2. Teclado: foco visível, link para pular navegação, formulários, tabelas roláveis, abertura/fechamento e retorno de foco dos diálogos.
3. Android/iOS: abas, área segura, teclado, formulários, seleção de dias, botões e leitura por tecnologia assistiva.
4. Fluxo conjunto entre colaborador, motorista e RH, com dias distintos, última vaga e recusa.
5. Modo avião, permissão de localização negada, compartilhamento e abertura de WhatsApp no aparelho.

Registrar capturas e resultados de homologação quando esses ambientes estiverem disponíveis.
