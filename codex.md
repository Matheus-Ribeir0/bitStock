# Gestão de estoque e ordens de serviço para loja de informática

## Contexto e objetivo

Este projeto faz parte de um trabalho de práticas extensionistas da faculdade e será desenvolvido em uma loja de informática e manutenção de computadores. O estabelecimento opera diariamente com fluxo contínuo de clientes e rotina intensa de atendimento.

Atualmente, a loja enfrenta gargalos no controle de estoque, no monitoramento de prazos de validade e nos registros manuais de entrada e saída de computadores, gerando desperdícios e perda de tempo operacional. É necessário distinguir movimentações de produtos do estoque e recebimento/devolução de equipamentos de clientes para manutenção.

A equipe é composta por proprietários e atendentes com rotina atribulada. O período da tarde é o mais propício para realizar o levantamento de processos, a aplicação das atividades e a capacitação.

O estabelecimento não dispõe de recursos financeiros expressivos para investir em sistemas proprietários complexos. A solução deve ser gratuita para a loja, intuitiva e alinhada aos conceitos da Indústria 4.0, contribuindo para reduzir perdas e capacitar os colaboradores no uso de tecnologias emergentes.

A prioridade é entregar uma primeira versão utilizável no menor tempo possível, com navegação clara, dados persistidos e publicação na internet. Evitar complexidade que não contribua diretamente para o uso da loja ou para a apresentação acadêmica.

Este arquivo orienta o desenvolvimento. Ele não representa funcionalidades já implementadas.

## Objetivo geral

Desenvolver e implementar uma solução digital intuitiva de gestão e automação de processos em uma loja de informática e manutenção de computadores, utilizando metodologias de melhoria contínua (Lean) para aumentar a eficiência operacional e capacitar os colaboradores no contexto da Indústria 4.0.

## Objetivos específicos

- Mapear os gargalos e desperdícios operacionais no controle de produtos e ordens de serviço por meio da análise de processos Lean.
- Desenvolver um protótipo funcional de aplicação web/painel de gestão.
- Capacitar o proprietário e os funcionários no uso da ferramenta digital para consulta e automação da rotina de estoque e pedidos.
- Avaliar o impacto da digitalização no tempo de resposta e na organização interna do estabelecimento.

## Justificativa do projeto

A transformação digital promovida pela Indústria 4.0 frequentemente fica restrita a grandes indústrias, deixando micro e pequenos comércios locais à margem da inovação tecnológica. No território estudado, a gestão manual de processos compromete a produtividade e a sustentabilidade financeira de pequenos negócios familiares.

A relevância social do projeto está na democratização da tecnologia, oferecendo uma ferramenta acessível que reduz o tempo desperdiçado e melhora o atendimento. A proposta contribui diretamente para a rotina e a missão do estabelecimento por meio de uma solução gratuita e de fácil utilização.

Sob a perspectiva acadêmica e profissional, o projeto consolida o aprendizado prático de engenharia e tecnologia, métodos Lean e desenvolvimento ágil, exercitando a responsabilidade social do estudante ao impactar diretamente a economia local.

## Público e problema atendido

O sistema será usado pelos proprietários e atendentes que registram produtos, movimentações de estoque e o fluxo de computadores em manutenção.

Problemas que a aplicação deve ajudar a resolver:

- Identificar rapidamente quais produtos estão disponíveis e em qual quantidade.
- Registrar entradas e saídas sem depender de anotações dispersas.
- Localizar produtos pelo nome, código ou categoria.
- Perceber produtos com estoque baixo.
- Consultar o histórico para entender alterações nas quantidades.
- Monitorar prazos de validade dos produtos aos quais esse controle se aplica.
- Acompanhar ordens de serviço e registrar o recebimento e a devolução de computadores de clientes.

## Escopo da primeira versão — MVP

### 1. Acesso ao sistema

- Login com e-mail e senha usando Firebase Authentication.
- Apenas usuários previamente autorizados podem acessar os dados da loja.
- Não oferecer cadastro público na primeira versão.
- Criar as contas iniciais administrativamente. Considerar os usuários autorizados com as mesmas permissões no MVP.
- Permitir sair da conta e apresentar mensagens compreensíveis em caso de falha no login.

