-- Só leitura. Corra na base de produção ANTES do primeiro `npm run db:migrate` e compare
-- com o DDL legado assumido em server/test/legado-n8n.test.ts.

-- 1) Colunas das tabelas do agente
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name in ('pedidos', 'itens_cardapio')
order by table_name, ordinal_position;

-- 2) Índices (o agente precisa de um índice único parcial em pedidos(chatid) where status = 'rascunho')
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename in ('pedidos', 'itens_cardapio');

-- 3) Constraints e triggers existentes (para não colidirem com os desta migração)
select conrelid::regclass as tabela, conname, pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid in ('pedidos'::regclass, 'itens_cardapio'::regclass);

select event_object_table as tabela, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where event_object_table in ('pedidos', 'itens_cardapio');

-- 4) Estados em uso (o painel só mostra confirmado/em_preparo/pronto/entregue)
select status, count(*) from pedidos group by status order by 2 desc;

-- 5) Tabelas novas que esta migração cria — devem NÃO existir ainda
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('restaurantes', 'usuarios', 'sessoes', 'eventos');
