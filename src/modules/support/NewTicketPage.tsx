"use client";

import { useEffect, useMemo, useState } from "react";\nimport { useSearchParams } from "next/navigation";
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
  { id: "technical", title: "Suporte técnico", description: "Instalação, erro, crash ou funcionamento." },
  { id: "delivery", title: "Entrega", description: "Key, conta, Library ou conteúdo entregue." },
  { id: "payment", title: "Pagamento", description: "PIX, cartão, LTC ou status da cobrança." },
  { id: "product", title: "Produto", description: "Plano, compatibilidade ou acesso." },
  { id: "account", title: "Conta", description: "Login, Discord, perfil ou acesso ao site." },
  { id: "other", title: "Outro", description: "Algo que não se encaixa nas opções acima." },
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
      setError("O assunto precisa ter pelo menos 4 caracteres.");
      return;
    }
    if (!message.trim()) {
      setError("Descreva o que aconteceu para o suporte conseguir te ajudar.");
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
        throw new Error(created?.error || "Não foi possível abrir o ticket.");
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
      setError(submitError instanceof Error ? submitError.message : "Falha ao abrir ticket.");
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
            <h1>Como podemos ajudar?</h1>
            <p>Quanto melhor o contexto, mais rápido o suporte consegue entender o caso.</p>
          </div>
          <a className="crz-button crz-button--ghost crz-button--md" href="/tickets">← Meus tickets</a>
        </div>
      </section>

      <div className="crz-container crz-support-new-layout">
        <Panel className="crz-support-form-panel">
          <header>
            <div>
              <small>1 • CATEGORIA</small>
              <h2>Escolha o assunto principal</h2>
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
              <h2>Vincular compra ou produto</h2>
            </div>
            <select
              value={contextValue}
              onChange={(event) => setContextValue(event.target.value)}
            >
              <option value="none">Sem vínculo específico</option>
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
              <h2>Conte o que aconteceu</h2>
            </div>

            <label>
              <span>Assunto</span>
              <input
                value={subject}
                maxLength={120}
                placeholder="Ex.: Erro ao iniciar o produto"
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
                placeholder="Explique o problema, o que você tentou e o que apareceu na tela..."
                onChange={(event) => setMessage(event.target.value)}
              />
              <small>{message.length}/4000</small>
            </label>
          </div>

          <div className="crz-support-form-section">
            <div>
              <small>4 • ANEXOS</small>
              <h2>Imagem, vídeo, áudio ou arquivo</h2>
            </div>

            <label className="crz-support-file-picker">
              <NeonIcon name="shield" size={28} />
              <strong>Selecionar arquivos</strong>
              <span>Até 5 arquivos por mensagem • 25 MB cada</span>
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
            {busy ? uploadLabel || "Abrindo ticket..." : "Abrir ticket"}
          </Button>
        </Panel>

        <aside className="crz-support-new-aside">
          <Panel className="crz-support-tip">
            <NeonIcon name="shield" size={30} />
            <div>
              <strong>Seus anexos são privados</strong>
              <span>Envie prints, vídeos ou arquivos que ajudem nossa equipe a entender o problema.</span>
            </div>
          </Panel>

          <Panel className="crz-support-tip">
            <NeonIcon name="cube" size={30} />
            <div>
              <strong>Contexto sem expor sua key</strong>
              <span>Escolha um pedido, produto ou entrega para o suporte localizar seu caso mais rápido.</span>
            </div>
          </Panel>
        </aside>
      </div>
    </main>
  );
}
