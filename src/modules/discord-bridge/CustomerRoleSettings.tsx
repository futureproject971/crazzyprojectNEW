"use client";
import { useEffect, useState } from "react";

export function CustomerRoleSettings() {
  const [roleId, setRoleId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function load() {
    try {
      const response = await fetch("/api/admin/discord-customer-role", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRoleId(data.role_id || ""); setLoaded(true); setNotice("");
    } catch { setNotice("Não foi possível carregar a configuração do cargo."); }
  }
  useEffect(() => { void load(); }, []);
  async function save() {
    if (busy || !loaded) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/discord-customer-role", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({role_id: roleId}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao salvar.");
      setNotice("Cargo global salvo. O bot sincroniza os clientes com compras confirmadas.");
    } catch(error) { setNotice(error instanceof Error ? error.message : "Falha ao salvar."); }
    finally { setBusy(false); }
  }
  return <section className="crz-customer-role-settings">
    <h2>Cargo Cliente global</h2><p>Uma configuração para toda a loja. Qualquer compra confirmada concede este cargo, além do cargo específico configurado no produto. O cargo Cliente permanece após o vencimento normal do plano.</p>
    <form onSubmit={event => {event.preventDefault(); void save();}}><label>ID do cargo Cliente no Discord<input className="crz-input" value={roleId} disabled={!loaded || busy} inputMode="numeric" pattern="[0-9]{17,20}" onChange={event => setRoleId(event.target.value.trim())} placeholder="ID do cargo Cliente" /></label><button className="crz-button crz-button--primary crz-button--md" disabled={!loaded || busy}>{busy ? "Salvando…" : "Salvar cargo global"}</button></form>
    {loaded && !roleId && <p>Vincule o cargo Cliente para habilitar a concessão global.</p>}
    {notice && <p role="status">{notice}</p>}{!loaded && notice && <button onClick={() => void load()}>Tentar novamente</button>}
    <p><a href="/admin/produtos">Os cargos e tutoriais de cada produto ficam em Produtos → Geral.</a></p>
  </section>;
}
