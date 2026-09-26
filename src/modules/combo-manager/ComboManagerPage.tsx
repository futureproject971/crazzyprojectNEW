"use client";
import { useCallback, useEffect, useState } from "react";
import { Button, PageHeader } from "@/core/design-system";
import { validComboDiscounts } from "@/core/commerce/policy";

export function ComboManagerPage() {
  const [values, setValues] = useState<string[]>([]);
  const [saved, setSaved] = useState<number[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch("/api/admin/combos", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !validComboDiscounts(data.discounts)) throw new Error(data.error || "Não foi possível carregar os descontos.");
      setSaved(data.discounts); setValues(data.discounts.map(String)); setState("ready");
    } catch (error) { setState("error"); setNotice(error instanceof Error ? error.message : "Falha ao carregar."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const discounts = values.map(value => value.trim() ? Number(value) : NaN);
  const valid = validComboDiscounts(discounts);
  const changed = discounts.some((value, index) => value !== saved[index]);
  async function save() {
    if (!valid || busy) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/combos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ discounts }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao salvar.");
      setSaved(data.discounts); setNotice("Descontos salvos. As novas compras já usam estas faixas.");
      window.dispatchEvent(new Event("crz:combo-rules-updated"));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao salvar."); }
    finally { setBusy(false); }
  }
  return <main className="crz-combo-manager"><div className="crz-container">
    <PageHeader eyebrow="VENDAS • COMBOS" title="Você define o desconto" description="Configure a porcentagem por quantidade de produtos diferentes. As mesmas faixas valem para combos Mensais e Lifetime, calculados separadamente." actions={<a className="crz-button crz-button--secondary crz-button--md" href="/combo">Ver montador →</a>} />
    {state === "loading" && <p role="status">Carregando descontos…</p>}
    {notice && <p role="status">{notice}</p>}
    {state === "error" && <Button onClick={() => void load()}>Tentar novamente</Button>}
    {state === "ready" && <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <div className="crz-combo-manager__tiers">{values.map((value, index) => <label key={index}><span>{index + 2}{index === 5 ? "+" : ""} produtos</span><div><input aria-label={"Desconto para " + (index + 2) + " produtos"} type="number" min="0" max="99" step="1" required value={value} disabled={busy} onChange={event => setValues(current => current.map((item, i) => i === index ? event.target.value : item))} /><b>%</b></div></label>)}</div>
      <p>Use 0% para uma faixa sem desconto. As faixas maiores podem manter ou aumentar a porcentagem, até 99%. Quantidades repetidas do mesmo produto não aumentam a faixa.</p>
      {!valid && <p role="alert">Preencha todas as faixas de 0 a 99, em ordem crescente ou igual.</p>}
      <div className="crz-combo-manager__actions"><Button type="submit" disabled={busy || !valid || !changed}>{busy ? "Salvando…" : "Salvar descontos"}</Button><Button type="button" variant="secondary" disabled={busy || !changed} onClick={() => setValues(saved.map(String))}>Desfazer alterações</Button></div>
      <p>O checkout aplica o maior benefício entre cupom e combo. As porcentagens não se somam.</p>
    </form>}
  </div></main>;
}
