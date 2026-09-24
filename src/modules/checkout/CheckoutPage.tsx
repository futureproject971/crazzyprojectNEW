"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  NeonIcon,
  PageHeader,
  Panel,
} from "@/core/design-system";
import { formatBrl } from "@/modules/cart/pricing";
import { useCart } from "@/modules/cart/CartProvider";
import type {
  CheckoutConfig,
  CheckoutCreateResponse,
  CheckoutMethod,
  CheckoutQuote,
} from "./types";

function cartPayload(items: ReturnType<typeof useCart>["items"]) {
  return items.map((item) => ({
    productId: item.productId,
    planId: item.planId,
    quantity: item.quantity,
    type: item.kind === "account" ? "account" : undefined,
    accountId: item.accountId,
    accountGame: item.accountGame,
    productName: item.name,
    productImage: item.image,
    planName: item.planName,
  }));
}

function methodName(method: CheckoutMethod) {
  if (method === "pix") return "PIX";
  if (method === "card") return "Cartão";
  return "Litecoin";
}

function methodCopy(method: CheckoutMethod) {
  if (method === "pix") return "QR Code + copia e cola. Confirmação automática.";
  if (method === "card") return "Pagamento por cartão em ambiente seguro.";
  return "Pagamento em LTC com valor exato e confirmação pela rede.";
}

function cents(value: number) {
  return formatBrl(value / 100);
}

