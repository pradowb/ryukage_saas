# Instruções — Implementar o Ryukage Pulse (painel de pedidos)

> Para o agente/desenvolvedor que vai transformar o mockup em página funcional.
> Arquivo de referência visual: `ryukage-pulse-referencia.html` (anexo) — é o design já aprovado, **não redesenhar**.
> Backend de dados: ver `plano-melhoria-agente-pizzaria.md` (tabelas `pedidos` e `itens_cardapio` no Postgres, servidas por webhooks n8n).

---

## 0. Regra principal

O arquivo `ryukage-pulse-referencia.html` já contém 100% do HTML, CSS e comportamento visual aprovados (cores, tipografia, layout, animações, responsivo). O trabalho aqui é **substituir os dados estáticos por dados reais** vindos do backend, sem alterar a aparência. Se algo neste documento parecer pedir uma mudança visual, ignore — a prioridade é o arquivo de referência.

Não fazer:
- Não trocar cores, fontes, espaçamentos, raio de borda ou a estrutura de grid/kanban.
- Não adicionar bibliotecas de UI externas (o arquivo é HTML/CSS/JS puro — manter assim).
- Não remover o motivo de constelação na barra lateral nem os sparklines dos indicadores — fazem parte da identidade.

---

## 1. View "Pedidos" — dados reais do kanban

**Fonte de dados:** GET `{{URL_WEBHOOK_PEDIDOS}}` — endpoint n8n que consulta:
```sql
select id, itens, valor_total, endereco, tipo_entrega, status, criado_em
from pedidos
where status in ('confirmado','em_preparo','pronto','entregue')
order by criado_em asc;
```

**Formato de cada pedido (JSON):**
```json
{
  "id": 192,
  "itens": [{ "nome": "Calabresa", "qtd": 2, "preco": 9.00 }],
  "valor_total": 24.50,
  "endereco": "Rua de Cedofeita, 118",
  "tipo_entrega": "entrega",
  "status": "confirmado",
  "criado_em": "2026-09-15T18:20:00Z"
}
```

**O que implementar:**
1. Ao carregar a página e a cada **8 segundos** (polling), buscar a lista e re-renderizar os cartões `.order` dentro da coluna `.col[data-status="..."]` correspondente — reaproveitar exatamente a estrutura HTML de um `.order` já existente no arquivo como template.
2. Mapear `status` do backend para a coluna visual: `confirmado` → Confirmado, `em_preparo` → Em preparo, `pronto` → Pronto, `entregue` → Entregue.
3. Atualizar os números em `.col-head .count` e a linha `.board-head .summary` ("X pedidos ativos · Y pronto para entrega") com base na contagem real.
4. `.order .time` ("há 2 min") é calculado no cliente a partir de `criado_em`, recalculado a cada 30s — não vem pronto do backend.
5. `.badge` mostra "Entrega" ou "Retirada" conforme `tipo_entrega`; `.addr` só aparece se `endereco` existir.
6. Adicionar um botão de ação discreto em cada cartão (mesmo estilo do `.badge`, texto muda conforme a coluna atual: "Marcar em preparo" / "Marcar pronto" / "Marcar entregue"). Ao clicar: POST `{{URL_WEBHOOK_STATUS}}` com `{ "id": 192, "novo_status": "em_preparo" }`; em caso de sucesso, refazer o fetch da lista.

---

## 2. View "Cardápio" — dados reais + edição

**Fonte de dados:** GET `{{URL_WEBHOOK_CARDAPIO}}` — consulta `itens_cardapio` agrupado por `categoria`.

**Formato de cada item:**
```json
{ "id": 4, "nome": "Quatro Queijos", "descricao": "Mussarela, provolone, parmesão, gorgonzola", "preco": 13.50, "categoria": "Pizzas", "disponivel": false }
```

**O que implementar:**
1. Renderizar um `.menu-group` por categoria distinta, com os `.menu-row` dentro — reaproveitar a marcação existente.
2. O toggle de disponibilidade já tem a função `toggleAvail()` no JS (atualiza o texto "Disponível"/"Indisponível" na hora). Complementar: no evento `onchange`, disparar PATCH `{{URL_WEBHOOK_CARDAPIO_ITEM}}` com `{ "id": 4, "disponivel": true }`. Se a chamada falhar, reverter o toggle visualmente e mostrar um aviso simples.
3. O botão "+ Novo item" deve abrir um pequeno formulário (nome, descrição, preço, categoria) — pode ser um modal simples usando os mesmos tokens de cor/tipografia do resto da página — que faz POST `{{URL_WEBHOOK_CARDAPIO_NOVO}}` e insere o item na lista sem recarregar a página.

---

## 3. View "Relatórios" — dados agregados

**Fonte de dados:** GET `{{URL_WEBHOOK_RELATORIOS}}` — um node n8n que já devolve os números prontos (não fazer agregação no front-end):
```json
{
  "pedidos_semana": 188,
  "crescimento_pct": 12.4,
  "item_mais_vendido": "Calabresa",
  "pedidos_por_dia": [
    { "dia": "Seg", "valor": 18 }, { "dia": "Ter", "valor": 22 },
    { "dia": "Qua", "valor": 19 }, { "dia": "Qui", "valor": 25 },
    { "dia": "Sex", "valor": 34 }, { "dia": "Sáb", "valor": 41 },
    { "dia": "Dom", "valor": 29 }
  ],
  "top_itens": [
    { "nome": "Calabresa", "pct": 34 }, { "nome": "Frango c/ Catupiry", "pct": 27 },
    { "nome": "Quatro Queijos", "pct": 19 }, { "nome": "Carne Seca", "pct": 12 },
    { "nome": "Extras", "pct": 8 }
  ]
}
```

**O que implementar:**
1. Gerar as barras do SVG dinamicamente a partir de `pedidos_por_dia` (escala proporcional ao maior valor do conjunto) — manter a barra do valor mais alto na cor `--gold` e as demais em `--accent`/`--accent-strong`, como no arquivo de referência.
2. Gerar as linhas `.ti-row` a partir de `top_itens`, com `width` da `.ti-fill` igual ao `pct`.
3. Preencher os três `.stat` do topo com `pedidos_semana`, `crescimento_pct` e `item_mais_vendido`.

---

## 4. O que já funciona e não precisa de backend

- Relógio e data no topo (client-side, `setInterval`, já implementado).
- Indicador "Online" (pode futuramente refletir o estado real da conexão com o n8n — opcional, não bloqueante).
- Navegação entre as 4 views (já implementada em JS puro).

---

## 5. Checklist de entrega

- [ ] Pedidos carregam do backend real e atualizam por polling (8s)
- [ ] Avançar status do pedido funciona e reflete no board
- [ ] Cardápio carrega itens reais; toggle grava no backend
- [ ] "+ Novo item" cria item real
- [ ] Relatórios usam os números agregados do endpoint, não valores fixos
- [ ] Visual permanece idêntico ao arquivo de referência em desktop e em ~400px de largura
- [ ] Nenhuma cor, fonte ou espaçamento foi alterado