### 2. Cadastro e consulta de produtos

- Criar, listar e editar produtos.
- Usar código interno único por produto para evitar cadastros duplicados.
- Buscar por nome ou código e filtrar por categoria e situação do estoque.
- Arquivar produtos sem apagar o histórico. Produtos arquivados não recebem novas movimentações.
- Exibir claramente quantidade atual e estoque mínimo.

Campos do produto:

| Campo | Regra |
| --- | --- |
| Nome | Obrigatório |
| Código interno | Obrigatório e único dentro da loja |
| Categoria | Obrigatória; começar com uma lista simples |
| Marca | Opcional |
| Descrição | Opcional |
| Quantidade atual | Inteiro não negativo, alterado por movimentações |
| Estoque mínimo | Inteiro não negativo; padrão zero |
| Preço de custo | Opcional, em reais |
| Preço de venda | Opcional, em reais |
| Prazo de validade | Opcional, para produtos aos quais se aplica; validar com a loja se existem lotes com datas diferentes |
| Ativo | Indica se o produto está disponível para operação |
| Datas de criação e atualização | Preenchidas pelo sistema |

Categorias iniciais sugeridas: computadores, notebooks, componentes, periféricos, armazenamento, redes, cabos e acessórios. Validar a lista com a loja.

### 3. Movimentações de estoque

- Registrar entradas e saídas com produto, quantidade, motivo, data e usuário responsável.
- Aceitar apenas quantidades inteiras maiores que zero.
- Impedir saídas maiores que o saldo disponível.
- Atualizar saldo e gravar histórico de forma atômica, sem deixar uma operação pela metade.
- Garantir que movimentações simultâneas não produzam saldo incorreto ou negativo.
- Não permitir edição direta do saldo no formulário do produto.
- Se houver saldo inicial no cadastro, registrá-lo como entrada de estoque inicial.
- Não editar nem excluir movimentações concluídas pela interface. Corrigir erros com uma nova movimentação e uma justificativa.

Motivos iniciais: estoque inicial, compra/reposição, venda, devolução, perda/avaria e ajuste de inventário. Registrar venda aqui significa apenas baixar estoque; não inclui pagamento, pedido ou nota fiscal.

### 4. Visão geral

- Mostrar quantidade de produtos ativos cadastrados.
- Mostrar total de unidades em estoque dos produtos ativos.
- Destacar produtos ativos com quantidade menor ou igual ao estoque mínimo, incluindo os sem estoque.
- Exibir as movimentações mais recentes.
- Destacar produtos com validade próxima ou vencida, conforme prazo de alerta definido com a loja.
- Mostrar ordens de serviço em andamento e equipamentos aguardando devolução.

### 5. Histórico

- Listar movimentações com identificação do produto, tipo, quantidade, motivo, data e responsável.
- Permitir consultar movimentações de um produto e filtrar por tipo e período.
- Preservar identificação e código do produto no registro para que alterações posteriores no cadastro não prejudiquem a leitura do histórico.

### 6. Ordens de serviço e fluxo de computadores

- Criar e consultar ordens de serviço com número único, identificação básica do equipamento, problema relatado, data de recebimento e responsável pelo registro.
- Acompanhar situações simples: recebido, em manutenção, aguardando devolução e entregue.
- Registrar mudanças de situação com data e usuário responsável, incluindo a data de saída do computador.
- Manter equipamentos de clientes separados dos produtos disponíveis para venda; recebimento e devolução não alteram o saldo de estoque.
- Usar o número da ordem de serviço como referência no MVP, sem coletar dados pessoais dos clientes.
- Validar o fluxo com os proprietários e atendentes antes da implementação; orçamento, cobrança e pedidos de venda permanecem fora do escopo inicial.

O controle de validade deve ser validado no levantamento: identificar quais produtos possuem vencimento e se há unidades do mesmo produto com datas distintas. Se houver, ajustar o modelo para controlar validade por lote antes de implementar esse fluxo.

## Fora do escopo inicial

