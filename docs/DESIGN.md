# Refinamento visual — Carona Solidária

Implementado em 02/10/2026. O refinamento mantém a identidade azul e os fluxos existentes. Esta etapa altera apresentação, agrupamento, navegação visual e acessibilidade; não altera contratos de API, dados, permissões nem regras de aprovação.

## Análise e plano adotado

Foram revisadas as telas de autenticação, busca, minhas caronas, oferta, veículo, perfil e grupo no mobile; login, veículos, colaboradores, grupos/solicitações e equipe de RH no web desktop. A concentração de estilos estava em `mobile/src/components/ui.tsx` e `web/src/panels/desktop.css`, com repetições de cores, links e tratamentos de ações nas telas.

A sequência foi: centralizar tokens; refinar componentes compartilhados; retirar superfícies que apenas envolviam formulários; ajustar a hierarquia das ações por tarefa; organizar desktop e mobile separadamente; executar as verificações de regressão.

## Componentes

- Mobile: `Screen`, `Card`, `Button`, `Field`, `Days`, `Notice`, `Busy` e `RideCard` refinados. `Section`, `FormRow`, `Badge` e `EmptyState` concentram agrupamento e estados. `AppBar` reutilizável substitui o header padrão nas abas; `Icon` reutiliza `expo-symbols`, já instalado.
- Web: estilos compartilhados de botões, campos, selects, badges, tabelas, diálogos, avisos e estados vazios. Sidebar, login, cabeçalho, filtros e detalhes dos grupos usam a mesma escala. Os componentes funcionais, formulários e handlers permanecem nos módulos existentes.

## Tokens

`mobile/src/theme/colors.ts` e `tokens.ts`; `web/src/styles/tokens.css`:

- Azul principal preservado: `#01296F`. Fundo `#F7F8FA`, superfície branca, bordas `#D6DEE8`, texto `#213549` e texto secundário `#526477`.
- Cores semânticas para sucesso, aviso, erro e foco; estados sempre acompanhados por texto.
- Bordas de campos e seletores em `#7D8DA0`, com contraste superior a 3:1 contra branco e contra o fundo da página; separadores estruturais permanecem mais suaves.
- Raios: controles 6, badges 4, cards e modais 8.
- Espaçamento: 4, 8, 12, 16, 20, 24, 32 e 40.
- Títulos: desktop 30, mobile 27; seções 18; corpo 14; labels 13; auxiliares 12.
- Controles: desktop 38; ações pequenas 36; mobile 44; seleção de dias 36 com área de toque vertical ampliada.
- Breakpoints: mobile abaixo de 768; tablet entre 768 e 1024; desktop acima de 1024. Media queries web ficam centralizadas no stylesheet, pois variáveis CSS não substituem limites de media queries.
- Bordas como separação predominante; sombra discreta somente no diálogo web. Transições web de 140 ms para interação, com respeito a movimento reduzido.

## Desktop

Sidebar de 224 px (200 no tablet), ativa com fundo azul moderadamente distinto e indicador lateral de 3 px. Conteúdo alinhado à esquerda, largura máxima de 1480 px, filtros proporcionais e ação de convite à direita. Tabelas preservam estrutura tabular, linhas horizontais, ações compactas e badges pequenos. Diálogos agrupam e-mail e matrícula na mesma linha quando há espaço. Login focado no formulário e nas instruções de acesso.

## Mobile

Padding lateral de 20 px, AppBar de 48 px além da área segura, navegação inferior azul/cinza com ícones de 20 px. Busca e formulários usam a superfície da página. Oferta dividida em trajeto, horário/capacidade, dias e localização. Perfil dividido em dados pessoais, preferências e conta. Situação do veículo em badge, atualização como ação terciária. Cards ficam para unidades independentes: caronas, participantes e confirmação de encerramento.

Foram removidos grandes cartões de formulário, preenchimentos azuis extensos, ações secundárias com peso de CTA, controles de dias em formato pill, estados vazios pontilhados, elementos decorativos de trajeto e destaque branco excessivo da navegação lateral. Nenhuma biblioteca foi adicionada para o redesign.

## Verificação

Consulte [TESTES.md](TESTES.md). Tipos, testes automatizados e empacotamento passaram. A revisão visual em navegador e dispositivo ainda precisa ser feita: a sessão de trabalho não disponibilizou navegador controlável nem emulador/dispositivo. Os testes DOM não validam aparência, leitura por leitor de tela ou layout real.
