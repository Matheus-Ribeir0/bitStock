# bitStock

Gestão de estoque e ordens de serviço para uma loja de informática. Aplicação Next.js/TypeScript com Supabase Auth e PostgreSQL, preparada para publicação na Vercel. O contexto extensionista e o escopo estão em [codex.md](codex.md).

## Executar

Requer Node.js 20.9 ou superior.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Abra http://localhost:3000. **Explorar demonstração** usa dados fictícios e salva apenas neste navegador. Não exige Supabase e não grava dados no banco da loja. Para reiniciar, remova somente a chave `bitstock.demo.v1` do localStorage.

## Configurar Supabase

1. Crie um projeto Supabase. No SQL Editor, execute [a migração inicial](supabase/migrations/202611030001_bitstock.sql), uma única vez, em um projeto novo.
2. Copie a Project URL e a chave pública/publishable para `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` em `.env.local`. A chave pública legada `anon` também é compatível nesse campo.
3. Configure `SUPABASE_SECRET_KEY` com a chave secreta do projeto (ou a chave legada `service_role`), exclusivamente no servidor. Nunca use prefixo `NEXT_PUBLIC`, publique essa chave ou a adicione ao Git.
4. Em Authentication, habilite e-mail/senha e crie as contas iniciais pelo painel. Configure a Site URL com a URL da aplicação. Não há cadastro público na interface; desative novos cadastros no provedor após provisionar as contas.
5. Autorize cada colaborador pelo SQL Editor, substituindo UID e nome:

```sql
insert into public.staff (id, name, authorized)
values ('UID_DA_CONTA', 'Nome do colaborador', true)
on conflict (id) do update set name = excluded.name, authorized = true;
```

Para revogar o acesso à loja:

```sql
update public.staff set authorized = false where id = 'UID_DA_CONTA';
```

Todos os colaboradores autorizados possuem as mesmas permissões nesta versão. A existência da conta de autenticação não concede acesso à loja. Dados reais começam vazios; os exemplos da demonstração não são enviados ao Supabase.

## Integridade e arquitetura

- A API verifica o token com `auth.getUser(token)` e consulta a autorização em `staff`.
- Todas as tabelas têm RLS. `anon` e `authenticated` não recebem acesso direto às tabelas nem às funções de persistência. O cliente não consegue editar saldos, históricos ou permissões pela API pública do Supabase.
- Somente a API Next.js, com chave secreta, chama `bitstock_snapshot` e `bitstock_commit`. Essas funções também verificam o usuário autorizado.
- Produtos, movimentações, ordens e eventos ficam em tabelas relacionadas, com chaves estrangeiras e restrições de integridade. Códigos normalizados são únicos, inclusive para produtos arquivados; o saldo não pode ser negativo.
- A gravação bloqueia a revisão compartilhada, verifica o recibo da operação e compara a revisão lida. Em conflito, a API relê e revalida o comando, com limite de tentativas. Saldo, histórico e recibo são persistidos na mesma transação.
- Repetir uma solicitação com o mesmo UUID e conteúdo não duplica a operação. Reutilizar o UUID para outro conteúdo é rejeitado.
- Valores monetários são centavos inteiros e datas de operações são geradas no servidor. Exibição em português do Brasil e fuso America/Sao_Paulo.

**Limite do piloto:** a API lê o histórico completo e envia o estado validado à função transacional. Isso é simples para uma loja pequena, mas precisa evoluir para paginação e comandos específicos por produto antes de crescer. A interface atualiza ao recarregar ou concluir uma operação; não há sincronização em tempo real.

## Funcionalidades

Painel de indicadores; cadastro, edição e arquivamento de produtos; entradas/saídas com saldo previsto e histórico; alertas de validade; ordens de serviço com recebimento, situação, entrega e linha do tempo; interface adaptada para computador e celular.

O alerta de validade usa provisoriamente 30 dias, a validar com a loja. Controle por lotes não foi implementado. Equipamentos de clientes ficam separados do estoque de venda. Não inclui caixa, pagamentos, emissão fiscal ou pedidos de venda.

## Testes

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes de domínio verificam validações e regras de estoque. O teste de banco executa a migração em PostgreSQL local (PGlite), verificando autorização, RLS/privilégios, códigos únicos, saldo negativo, conflito de revisão, idempotência e histórico de ordens. Os testes Playwright cobrem os fluxos da demonstração em computador e celular e a rejeição de chamadas anônimas à API.

A verificação em PGlite não substitui login e operações no projeto Supabase real. Esses testes devem ser feitos após provisionar o projeto e suas credenciais, incluindo concorrência entre sessões independentes e repetição da mesma solicitação.

## Publicar na Vercel

Importe o repositório `Matheus-Ribeir0/bitStock` como projeto Next.js, usando a raiz do repositório. Configure as três variáveis de `.env.example` no ambiente **Production**. A chave secreta deve ser armazenada como variável secreta, nunca exposta ao navegador. `NEXT_PUBLIC_*` precisam estar disponíveis durante o build.

Use outro projeto Supabase para Preview/Development quando houver dados reais em produção. Não forneça credenciais de produção a previews de contribuições não revisadas.

A Vercel compila com `npm run build`. Configure a URL de produção no Supabase Auth. Localmente, a versão compilada pode ser iniciada com:

```bash
npm run build
npm start
```

O plano Hobby da Vercel é restrito a uso pessoal não comercial; a operação comercial da loja exige plano/hospedagem compatível. Supabase Free possui limites e pode pausar por inatividade. Nenhum plano pago deve ser contratado automaticamente.

## Atividades extensionistas

Validar categorias e validades com a loja; mapear desperdícios Lean; capacitar proprietários e atendentes preferencialmente à tarde; medir tempos antes/depois da implantação sem inventar resultados. A configuração do projeto remoto e o teste autenticado são condições para uso real.
