"use client";

import { Button, Drawer, NeonIcon } from "@/core/design-system";
import { formatBrl } from "./pricing";
import { useCart } from "./CartProvider";

export function CartDrawer() {
  const {
    items,
    drawerOpen,
    closeCart,
    totals,
    totalQuantity,
    removeItem,
  } = useCart();

  return (
    <Drawer open={drawerOpen} title={"Carrinho • " + totalQuantity + " item(ns)"} onClose={closeCart}>
      <div className="crz-cart-drawer">
        {!items.length ? (
          <div className="crz-cart-drawer__empty">
            <NeonIcon name="cube" size={46} />
            <strong>Seu carrinho está vazio</strong>
            <span>Escolha um produto ou monte um combo CRAZZY.</span>
            <a href="/produtos" onClick={closeCart}>Ver produtos</a>
          </div>
        ) : (
          <>
            <div className="crz-cart-drawer__items">
              {items.map((item) => (
                <article key={item.key} className="crz-cart-mini">
                  <div className="crz-cart-mini__art">
                    {item.image ? <img src={item.image} alt="" /> : <NeonIcon name="cube" size={32} />}
                  </div>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.planName} • {item.durationLabel}</span>
                    <small>{item.price == null ? "Consultar" : formatBrl(item.price)}</small>
                  </div>
                  <button type="button" onClick={() => removeItem(item.key)} aria-label={"Remover " + item.name}>×</button>
                </article>
              ))}
            </div>

            <div className="crz-cart-drawer__combo">
              {totals.comboGroups.filter((group) => group.uniqueProducts >= 2).map((group) => (
                <span key={group.plan}>
                  Combo {group.plan === "30d" ? "Mensal" : "Lifetime"}:
                  <strong> -{group.discountPercent}%</strong>
                </span>
              ))}
            </div>

            <div className="crz-cart-drawer__total">
              <span>Total conhecido</span>
              <strong>{totals.hasUnpricedItems ? "A definir" : formatBrl(totals.knownTotal)}</strong>
            </div>

            <div className="crz-cart-drawer__actions">
              <a className="crz-button crz-button--primary crz-button--md" href="/carrinho" onClick={closeCart}>
                Ver carrinho completo
              </a>
              <a className="crz-button crz-button--secondary crz-button--md" href="/combo" onClick={closeCart}>
                Monte seu combo
              </a>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
