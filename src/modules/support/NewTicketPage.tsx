"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  NeonIcon,
  Panel,
} from "@/core/design-system";
import type { ClientHubSnapshot } from "@/modules/client-hub/types";
import type { LibrarySnapshot } from "@/modules/library/types";
import type { SupportCategory } from "./types";
import {
  SUPPORT_FILE_ACCEPT,
  SUPPORT_MAX_FILES_PER_MESSAGE,
  uploadSupportFile,
  validateSupportFile,
} from "./upload";

const categories: Array<{
  id: SupportCategory;
  title: string;
  description: string;
}> = [
  { id: "technical", title: "Deu ruim no produto", description: "Instalação, erro, crash ou alguma coisa fazendo gracinha." },
  { id: "delivery", title: "Entrega", description: "Key, conta, Library ou entrega que não caiu direito." },
  { id: "payment", title: "Pagamento", description: "PIX, cartão, LTC ou cobrança fazendo suspense." },
  { id: "product", title: "Produto", description: "Plano, compatibilidade ou acesso travando teu caminho." },
  { id: "account", title: "Conta", description: "Login, Discord, perfil ou site te segurando do lado de fora." },
  { id: "other", title: "Outro", description: "A treta é outra. Manda a boa." },
];

type ContextOption = {
  value: string;
  label: string;
  detail: string;
};

