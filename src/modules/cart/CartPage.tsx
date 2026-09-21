"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  NeonIcon,
  PageHeader,
  Panel,
  Select,
} from "@/core/design-system";
import { getProductDetail } from "@/modules/product-view";
import { CouponQuickPicker } from "@/modules/coupons";
import { formatBrl } from "./pricing";
import { useCart } from "./CartProvider";
import type { CartItem } from "./types";

function ItemArt({ item }: { item: CartItem }) {
  return (
    <div className="crz-cart-item__art">
      {item.image ? (
        <img src={item.image} alt="" />
      ) : (
        <NeonIcon name={item.kind === "account" ? "gamepad" : "cube"} size={42} />
      )}
    </div>
  );
}

function ComboStatus() {
  const { totals } = useCart();
  const groups = totals.comboGroups.filter((group) => group.uniqueProducts > 0);

  return (
    <div className="crz-cart-combo-status">
      <div className="crz-cart-combo-status__title">
        <NeonIcon name="crown" size={28} />
        <div>
          <small>MONTE SEU COMBO</small>
          <strong>Mensal ou Lifetime, até 35% OFF</strong>
        </div>
        <a href="/combo">Montar combo →</a>
      </div>

      <div className="crz-cart-combo-status__grid">
        {(["30d", "lifetime"] as const).map((plan) => {
          const group = totals.comboGroups.find((item) => item.plan === plan)!;
          const label = plan === "30d" ? "Mensal" : "Lifetime";
          const progress = Math.min(100, (group.uniqueProducts / 7) * 100);

          return (
            <div key={plan} className="crz-cart-combo-meter">
              <header>
                <span>{label}</span>
                <strong>
                  {group.discountPercent > 0
                    ? group.discountPercent + "% OFF"
                    : "A partir de 2 produtos"}
                </strong>
              </header>
              <div className="crz-cart-combo-meter__track">
                <i style={{ width: progress + "%" }} />
              </div>
              <footer>
                <span>{group.uniqueProducts} produto(s) diferente(s)</span>
                {group.nextProducts ? (
                  <span>
                    Faltam {group.nextProducts - group.uniqueProducts} para {group.nextDiscountPercent}%
                  </span>
                ) : (
                  <span>Teto máximo atingido 🔥</span>
                )}
              </footer>
            </div>
          );
        })}
      </div>

      {!groups.length && (
        <p>
          O desconto conta apenas produtos diferentes. Quantidade repetida do mesmo produto não
          aumenta a faixa.
        </p>
      )}
    </div>
  );
}

