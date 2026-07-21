# Escopo congelado — FiscalPay

## Permitido no primeiro ciclo

- Consulta contextualizada de `Payable`, resumo, filtros e detalhe.
- Dados da NF-e, fornecedor, alertas fiscais e timeline.
- Reuso de geração por NF-e e validação existentes.
- Baixa manual futura exclusivamente pelos campos existentes `status` e `paidAt`.
- Auditoria de ações futuras e tratamento de isolamento por empresa.

## Proibido no primeiro ciclo

- Aprovação em níveis, boleto, OCR, Pix, pagamento bancário, webhook, Open Finance ou conciliação.
- Conta contábil, centro de custo, CT-e/NFS-e a pagar e lançamento sem NF-e.
- Dados mock, nova tela/componente nesta sprint, endpoint, migration ou alteração de schema.

## ADRs

### ADR-001 — Fronteira financeira

Documentos fiscais são origem; `Payable` representa título/parcela. O FiscalPay não
altera XML. Cancelamento fiscal deve gerar evento financeiro, e múltiplas origens só
serão tratadas após evolução explícita do modelo.

### ADR-002 — Isolamento empresarial

`companyId` é obrigatório em consultas e mutações. Membership decide acesso; ausência
de acesso retorna `403` ou `404`. Jobs e webhooks futuros também exigem contexto.

### ADR-003 — Providers

Não haverá integração bancária direta antes de uma abstração `PaymentProvider`.
Credenciais serão isoladas por empresa; provider real e webhooks ficam para Sprint 11.

### ADR-004 — Idempotência e eventos

Operações críticas terão chave de idempotência. Eventos são imutáveis; repetição não
duplica transição e eventos fora de ordem não podem regredir estado.

### ADR-005 — Segregação de aprovação

Um usuário não executará dois níveis de aprovação; mudanças relevantes invalidarão a
aprovação. Decisões guardarão usuário e versão da política.

### ADR-006 — Limites da IA

IA pode classificar, detectar anomalia e sugerir conta; nunca aprova, cria pagamento
ou executa provider. Toda sugestão será rastreável.

## Arquitetura frontend planejada

Sem criar placeholders, a estrutura futura é `app/financial/fiscal-pay`,
`components/fiscal-pay`, `hooks/fiscal-pay`, `lib/fiscal-pay` e `types/fiscal-pay.ts`.
Telas devem ter skeleton, erro compreensível com retry, estado vazio contextual,
confirmação de ações críticas, toast, prevenção de duplo clique e paginação server-side.

## Riscos

| Risco | Prob. | Impacto | Mitigação | Sprint |
| --- | --- | --- | --- | --- |
| Duplicidade de obrigação | Alta | Crítico | Idempotência e chave única | 01/03 |
| Acesso cruzado | Média | Crítico | `companyId` e testes negativos | 02 |
| Pagamento duplicado | Média | Crítico | Idempotência, lock e provider | 10/11 |
| Webhook falso/fora de ordem | Alta | Crítico | Assinatura e estado monotônico | 10/11 |
| Credencial exposta | Baixa | Crítico | Criptografia e mascaramento | 11/15 |
| IA financeira autônoma | Baixa | Crítico | Limite arquitetural explícito | 17 |
