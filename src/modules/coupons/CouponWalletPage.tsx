"use client";

import { useEffect, useMemo, useState } from "react";
import { NeonIcon, PageHeader } from "@/core/design-system";
import { useCart } from "@/modules/cart/CartProvider";
import type { CustomerCoupon } from "./types";

function originLabel(origin: CustomerCoupon["origin"]) {
  const map: Record<CustomerCoupon["origin"], string> = {
    promotion: "Promoção",
    reward: "Reward",
    wheel: "Roleta",
    scratch: "Raspadinha",
    drop: "Drop",
    admin: "Presente",
    manual: "Manual",
    other: "Especial",
  };
  return map[origin] || "Cupom";
}

function statusLabel(status: CustomerCoupon["status"]) {
  if (status === "available") return "Disponível";
  if (status === "used") return "Utilizado";
  if (status === "expired") return "Expirado";
  return "Inativo";
}

function benefit(coupon: CustomerCoupon) {
  return coupon.discount_type === "percentage"
    ? Number(coupon.discount_value).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "% OFF"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(coupon.discount_value)) + " OFF";
}

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export function CouponWalletPage() {
  const { setCouponCode } = useCart();
  const [coupons, setCoupons] = useState<CustomerCoupon[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | CustomerCoupon["status"]>("all");

  const load = async () => {
    setLoading(true);
    const response = await fetch("/api/coupons", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setNotice(payload?.error || "Não foi possível carregar seus cupons.");
      return;
    }
    setAuthenticated(payload.authenticated === true);
    setCoupons(payload.coupons || []);
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(
    () => filter === "all" ? coupons : coupons.filter((coupon) => coupon.status === filter),
    [coupons, filter]
  );

  const available = coupons.filter((coupon) => coupon.status === "available").length;

  const apply = (coupon: CustomerCoupon) => {
    if (coupon.status !== "available") return;
    setCouponCode(coupon.code);
    setNotice("Cupom " + coupon.code + " aplicado ao carrinho.");
  };

  return (
    <main className="crz-coupons-page">
      <div className="crz-container">
        <PageHeader
          eyebrow="CRAZZY COUPONS"
          title="Meus cupons"
          description="Cupons ganhos em promoções, Rewards, Roleta, Raspadinha e Drops ficam organizados aqui."
          actions={<a className="crz-button crz-button--secondary crz-button--sm" href="/club">Voltar ao CLUB</a>}
        />

        <section className="crz-coupons-summary">
          <div><small>DISPONÍVEIS</small><strong>{available}</strong><span>prontos para usar</span></div>
          <div><small>TOTAL</small><strong>{coupons.length}</strong><span>na sua carteira</span></div>
          <div><small>VALIDAÇÃO</small><strong>SERVER</strong><span>desconto confirmado no checkout</span></div>
        </section>

        {notice && <div className="crz-coupons-notice">{notice}</div>}

        {!authenticated && !loading ? (
          <section className="crz-coupons-empty">
            <NeonIcon name="verified" size={42} />
            <strong>Entre para ver seus cupons</strong>
            <p>Seus cupons pessoais ficam vinculados à sua conta CRAZZY.</p>
            <a className="crz-button crz-button--primary crz-button--md" href="/login">Entrar</a>
          </section>
        ) : (
          <>
            <div className="crz-coupons-filters">
              {(["all","available","used","expired","inactive"] as const).map((item) => (
                <button
                  type="button"
                  key={item}
                  className={filter === item ? "is-active" : ""}
                  onClick={() => setFilter(item)}
                >
                  {item === "all" ? "Todos" : statusLabel(item)}
                </button>
              ))}
              <button type="button" onClick={() => void load()}>↻ Atualizar</button>
            </div>

            {loading ? (
              <section className="crz-coupons-empty"><span className="crz-spinner" /><p>Carregando cupons...</p></section>
            ) : !filtered.length ? (
              <section className="crz-coupons-empty">
                <NeonIcon name="featured" size={38} />
                <strong>Nenhum cupom nesta categoria</strong>
                <p>Ganhe novos cupons no CRAZZY LUCK ou em campanhas especiais.</p>
                <a className="crz-button crz-button--primary crz-button--sm" href="/club/luck">Ir para CRAZZY LUCK</a>
              </section>
            ) : (
              <section className="crz-coupons-grid">
                {filtered.map((coupon) => (
                  <article key={coupon.id} className={"crz-coupon-card is-" + coupon.status}>
                    <div className="crz-coupon-card__cut crz-coupon-card__cut--left" />
                    <div className="crz-coupon-card__cut crz-coupon-card__cut--right" />
                    <header>
                      <span>{originLabel(coupon.origin)}</span>
                      <b>{statusLabel(coupon.status)}</b>
                    </header>

                    <div className="crz-coupon-card__benefit">
                      <strong>{benefit(coupon)}</strong>
                      <code>{coupon.code}</code>
                    </div>

                    <div className="crz-coupon-card__meta">
                      <span>
                        <small>Pedido mínimo</small>
                        <strong>{coupon.min_order_value > 0 ? brl(coupon.min_order_value) : "Sem mínimo"}</strong>
                      </span>
                      <span>
                        <small>Validade</small>
                        <strong>{coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString("pt-BR") : "Sem expiração"}</strong>
                      </span>
                    </div>

                    {coupon.products.length > 0 && (
                      <div className="crz-coupon-card__products">
                        <small>Válido para</small>
                        <span>{coupon.products.map((product) => product.name).join(", ")}</span>
                      </div>
                    )}

                    <footer>
                      <button type="button" onClick={() => navigator.clipboard?.writeText(coupon.code)}>Copiar</button>
                      <button
                        type="button"
                        className="is-primary"
                        disabled={coupon.status !== "available"}
                        onClick={() => apply(coupon)}
                      >
                        {coupon.status === "available" ? "Usar no carrinho" : statusLabel(coupon.status)}
                      </button>
                    </footer>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