export function CartPage() {
  const {
    items,
    totals,
    couponCode,
    setCouponCode,
    setQuantity,
    changePlan,
    removeItem,
    clearCart,
  } = useCart();
  const [couponSaved, setCouponSaved] = useState(false);

  const checkoutBlocked = !items.length || totals.hasUnpricedItems;

  return (
    <main className="crz-cart-page">
      <section className="crz-cart-hero">
        <div className="crz-container">
          <PageHeader
            eyebrow="CRAZZY CART"
            title="Seu carrinho"
            description="Revise produtos, planos, quantidades, combos e cupons antes do checkout."
            actions={
              items.length ? (
                <Button variant="ghost" onClick={clearCart}>
                  Limpar carrinho
                </Button>
              ) : undefined
            }
          />
        </div>
      </section>

      <div className="crz-container">
        <ComboStatus />

        {!items.length ? (
          <div className="crz-cart-empty">
            <EmptyState
              icon={<NeonIcon name="cube" size={42} />}
              title="Seu carrinho está vazio"
              description="Adicione um produto ou monte um combo Mensal/Lifetime."
              action={
                <div className="crz-cart-empty__actions">
                  <a className="crz-button crz-button--primary crz-button--md" href="/produtos">
                    Ver produtos
                  </a>
                  <a className="crz-button crz-button--secondary crz-button--md" href="/combo">
                    Monte seu combo
                  </a>
                </div>
              }
            />
          </div>
        ) : (
          <div className="crz-cart-layout">
            <section className="crz-cart-items">
              {items.map((item) => {
                const detail = item.slug ? getProductDetail(item.slug) : undefined;
                const availablePlans = detail?.plans ?? [];

                return (
                  <article key={item.key} className="crz-cart-item">
                    <ItemArt item={item} />

                    <div className="crz-cart-item__body">
                      <div className="crz-cart-item__headline">
                        <div>
                          <small>{item.category ?? (item.kind === "account" ? "Conta" : "Produto digital")}</small>
                          <strong>{item.name}</strong>
                          <span>{item.subtitle}</span>
                        </div>
                        {item.planCode === "30d" || item.planCode === "lifetime" ? (
                          <Badge tone="gold">COMBO ELEGÍVEL</Badge>
                        ) : null}
                      </div>

                      <div className="crz-cart-item__controls">
                        {item.kind === "product" && availablePlans.length ? (
                          <label>
                            <span>Plano</span>
                            <Select
                              value={item.planId}
                              onChange={(event) => {
                                const plan = availablePlans.find((candidate) => candidate.id === event.target.value);
                                if (!plan) return;
                                changePlan(item.key, {
                                  planId: plan.id,
                                  planCode: plan.code,
                                  planName: plan.name,
                                  durationLabel: plan.duration,
                                  price: plan.price,
                                  priceLabel: plan.priceLabel,
                                });
                              }}
                            >
                              {availablePlans.map((plan) => (
                                <option key={plan.id} value={plan.id}>
                                  {plan.name} • {plan.duration}
                                </option>
                              ))}
                            </Select>
                          </label>
                        ) : (
                          <div className="crz-cart-item__fixed-plan">
                            <span>Plano</span>
                            <strong>{item.planName}</strong>
                          </div>
                        )}

                        <label className="crz-cart-item__quantity">
                          <span>Quantidade</span>
                          <div>
                            <button
                              type="button"
                              disabled={item.kind === "account" || item.quantity <= 1}
                              onClick={() => setQuantity(item.key, item.quantity - 1)}
                            >
                              −
                            </button>
                            <strong>{item.quantity}</strong>
                            <button
                              type="button"
                              disabled={item.kind === "account" || item.quantity >= 20}
                              onClick={() => setQuantity(item.key, item.quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                        </label>
                      </div>

                      <div className="crz-cart-item__bottom">
                        <div>
                          <span>Valor unitário</span>
                          <strong>{item.price == null ? "Consultar" : formatBrl(item.price)}</strong>
                        </div>
                        <button type="button" onClick={() => removeItem(item.key)}>
                          Remover
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <aside className="crz-cart-summary">
              <Panel className="crz-cart-summary__panel">
                <header>
                  <small>RESUMO</small>
                  <h2>Fechamento do carrinho</h2>
                </header>

                <div className="crz-cart-summary__coupon">
                  <label htmlFor="cart-coupon">Cupom</label>
                  <div>
                    <input
                      id="cart-coupon"
                      value={couponCode}
                      onChange={(event) => {
                        setCouponCode(event.target.value);
                        setCouponSaved(false);
                      }}
                      placeholder="Ex: CRZ10"
                    />
                    <button
                      type="button"
                      disabled={!couponCode}
                      onClick={() => setCouponSaved(Boolean(couponCode))}
                    >
                      {couponSaved ? "Salvo ✓" : "Guardar"}
                    </button>
                  </div>
                  <small>
                    {couponSaved ? "Cupom guardado para o checkout. " : ""}
                    O código fica salvo no carrinho e será validado de forma autoritativa no checkout.
                    Cupom e combo não acumulam: será usado o benefício válido mais vantajoso.
                  </small>
                  <CouponQuickPicker
                    value={couponCode}
                    onSelect={(code) => {
                      setCouponCode(code);
                      setCouponSaved(true);
                    }}
                  />
                </div>

                <div className="crz-cart-summary__lines">
                  <div>
                    <span>Subtotal conhecido</span>
                    <strong>{formatBrl(totals.knownSubtotal)}</strong>
                  </div>

                  {totals.comboGroups
                    .filter((group) => group.discountPercent > 0)
                    .map((group) => (
                      <div key={group.plan} className="is-discount">
                        <span>
                          Combo {group.plan === "30d" ? "Mensal" : "Lifetime"} ({group.discountPercent}%)
                        </span>
                        <strong>
                          {group.discount > 0 ? "− " + formatBrl(group.discount) : "Aplicável"}
                        </strong>
                      </div>
                    ))}

                  <div className="crz-cart-summary__total">
                    <span>Total</span>
                    <strong>
                      {totals.hasUnpricedItems ? "A definir" : formatBrl(totals.knownTotal)}
                    </strong>
                  </div>
                </div>

                {totals.hasUnpricedItems && (
                  <div className="crz-cart-summary__warning">
                    <NeonIcon name="shield" size={25} />
                    <span>
                      Há produto sem preço comercial cadastrado. O carrinho preserva a seleção, mas
                      não inventa valor nem libera checkout.
                    </span>
                  </div>
                )}

                <Button
                  size="lg"
                  disabled={checkoutBlocked}
                  onClick={() => {
                    if (!checkoutBlocked) window.location.assign("/checkout");
                  }}
                  leadingIcon={<NeonIcon name="lightning" size={20} />}
                >
                  {totals.hasUnpricedItems ? "Aguardando preços" : "Ir para checkout"}
                </Button>

                <a href="/produtos">← Continuar comprando</a>
              </Panel>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
