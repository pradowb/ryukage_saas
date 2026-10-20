# Ryukage Pulse

Painel de pedidos para restaurantes atendidos pelo agente de IA da Ryukage. Mostra os pedidos em tempo real
(kanban), permite gerir o cardápio e apresenta relatórios semanais.

## Stack

| Camada        | Tecnologia                                                       |
| ------------- | ---------------------------------------------------------------- |
| Front-end     | React 19 + TypeScript, compilado com Vite                        |
| API           | Node 22 + Fastify 5 + Zod (validação)                            |
| Base de dados | Postgres, via Drizzle ORM (migrações em `drizzle/`)              |
| Dev / testes  | PGlite (Postgres embutido) — não precisa de instalar Postgres    |
| Tempo real    | Triggers `NOTIFY` no Postgres → Server-Sent Events para o painel |
| Qualidade     | Vitest + Testing Library, ESLint, Prettier, GitHub Actions       |

## Começar

```bash
npm install
cp .env.example .env        # ajuste as senhas do seed
npm run db:seed             # cria o restaurante de demonstração e as contas
npm run dev                 # API em :3847 e painel em http://localhost:5173
```

Sem `DATABASE_URL`, os dados ficam numa base PGlite em `data/pglite` (ignorada pelo git).
Para recomeçar do zero: `npm run db:seed -- --reset`.

### Com Docker (app + Postgres)

```bash
docker compose up --build
docker compose exec app node dist/server/db/seed.js
# http://localhost:3847
```

## Scripts

| Comando               | O que faz                                                         |
| --------------------- | ----------------------------------------------------------------- |
| `npm run dev`         | API (com reload) + Vite em paralelo                               |
| `npm run build`       | Compila o painel (`dist/web`) e a API (`dist/server`)             |
| `npm start`           | Arranca a versão compilada (serve API e painel na mesma porta)    |
| `npm run check`       | typecheck + lint + formatação + testes — o mesmo que o CI         |
| `npm test`            | Testes (API contra PGlite em memória, componentes em jsdom)       |
| `npm run db:generate` | Gera uma migração a partir de alterações em `server/db/schema.ts` |
| `npm run db:migrate`  | Aplica migrações pendentes                                        |
| `npm run db:seed`     | Dados de demonstração                                             |

## Estrutura

```
shared/types.ts          Contratos partilhados entre API e painel (Pedido, ItemCardapio…)
server/
  index.ts               Arranque, LISTEN/NOTIFY, encerramento gracioso
  app.ts                 Montagem do Fastify: segurança, erros, rotas, ficheiros estáticos
  config.ts              Variáveis de ambiente validadas
  plugins/auth.ts        Sessão obrigatória por omissão em /api; papéis (dono/equipe)
  modules/<domínio>/     routes.ts (HTTP + validação) e service.ts (regras + base de dados)
  db/                    schema, cliente (Postgres ou PGlite), migrate, seed
  test/                  Testes de integração da API
web/src/
  views/                 LoginView, Painel
  components/            Kanban, Cardápio, gráficos, UI base
  hooks/                 Dados em tempo real, tema, etc.
  lib/                   Cliente da API, formatação
drizzle/                 Migrações SQL versionadas
docs/                    Especificação original do painel
```

## API

Todas as rotas exigem sessão (cookie `httpOnly`), exceto `POST /api/auth/login` e `GET /api/health`.
Erros seguem sempre o formato `{ "ok": false, "erro": "...", "detalhes"?: [...] }`.

| Método | Rota                      | Notas                                                        |
| ------ | ------------------------- | ------------------------------------------------------------ |
| POST   | `/api/auth/login`         | `{ email, senha }` — limitado a 10 tentativas / 15 min       |
| POST   | `/api/auth/logout`        |                                                              |
| GET    | `/api/auth/sessao`        | Utilizador e restaurante atuais                              |
| GET    | `/api/pedidos`            | Pedidos em curso + entregues nas últimas 12 h                |
| GET    | `/api/pedidos/historico`  | `?pagina=1&limite=20` — entregues, paginado                  |
| PATCH  | `/api/pedidos/:id/status` | `{ novo_status }` — só avança um passo (409/422 se inválido) |
| GET    | `/api/cardapio`           |                                                              |
| POST   | `/api/cardapio`           | Só `dono`                                                    |
| PATCH  | `/api/cardapio/:id`       | `equipe` só pode mudar `disponivel`                          |
| GET    | `/api/relatorios`         | Calculados a partir dos pedidos, no fuso do restaurante      |
| GET    | `/api/eventos`            | Auditoria recente (alimenta as notificações)                 |
| GET    | `/api/eventos/stream`     | SSE: emite `pedidos` / `cardapio` quando algo muda           |

## Multi-restaurante

Cada restaurante (`restaurantes`) tem os seus utilizadores, cardápio e pedidos. Todas as consultas filtram
pelo restaurante da sessão; os testes verificam que um restaurante não vê nem altera dados de outro.

## Integração com o agente n8n

O agente n8n escreve diretamente em `pedidos` e `itens_cardapio` (o painel já não usa webhooks).
As migrações foram feitas para conviver com isso:

- São **aditivas e idempotentes** sobre as tabelas legadas: só acrescentam colunas, chaves, índices e
  triggers; nunca alteram nem apagam colunas existentes.
- `restaurante_id` tem default `1` — os INSERTs atuais do agente continuam a funcionar e caem no
  restaurante principal. Para ter vários restaurantes, o n8n terá de passar a enviar `restaurante_id`.
- O agente usa estados próprios (`rascunho`, pagamento pendente). O painel e os relatórios só consideram
  `confirmado`, `em_preparo`, `pronto` e `entregue`.
- "Novo pedido" (notificação + aviso em tempo real) dispara quando o pedido passa a `confirmado`.
- `server/test/legado-n8n.test.ts` recria as tabelas legadas e corre as queries reais do agente
  (`montar_pedido`, confirmação MB WAY, cardápio) depois das migrações.

### Primeiro deploy na base de produção

1. Faça **backup** da base.
2. Corra `docs/verificar-schema-producao.sql` (só leitura) e confirme que bate com o DDL assumido no teste.
3. `npm run db:migrate` com `DATABASE_URL` de produção.
4. `NODE_ENV=production npm run db:seed` — em produção só cria as contas do painel (sem dados de
   demonstração) e dá nome ao restaurante 1. `--reset` é recusado em produção.

## Segurança

- Senhas com scrypt + sal; tokens de sessão aleatórios guardados apenas como hash SHA-256.
- Cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção; verificação de `Origin` em pedidos que alteram dados.
- Cabeçalhos de segurança e CSP (`@fastify/helmet`); limite de 64 KB no corpo dos pedidos.
- Erros internos nunca expõem detalhes ao cliente; cookies são removidos dos logs.