- Emissão fiscal, pagamentos, caixa e integração com contabilidade.
- Pedidos de venda, comércio eletrônico e integrações com fornecedores.
- Múltiplas lojas ou depósitos.
- Permissões detalhadas por cargo.
- Controle por número de série ou garantia; controle por lote depende da necessidade identificada para monitorar validades.
- Aplicativo nativo para celular, operação offline e leitura de código de barras.
- Relatórios avançados, previsões e automações externas. Alertas de estoque/validade e atualização automática de saldos fazem parte da solução inicial.

Só adicionar esses recursos se houver necessidade confirmada após a entrega do MVP.

## Stack e organização

- **Next.js com TypeScript:** aplicação web usando App Router.
- **Firebase Authentication:** autenticação por e-mail e senha.
- **Cloud Firestore:** persistência de produtos, usuários autorizados e movimentações.
- **Estilização:** escolher uma solução simples e manter consistência visual; evitar adicionar bibliotecas sem necessidade.
- **Publicação:** escolher uma hospedagem compatível com a arquitetura final do Next.js, considerando facilidade de configuração e uso gratuito. A hospedagem ainda não está definida. Verificar os limites gratuitos dos serviços antes da adoção e não contratar recursos pagos sem autorização.

Preferir uma única aplicação, sem backend separado no início. Organizar telas, componentes, validações e acesso ao Firebase em módulos pequenos. Não adicionar camadas ou abstrações para necessidades futuras.

O estoque pertence à loja, e não à conta individual de quem cadastrou o produto. Todos os usuários autorizados acessam os mesmos dados.

## Modelo de dados inicial

- `users/{uid}`: nome de exibição e indicador de acesso autorizado. Provisionamento administrativo; o usuário não pode conceder acesso a si mesmo.
- `products/{productId}`: dados cadastrais, saldo atual e datas.
- `productCodes/{normalizedCode}`: referência ao produto, para reservar o código e garantir unicidade em uma transação. Definir uma normalização consistente antes de implementar.
- `movements/{movementId}`: produto, nome e código no momento do registro, tipo de entrada/saída, quantidade, saldo anterior, saldo resultante, motivo, observação opcional, usuário e data.
- `serviceOrders/{serviceOrderId}`: número único, identificação do equipamento, problema relatado, situação, datas de recebimento e entrega e usuário responsável.
- `serviceOrders/{serviceOrderId}/events/{eventId}`: histórico de mudanças de situação, com situação anterior, nova situação, usuário e data.

Usar timestamps do servidor. Armazenar valores monetários como inteiros em centavos e apresentá-los em reais. Não apagar documentos de produto usados no histórico.

## Integridade e segurança

- Validar campos obrigatórios, limites e valores tanto na interface quanto na camada que autoriza a gravação.
- Proteger os dados com regras do Firestore; esconder telas ou botões não é controle de acesso.
- Verificar autenticação e autorização em qualquer operação executada no servidor.
- Não publicar regras de teste que liberem leitura ou escrita para qualquer pessoa.
- Antes de implementar movimentações, definir onde a transação será executada. Se ocorrer no cliente, as regras precisam impedir alterações de saldo sem o histórico correspondente. Se ocorrer no servidor, bloquear essas gravações diretas pelo cliente.
- Evitar gravações duplicadas por cliques repetidos; tratar também tentativas repetidas da mesma solicitação na operação de movimentação.
- Manter segredos e credenciais administrativas fora do repositório. Documentar variáveis necessárias em `.env.example`, sem valores sensíveis.
- Usar dados fictícios na demonstração acadêmica. Não coletar dados de clientes da loja no MVP.

## Experiência de uso

- Interface e mensagens em português do Brasil.
- Priorizar uma lista de produtos clara e ações visíveis de entrada e saída.
- Funcionar em computador e celular pelo navegador.
- Usar formulários curtos, rótulos claros, contraste adequado e navegação por teclado.
- Mostrar estados de carregamento, lista vazia, sucesso e erro.
- Confirmar ações de arquivamento e apresentar erros de validação próximos aos campos.
- Desabilitar o envio enquanto uma operação estiver sendo processada.
- Formatar datas e valores para o público brasileiro; definir o fuso da loja para a exibição.

## Ordem sugerida de implementação

