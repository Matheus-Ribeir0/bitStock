# bitStock

Aplicação web em português para gestão de estoque e acompanhamento de computadores em manutenção. Projeto de extensão voltado a uma loja de informática, com melhoria contínua Lean e capacitação da equipe. O escopo acadêmico está em [codex.md](codex.md).

## Executar

Requer Node.js 20.9 ou superior e npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Abra http://localhost:3000. Sem credenciais Firebase, clique em **Explorar demonstração**. A demonstração contém dados fictícios e persiste neste navegador; não representa autenticação nem armazenamento da loja. Para reiniciá-la, remova apenas a chave `bitstock.demo.v1` do localStorage. Não use dados reais nessa modalidade.

## Funcionalidades desta versão

- Painel com indicadores de estoque, validade e ordens de serviço, com acesso às listas filtradas.
- Cadastro, edição, busca e arquivamento de produtos; código único incluindo produtos arquivados.
- Entradas e saídas com saldo previsto, histórico preservado e bloqueio de saldo negativo.
- Validade opcional, com alerta provisório de 30 dias, a validar com a loja; controle por lotes ainda não implementado.
- Ordens de serviço com recebimento, mudanças de situação, entrega e histórico. Equipamentos de clientes não alteram o estoque de venda.
- Interface responsiva, formulários acessíveis e feedback de erro/sucesso.
- Login Firebase por e-mail/senha, autorização administrativa e API com transações e idempotência.

## Configurar acesso real

1. Crie um projeto Firebase e registre uma aplicação web. Preencha as variáveis `NEXT_PUBLIC_FIREBASE_*` de `.env.local` com sua configuração.
2. Ative **Authentication → E-mail/senha** e crie administrativamente as contas iniciais. Não há cadastro público na interface. A autorização de acesso é independente da existência da conta.
3. Crie um banco **Cloud Firestore**. Publique `firestore.rules` pelo console ou com Firebase CLI (`firebase deploy --only firestore:rules --project SEU_PROJECT_ID`). As regras bloqueiam todo acesso direto pelo cliente; a API é a única responsável pelas operações da loja.
4. No console Firestore, crie `users/UID_DA_CONTA` com `authorized: true` (booleano) e `name: "Nome do colaborador"`. Para revogar acesso, altere `authorized` para `false`. Cada requisição verifica essa autorização e a validade/revogação do token.
5. Gere uma chave de conta de serviço e preencha `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` exclusivamente no servidor. A chave pode usar `\n` para quebras de linha. Nunca envie a chave para o GitHub ou use prefixo `NEXT_PUBLIC` nessas variáveis.
6. Reinicie a aplicação. O ambiente real começa vazio; os exemplos da demonstração nunca são enviados ao Firestore.

As operações usam as coleções `products`, `movements`, `serviceOrders`, `users`, `operations` (recibos idempotentes) e `settings/revision`. Datas operacionais são geradas no servidor e exibidas em America/Sao_Paulo; valores monetários são inteiros em centavos. O histórico de situações fica dentro da ordem de serviço nesta versão.

**Decisão para o piloto:** uma transação lê os dados da loja e serializa alterações em `settings/revision`, validando códigos únicos e gravando apenas registros alterados. O recibo associa o UUID da solicitação ao usuário e conteúdo; repetir a mesma solicitação não duplica a movimentação. Essa estratégia prioriza integridade e simplicidade em uma loja pequena, mas carrega todo o histórico em memória. Antes de crescer, implementar paginação, transações específicas por produto, índice `productCodes` e histórico de ordens em subcoleção. Ainda não há atualização em tempo real: recarregue para consultar alterações feitas por outro usuário.

## Verificação

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes de domínio verificam validação de dados, saldo, unicidade, imutabilidade e separação das ordens. Os testes de navegador cobrem os fluxos de demonstração em computador e celular e a rejeição de requisições anônimas à API. A verificação de Firebase autenticado, concorrência e repetição de requisições no banco real depende de um projeto de teste configurado; não considerar esses critérios validados somente pelos testes locais.

## Publicar

Use uma hospedagem com suporte a servidor Node.js e Next.js (a API usa Firebase Admin e não funciona em exportação HTML estática).

```bash
npm ci
npm run build
npm start
```

Configure todas as variáveis no ambiente de hospedagem, habilite HTTPS e inclua o domínio nos domínios autorizados do Firebase Authentication. Variáveis `NEXT_PUBLIC_*` precisam estar disponíveis durante o build. Confira os limites gratuitos dos serviços antes de publicar; não foi contratado nenhum plano pago. A hospedagem e o projeto Firebase reais ainda precisam ser definidos.

## Próximas etapas com a loja

Validar categorias, produtos sujeitos à validade e eventual necessidade de lotes; mapear gargalos antes da implantação; configurar e verificar o Firebase real; capacitar proprietários e atendentes preferencialmente à tarde; comparar tempos de consulta e registro antes/depois sem inventar resultados. Emissão fiscal, caixa, pagamentos, orçamentos e pedidos de venda ficam fora desta versão.
