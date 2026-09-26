# PurinCash Supplier Engine

## Escopo

O modo `purincash_supplier` permite vender no CRAZZY PROJECT um plano cuja disponibilidade e entrega pertencem a um fornecedor aprovado na PurinCash.

O cliente compra no CRAZZY PROJECT. O frontend nunca recebe a `PURINCASH_API_KEY` e nunca importa o conteúdo real do estoque do fornecedor.

## Fluxo

1. Um admin abre o Product Manager e importa uma ou mais variações do catálogo PurinCash.
2. O plano CRAZZY guarda o vínculo operacional em `private.product_plan_operations`.
3. No checkout, o servidor resolve novamente esse vínculo e grava no snapshot assinado:
   - delivery mode;
   - supplier public product id;
   - store product id;
   - stable variation id;
   - current variation index.
4. Antes de criar a cobrança, a Edge Function relê `/v1/store/products` e confirma que a variação continua disponível.
5. PIX usa `/v1/charges` com `supplier`. Litecoin usa `/v1/payments` com `supplier`.
6. Cartão fica bloqueado para supplier enquanto a API não documentar esse campo em `/v1/card-payments`.
7. Após o pagamento, o conteúdo chega por `deliveredContent` ou é reconciliado por `/v1/deliveries/{paymentId}`.
8. O payload sensível é persistido diretamente em `private.library_delivery_secrets`, vinculado a uma `library_delivery` do comprador.
9. Nenhum `stock_item` falso é criado.

## Segurança

- `PURINCASH_API_KEY` permanece apenas na Edge Function `purincash-payment`.
- O catálogo administrativo é sanitizado antes de chegar ao navegador.
- Produto e variação enviados pela UI são revalidados server-side.
- O preço do checkout vem de `product_plans`, nunca do browser.
- `deliveredContent` não entra em logs, metadata pública ou eventos de pagamento.
- A entrega externa é idempotente por `payment_id + item_index + unit_index`.
- A Biblioteca continua exigindo ownership para revelar o segredo.

## Regras conservadoras da primeira versão

- Uma cobrança supplier contém uma única variação e quantidade 1.
- Supplier não pode ser misturado com outro produto na mesma cobrança.
- Cupom e desconto de revendedor não são aplicados ao supplier.
- Cartão não é aceito para supplier.
- Estoque desconhecido é tratado como indisponível, exceto quando `unlimited=true`.
- Binding com status diferente de `synced` não aparece como disponível no catálogo público.

Essas restrições são intencionais. Devem ser relaxadas somente quando a documentação oficial da PurinCash confirmar suporte explícito ao cenário.

## Product Manager

Um produto pode nascer:

- vazio;
- com presets selecionados;
- abrindo imediatamente o importador PurinCash.

Um produto existente oferece:

- Adicionar plano;
- Criar predefinidos;
- Importar do provedor.

Planos supplier mostram um card de estoque automático com sincronização, troca de vínculo e conversão explícita para estoque próprio.

## Operação

Se o fornecedor reorganizar as variações, a integração tenta reencontrar a variação pelo ID estável e usa o índice atual na cobrança.

Se a PurinCash não fornecer um identificador público inequívoco `prod_...` no catálogo, o admin precisa informar esse ID no importador. O backend valida o formato e continua usando o ID interno do catálogo apenas para localizar/sincronizar o item.

## Arquivos principais

- `src/modules/product-manager/ProductManagerPage.tsx`
- `src/modules/product-manager/SupplierImportModal.tsx`
- `src/app/api/admin/purincash/supplier/route.ts`
- `src/app/api/admin/products/route.ts`
- `supabase/functions/_shared/checkout.ts`
- `supabase/functions/purincash-payment/index.ts`
- `supabase/migrations/20260926210000_purincash_supplier_engine.sql`
- `scripts/test-purincash-supplier.mjs`