1. Mapear os processos atuais com a equipe, preferencialmente à tarde, identificar desperdícios Lean e validar os fluxos de estoque, validade e manutenção.
2. Preparar Next.js, TypeScript, configuração local do Firebase e `.env.example`.
3. Implementar login, autorização dos usuários e proteção dos dados.
4. Criar cadastro, edição, listagem e busca de produtos.
5. Implementar movimentações atômicas, prevenção de duplicidade e histórico.
6. Implementar ordens de serviço e registro de recebimento/devolução de computadores.
7. Adicionar visão geral, indicadores de estoque baixo e alertas de validade.
8. Verificar o fluxo completo, ajustar uso no celular e publicar a aplicação.
9. Capacitar os proprietários e atendentes, registrar evidências e avaliar os resultados com a equipe.

## Critérios de conclusão do MVP

- Um usuário autorizado consegue entrar e sair do sistema.
- Pessoas não autenticadas ou não autorizadas não conseguem ler nem alterar os dados.
- É possível cadastrar um produto e encontrá-lo por nome ou código.
- Códigos duplicados são rejeitados.
- Uma entrada aumenta o saldo e uma saída o reduz, com histórico correto.
- Uma saída sem saldo suficiente é rejeitada sem alterar os dados.
- Operações simultâneas preservam o saldo e o histórico; repetir uma solicitação não duplica a movimentação.
- Produtos no limite mínimo ou abaixo dele aparecem em destaque.
- Produtos com validade informada aparecem nos alertas de vencimento conforme o prazo acordado com a loja.
- É possível registrar e consultar uma ordem de serviço, acompanhar sua situação e registrar a entrega do computador com histórico.
- O recebimento e a devolução de equipamentos de clientes não alteram o estoque de produtos da loja.
- Os dados permanecem disponíveis após atualizar a página e entrar novamente.
- O fluxo principal funciona em computador e celular, na versão publicada.
- O projeto inclui instruções para configurar, executar e publicar.

Verificar especialmente autorização e regras de acesso, unicidade de códigos, consistência das transações e prevenção de estoque negativo. Priorizar testes que comprovem essas regras e uma verificação manual do fluxo completo.

## Entrega acadêmica e extensionista

Além do aplicativo, registrar de forma simples:

- Qual loja ou público foi atendido e qual dificuldade foi identificada.
- Como o responsável participou do levantamento e da validação.
- Quais funcionalidades foram entregues e como ajudam na rotina.
- Evidências de uso e validação, conforme as exigências da faculdade e a autorização dos participantes.
- Um guia curto de acesso, cadastro de produtos e registro de entradas e saídas.
- Um guia de consulta de validades e acompanhamento de ordens de serviço.
- Registro da capacitação dos proprietários e atendentes, preferencialmente no período da tarde.
- Limitações da versão e melhorias sugeridas pelo público atendido.

### Melhoria contínua e avaliação de impacto

- Mapear o processo atual e identificar esperas, retrabalho, registros duplicados e dificuldades de consulta, utilizando a abordagem Lean.
- Levantar uma referência inicial antes do uso da ferramenta e comparar tarefas equivalentes após a implantação.
- Medir, quando viável, tempo de consulta de estoque, tempo de registro de movimentações e tempo para localizar a situação de uma ordem de serviço.
- Registrar divergências de estoque, ocorrências de produtos vencidos e percepção da equipe sobre a organização interna, conforme disponibilidade de dados.
- Realizar ciclos curtos de validação, ajuste e nova avaliação com os colaboradores.
- Apresentar resultados observados e limitações da comparação, sem atribuir melhorias à ferramenta sem evidências.

Não inventar entrevistas, resultados ou validações. Confirmar com a faculdade os requisitos formais da atividade.

## Diretrizes para quem desenvolver

- Entregar primeiro o fluxo completo: login → produto → entrada → saída → consulta do saldo e histórico.
- Resolver decisões pequenas com a alternativa mais simples compatível com estas diretrizes.
- Confirmar mudanças que ampliem significativamente o escopo ou gerem custos.
- Consultar a documentação oficial ao configurar as versões escolhidas e os serviços de publicação.
- Documentar decisões relevantes e comandos de execução no README durante a implementação.
- Não considerar uma funcionalidade concluída apenas porque a tela existe: os dados devem ser persistidos, protegidos e verificados.