export function NewTicketPage() {
  const [category, setCategory] = useState<SupportCategory>("technical");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [contextValue, setContextValue] = useState("none");
  const [contextOptions, setContextOptions] = useState<ContextOption[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadContext = async () => {
      try {
        const [hubResponse, libraryResponse] = await Promise.all([
          fetch("/api/client-hub", { cache: "no-store", credentials: "same-origin" }),
          fetch("/api/library", { cache: "no-store", credentials: "same-origin" }),
        ]);

        const options: ContextOption[] = [];

        if (hubResponse.ok) {
          const hub = (await hubResponse.json()) as ClientHubSnapshot;

          for (const entitlement of hub.entitlements) {
            options.push({
              value: "entitlement:" + entitlement.id,
              label: entitlement.productName,
              detail: (entitlement.planName || "Plano CRAZZY") + " • " + entitlement.status,
            });
          }

          for (const order of hub.orders) {
            options.push({
              value: "order:" + order.id,
              label: "Pedido • " + order.productName,
              detail: order.planName + " • " + order.statusLabel,
            });
          }
        }

        if (libraryResponse.ok) {
          const library = (await libraryResponse.json()) as LibrarySnapshot;
          for (const delivery of library.deliveries) {
            options.push({
              value: "library:" + delivery.id,
              label: "Entrega • " + delivery.product.name,
              detail: delivery.deliveryType.toUpperCase() + " • " + delivery.status,
            });
          }
        }

        setContextOptions(options);
      } catch {
        setContextOptions([]);
      }
    };

    void loadContext();
  }, []);

  const selectedContext = useMemo(
    () => contextOptions.find((item) => item.value === contextValue) || null,
    [contextOptions, contextValue]
  );

  const chooseFiles = (selected: FileList | null) => {
    setError("");
    if (!selected) return;

    const next = Array.from(selected).slice(0, SUPPORT_MAX_FILES_PER_MESSAGE);
    for (const file of next) {
      const invalid = validateSupportFile(file);
      if (invalid) {
        setError(invalid);
        return;
      }
    }
    setFiles(next);
  };

  const buildContext = () => {
    if (contextValue === "none") return {};
    const [kind, id] = contextValue.split(":");
    if (!id) return {};
    if (kind === "entitlement") return { entitlement_id: id };
    if (kind === "order") return { order_ticket_id: id };
    if (kind === "library") return { library_delivery_id: id };
    return {};
  };

  const submit = async () => {
    setError("");

    if (subject.trim().length < 4) {
      setError("Bota pelo menos 4 letras pra gente entender o rolê.");
      return;
    }
    if (!message.trim()) {
      setError("Conta o que rolou direito pra gente chegar mais rápido na solução.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subject,
          message,
          context: buildContext(),
        }),
      });

      const created = await response.json();
      if (!response.ok) {
        throw new Error(created?.error || "O ticket não abriu agora.");
      }

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setUploadLabel("Enviando anexo " + (index + 1) + "/" + files.length + " • " + file.name);
        await uploadSupportFile({
          ticketId: created.ticketId,
          messageId: created.messageId,
          file,
        });
      }

      window.location.assign("/tickets/" + created.ticketId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "A abertura tropeçou.");
      setBusy(false);
      setUploadLabel("");
    }
  };

  return (
    <main className="crz-support-page">
      <section className="crz-support-hero">
        <div className="crz-container crz-support-hero__inner">
          <div>
            <small>NOVO TICKET</small>
            <h1>Qual foi a treta?</h1>
            <p>Quanto melhor tu contar, mais rápido a gente mata a charada.</p>
          </div>
          <a className="crz-button crz-button--ghost crz-button--md" href="/tickets">← VOLTAR PROS TICKETS</a>
        </div>
      </section>

      <div className="crz-container crz-support-new-layout">
        <Panel className="crz-support-form-panel">
          <header>
            <div>
              <small>1 • CATEGORIA</small>
              <h2>Escolhe onde pegou fogo</h2>
            </div>
          </header>

          <div className="crz-support-category-grid">
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                className={category === item.id ? "is-active" : ""}
                onClick={() => setCategory(item.id)}
              >
                <NeonIcon name="ticket" size={22} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            ))}
          </div>

          <div className="crz-support-form-section">
            <div>
              <small>2 • CONTEXTO</small>
              <h2>Amarrar com compra ou produto</h2>
            </div>
            <select
              value={contextValue}
              onChange={(event) => setContextValue(event.target.value)}
            >
              <option value="none">Sem ligação específica</option>
              {contextOptions.map((item) => (
                <option value={item.value} key={item.value}>
                  {item.label} — {item.detail}
                </option>
              ))}
            </select>
            {selectedContext && (
              <div className="crz-support-context-preview">
                <NeonIcon name="cube" size={23} />
                <div>
                  <strong>{selectedContext.label}</strong>
                  <span>{selectedContext.detail}</span>
                </div>
                <Badge tone="blue">VINCULADO</Badge>
              </div>
            )}
          </div>

          <div className="crz-support-form-section">
            <div>
              <small>3 • DESCRIÇÃO</small>
              <h2>Manda a história toda</h2>
            </div>

            <label>
              <span>Assunto</span>
              <input
                value={subject}
                maxLength={120}
                placeholder="Ex.: o produto não quer abrir"
                onChange={(event) => setSubject(event.target.value)}
              />
              <small>{subject.length}/120</small>
            </label>

            <label>
              <span>Mensagem</span>
              <textarea
                value={message}
                maxLength={4000}
                rows={8}
                placeholder="Conta o problema, o que tu já tentou e o que apareceu na tela..."
                onChange={(event) => setMessage(event.target.value)}
              />
              <small>{message.length}/4000</small>
            </label>
          </div>

          <div className="crz-support-form-section">
            <div>
              <small>4 • ANEXOS</small>
              <h2>Joga prova na mesa</h2>
            </div>

            <label className="crz-support-file-picker">
              <NeonIcon name="shield" size={28} />
              <strong>PEGAR ARQUIVOS</strong>
              <span>Até 5 por mensagem • 25 MB cada • bucket privado</span>
              <input
                type="file"
                multiple
                accept={SUPPORT_FILE_ACCEPT}
                onChange={(event) => chooseFiles(event.target.files)}
              />
            </label>

            {files.length > 0 && (
              <div className="crz-support-selected-files">
                {files.map((file) => (
                  <article key={file.name + file.lastModified}>
                    <span>📎</span>
                    <div>
                      <strong>{file.name}</strong>
                      <small>{(file.size / 1024 / 1024).toFixed(2)} MB • {file.type}</small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {error && <div className="crz-support-form-error">{error}</div>}

          <Button
            disabled={busy}
            onClick={() => void submit()}
            leadingIcon={<NeonIcon name="ticket" size={19} />}
          >
            {busy ? uploadLabel || "ABRINDO O CORRE..." : "ABRIR TICKET"}
          </Button>
        </Panel>

        <aside className="crz-support-new-aside">
          <Panel className="crz-support-tip">
            <NeonIcon name="shield" size={30} />
            <div>
              <strong>Teus anexos ficam no modo fechado</strong>
              <span>Upload e visualização usam autorização curta. Nada de bucket aberto dando sopa.</span>
            </div>
          </Panel>

          <Panel className="crz-support-tip">
            <NeonIcon name="cube" size={30} />
            <div>
              <strong>Contexto sim, segredo não</strong>
              <span>Pode ligar pedido, acesso ou entrega. O ticket pega a referência, nunca o segredo da Library.</span>
            </div>
          </Panel>
        </aside>
      </div>
    </main>
  );
}