export function CheckoutPage() {
  const { items, couponCode, clearCart } = useCart();
  const [config, setConfig] = useState<CheckoutConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [method, setMethod] = useState<CheckoutMethod>("pix");
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteState, setQuoteState] = useState<"idle" | "loading" | "auth" | "error">("idle");
  const [quoteError, setQuoteError] = useState("");
  const [creating, setCreating] = useState(false);
  const [payment, setPayment] = useState<CheckoutCreateResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const attemptKey = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/checkout/config", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Falha ao carregar métodos.");
        return payload as CheckoutConfig;
      })
      .then(setConfig)
      .catch((error: Error) => setConfigError(error.message));
  }, []);

  const hasUnpricedItems = items.some((item) => item.price == null);

  useEffect(() => {
    if (!items.length || hasUnpricedItems) {
      setQuote(null);
      return;
    }

    const controller = new AbortController();
    setQuoteState("loading");
    setQuoteError("");

    fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cart_snapshot: cartPayload(items),
        coupon_code: couponCode,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (response.status === 401 || payload?.error === "AUTH_REQUIRED") {
          setQuoteState("auth");
          return null;
        }
        if (!response.ok) throw new Error(payload?.error || "Não foi possível calcular o checkout.");
        return payload as CheckoutQuote;
      })
      .then((payload) => {
        if (!payload) return;
        setQuote(payload);
        setQuoteState("idle");
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        setQuoteState("error");
        setQuoteError(error.message);
      });

    return () => controller.abort();
  }, [items, couponCode, hasUnpricedItems]);

  useEffect(() => {
    if (!payment?.payment_id || method === "card") return;
    if (paymentStatus === "COMPLETED" || paymentStatus === "FAILED" || paymentStatus === "EXPIRED") return;

    const timer = window.setInterval(async () => {
      const response = await fetch(
        "/api/checkout/status?payment_id=" +
          encodeURIComponent(payment.payment_id) +
          "&method=" +
          encodeURIComponent(method),
        { cache: "no-store" }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.status) return;

      setPaymentStatus(payload.status);
      if (payload.status === "COMPLETED") {
        clearCart();
        window.clearInterval(timer);
      }
    }, 3500);

    return () => window.clearInterval(timer);
  }, [payment?.payment_id, method, paymentStatus, clearCart]);

  const selectedMethod = useMemo(
    () => config?.methods.find((item) => item.method === method),
    [config, method]
  );

  const canCreate =
    Boolean(config?.ready) &&
    Boolean(selectedMethod?.enabled) &&
    Boolean(quote?.totalCents) &&
    quoteState === "idle" &&
    !hasUnpricedItems &&
    !creating;

  const createPayment = async () => {
    if (!canCreate) return;

    if (!attemptKey.current) {
      attemptKey.current = "checkout:" + crypto.randomUUID();
    }

    setCreating(true);
    setPaymentError("");

    try {
      const response = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          cart_snapshot: cartPayload(items),
          coupon_code: couponCode,
          idempotency_key: attemptKey.current,
        }),
      });
      const payload = await response.json();

      if (response.status === 401 || payload?.error === "AUTH_REQUIRED") {
        setQuoteState("auth");
        throw new Error("Entre na sua conta para continuar.");
      }
      if (!response.ok) {
        if (response.status === 409) attemptKey.current = null;
        throw new Error(payload?.error || "Não foi possível iniciar o pagamento.");
      }

      setPayment(payload as CheckoutCreateResponse);
      setPaymentStatus("ACTIVE");

      if (method === "card" && payload.paymentUrl) {
        window.location.assign(payload.paymentUrl);
      }
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Erro ao iniciar pagamento.");
    } finally {
      setCreating(false);
    }
  };

  const resetAttempt = () => {
    attemptKey.current = null;
    setPayment(null);
    setPaymentStatus(null);
    setPaymentError("");
  };

  if (!items.length) {
    return (
      <main className="crz-checkout-page">
        <div className="crz-container crz-checkout-empty">
          <EmptyState
            icon={<NeonIcon name="cube" size={42} />}
            title="Seu carrinho está vazio"
            description="Adicione produtos antes de abrir o checkout."
            action={<a className="crz-button crz-button--primary crz-button--md" href="/produtos">Ver produtos</a>}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="crz-checkout-page">
      <section className="crz-checkout-hero">
        <div className="crz-container">
          <PageHeader
            eyebrow="CRAZZY CHECKOUT"
            title="Finalizar compra"
            description="Revise seu pedido, escolha a forma de pagamento e finalize com segurança."
            actions={<Badge tone="green">CHECKOUT PROTEGIDO</Badge>}
          />
        </div>
      </section>

      <div className="crz-container crz-checkout-layout">
        <section className="crz-checkout-main">
          <Panel className="crz-checkout-panel">
            <header className="crz-checkout-section-title">
              <NeonIcon name="shield" size={27} />
              <div>
                <small>MÉTODO DE PAGAMENTO</small>
                <h2>Como você quer pagar?</h2>
              </div>
            </header>

            {configError ? (
              <ErrorState
                title="Não foi possível carregar pagamentos"
                description={configError}
                onRetry={() => window.location.reload()}
              />
            ) : !config ? (
              <LoadingState label="Consultando métodos disponíveis..." />
            ) : (
              <div className="crz-checkout-methods">
                {(["pix", "card", "crypto"] as CheckoutMethod[]).map((id) => {
                  const setting = config.methods.find((item) => item.method === id);
                  const enabled = Boolean(config.ready && setting?.enabled && (id !== "card" || config.cardGate));
                  return (
                    <button
                      key={id}
                      type="button"
                      className={(method === id ? "is-active " : "") + (!enabled ? "is-disabled" : "")}
                      onClick={() => {
                        setMethod(id);
                        resetAttempt();
                      }}
                      aria-pressed={method === id}
                    >
                      <NeonIcon name={id === "card" ? "verified" : id === "pix" ? "lightning" : "cube"} size={28} />
                      <span>
                        <strong>{methodName(id)}</strong>
                        <small>{methodCopy(id)}</small>
                      </span>
                      <em>{enabled ? "Disponível" : "Configuração pendente"}</em>
                    </button>
                  );
                })}
              </div>
            )}

            {!config?.ready && config && (
              <div className="crz-checkout-notice">
                <NeonIcon name="shield" size={26} />
                <div>
                  <strong>Gateway preparado, ativação pendente</strong>
                  <span>Este método de pagamento está temporariamente indisponível. Escolha outra opção ou tente novamente mais tarde.</span>
                </div>
              </div>
            )}

            {quoteState === "auth" && (
              <div className="crz-checkout-auth-gate">
                <NeonIcon name="verified" size={30} />
                <div>
                  <strong>Login necessário</strong>
                  <span>Entre na sua conta para continuar com a compra.</span>
                </div>
                <a className="crz-button crz-button--primary crz-button--sm" href="/login">Entrar</a>
              </div>
            )}

            {quoteState === "error" && (
              <div className="crz-checkout-inline-error">{quoteError}</div>
            )}
          </Panel>

          {payment && method === "pix" && payment.charge && (
            <Panel className="crz-checkout-payment-box">
              <header>
                <Badge tone="blue">PIX GERADO</Badge>
                <strong>Aguardando pagamento</strong>
              </header>
              {payment.charge.qrCodeImage && (
                <img className="crz-checkout-qr" src={payment.charge.qrCodeImage} alt="QR Code PIX" />
              )}
              <label>
                <span>PIX copia e cola</span>
                <textarea readOnly value={payment.charge.brCode} />
              </label>
              <Button
                variant="secondary"
                onClick={() => navigator.clipboard.writeText(payment.charge?.brCode || "")}
              >
                Copiar código PIX
              </Button>
              <small>O produto é liberado após a confirmação do pagamento.</small>
            </Panel>
          )}

          {payment && method === "crypto" && payment.crypto && (
            <Panel className="crz-checkout-payment-box">
              <header>
                <Badge tone="gold">LITECOIN</Badge>
                <strong>Aguardando confirmações da rede</strong>
              </header>
              <div className="crz-checkout-ltc-amount">
                <small>ENVIE EXATAMENTE</small>
                <strong>{payment.crypto.payAmount} LTC</strong>
                <span>Não arredonde o valor.</span>
              </div>
              <label>
                <span>Endereço Litecoin</span>
                <textarea readOnly value={payment.crypto.address} />
              </label>
              <Button
                variant="secondary"
                onClick={() => navigator.clipboard.writeText(payment.crypto?.address || "")}
              >
                Copiar endereço
              </Button>
            </Panel>
          )}

          {payment && paymentStatus && method !== "card" && (
            <div className={"crz-checkout-status is-" + paymentStatus.toLowerCase()}>
              <i />
              <span>Status: <strong>{paymentStatus}</strong></span>
            </div>
          )}

          {paymentError && <div className="crz-checkout-inline-error">{paymentError}</div>}
        </section>

        <aside className="crz-checkout-summary">
          <Panel className="crz-checkout-summary__panel">
            <header>
              <small>SEU PEDIDO</small>
              <h2>Resumo final</h2>
            </header>

            <div className="crz-checkout-summary__items">
              {items.map((item) => (
                <div key={item.key}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.planName} × {item.quantity}</small>
                  </span>
                  <b>{item.price == null ? "A definir" : formatBrl(item.price * item.quantity)}</b>
                </div>
              ))}
            </div>

            {hasUnpricedItems ? (
              <div className="crz-checkout-blocker">
                <NeonIcon name="shield" size={24} />
                <span>Existem itens sem preço autoritativo. A cobrança fica bloqueada.</span>
              </div>
            ) : quoteState === "loading" ? (
              <LoadingState label="Atualizando seu pedido..." />
            ) : quote ? (
              <div className="crz-checkout-totals">
                <div><span>Subtotal</span><strong>{cents(quote.subtotalCents)}</strong></div>
                <div className="is-discount">
                  <span>
                    Desconto {quote.discountSource === "combo" ? "Combo" : quote.discountSource === "coupon" ? "Cupom" : ""}
                  </span>
                  <strong>− {cents(quote.discountCents)}</strong>
                </div>
                <div className="is-total"><span>Total</span><strong>{cents(quote.totalCents)}</strong></div>
              </div>
            ) : null}

            {couponCode && (
              <div className="crz-checkout-coupon">
                <span>Cupom informado</span>
                <strong>{couponCode}</strong>
                <small>Combo e cupom não acumulam. O melhor benefício disponível será aplicado.</small>
              </div>
            )}

            <Button
              size="lg"
              disabled={!canCreate}
              onClick={createPayment}
              leadingIcon={<NeonIcon name="lightning" size={20} />}
            >
              {creating ? "Criando cobrança..." : selectedMethod?.enabled ? "Gerar pagamento" : "Método indisponível"}
            </Button>

            <div className="crz-checkout-security">
              <NeonIcon name="shield" size={22} />
              <span>Pagamento protegido e acompanhamento do pedido no seu perfil.</span>
            </div>

            <a href="/carrinho">← Voltar ao carrinho</a>
          </Panel>
        </aside>
      </div>
    </main>
  );
}
