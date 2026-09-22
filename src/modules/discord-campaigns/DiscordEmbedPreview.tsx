"use client";

import type { ReactNode } from "react";

export type DiscordEmbedDraft = {
  title: string;
  description: string;
  imageUrl: string;
  thumbnailUrl: string;
  linkUrl: string;
  buttonLabel: string;
  footerText: string;
  colorHex: string;
};

function inlineParts(text: string): ReactNode[] {
  const token =
    /(\*\*[^*]+\*\*|\x60[^\n\x60]+\x60|<a?:[A-Za-z0-9_]+:\d+>|<#[0-9]+>|<@!?[0-9]+>|@everyone|@here)/g;
  const parts = text.split(token).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.charCodeAt(0) === 96 && part.charCodeAt(part.length - 1) === 96) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    if (/^<a?:/.test(part)) {
      const name = part.match(/^<a?:([^:]+):/)?.[1] || "emoji";
      return <span key={index} className="crz-discord-preview__emoji">:{name}:</span>;
    }
    if (/^<#[0-9]+>$/.test(part)) {
      return <span key={index} className="crz-discord-preview__mention">#canal</span>;
    }
    if (/^<@!?[0-9]+>$/.test(part)) {
      return <span key={index} className="crz-discord-preview__mention">@usuário</span>;
    }
    if (part === "@everyone" || part === "@here") {
      return <span key={index} className="crz-discord-preview__mention">{part}</span>;
    }
    return part;
  });
}

function renderDescription(value: string) {
  const lines = (value || "Sua mensagem aparecerá aqui.").split("\n");

  return lines.map((line, index) => {
    const match = line.match(/^(#{1,3})\s+(.*)$/);
    if (match) {
      return (
        <div key={index} className={"crz-discord-preview__heading h" + match[1].length}>
          {inlineParts(match[2])}
        </div>
      );
    }

    if (!line) return <div key={index} className="crz-discord-preview__spacer" />;
    return <div key={index}>{inlineParts(line)}</div>;
  });
}

export function DiscordEmbedPreview({ draft }: { draft: DiscordEmbedDraft }) {
  const color = /^#[0-9a-f]{6}$/i.test(draft.colorHex) ? draft.colorHex : "#1687FF";

  return (
    <section className="crz-discord-preview">
      <header>
        <span>PREVIEW AO VIVO</span>
        <b>Como chega na DM</b>
      </header>

      <div className="crz-discord-preview__discord">
        <div className="crz-discord-preview__avatar">
          <img src="/brand/crazzy-logo-hero.png" alt="" />
        </div>

        <div className="crz-discord-preview__message">
          <div className="crz-discord-preview__author">
            <strong>CRAZZY PROJECT</strong>
            <span>BOT</span>
            <small>Hoje às {new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</small>
          </div>

          <article className="crz-discord-preview__embed" style={{ borderLeftColor: color }}>
            <div className="crz-discord-preview__embed-main">
              {draft.title && <h3>{draft.title}</h3>}
              <div className="crz-discord-preview__description">
                {renderDescription(draft.description)}
              </div>
              {draft.imageUrl && (
                <div className="crz-discord-preview__image">
                  <img src={draft.imageUrl} alt="" />
                </div>
              )}
              {draft.footerText && <footer>{draft.footerText}</footer>}
            </div>

            {draft.thumbnailUrl && (
              <div className="crz-discord-preview__thumb">
                <img src={draft.thumbnailUrl} alt="" />
              </div>
            )}
          </article>

          {draft.linkUrl && (
            <div className="crz-discord-preview__actions">
              <span>🔗 {draft.buttonLabel || "Acessar Loja"}</span>
            </div>
          )}
        </div>
      </div>

      <p>
        A prévia imita o visual do Discord. Custom emojis, fontes e alguns detalhes podem variar no cliente real.
      </p>
    </section>
  );
}
