"use client";

import type { AcademyBlock } from "./types";

function str(value: unknown) {
  return typeof value === "string" ? value : "";
}
function num(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function AcademyBlockRenderer({ block }: { block: AcademyBlock }) {
  const c = block.content || {};

  if (block.type === "title") {
    return <h2 className="crz-academy-block-title">{str(c.text)}</h2>;
  }
  if (block.type === "subtitle") {
    return <h3 className="crz-academy-block-subtitle">{str(c.text)}</h3>;
  }
  if (block.type === "text") {
    return <p className="crz-academy-block-text">{str(c.text)}</p>;
  }
  if (block.type === "image") {
    const url = str(c.url);
    return url ? (
      <figure className="crz-academy-block-media">
        <img src={url} alt={str(c.alt)} />
        {str(c.caption) && <figcaption>{str(c.caption)}</figcaption>}
      </figure>
    ) : null;
  }
  if (block.type === "video") {
    const url = str(c.url);
    return url ? (
      <figure className="crz-academy-block-media">
        <video src={url} poster={str(c.poster) || undefined} controls preload="metadata" />
        {str(c.caption) && <figcaption>{str(c.caption)}</figcaption>}
      </figure>
    ) : null;
  }
  if (block.type === "gallery") {
    const items = Array.isArray(c.items) ? c.items : [];
    return (
      <div className="crz-academy-gallery">
        {items.map((item: any, index: number) => (
          <a href={str(item?.url)} target="_blank" rel="noreferrer" key={str(item?.url) + index}>
            <img src={str(item?.url)} alt={str(item?.alt)} />
          </a>
        ))}
      </div>
    );
  }
  if (block.type === "checklist") {
    const items = Array.isArray(c.items) ? c.items : [];
    return (
      <div className="crz-academy-checklist">
        {items.map((item: any, index: number) => (
          <div key={index}>
            <span>✓</span>
            <strong>{typeof item === "string" ? item : str(item?.text)}</strong>
          </div>
        ))}
      </div>
    );
  }
  if (block.type === "shortcut") {
    const keys = Array.isArray(c.keys) ? c.keys : [];
    return (
      <div className="crz-academy-shortcut">
        <span>{str(c.label)}</span>
        <div>{keys.map((key: unknown, index: number) => <kbd key={str(key) + index}>{str(key)}</kbd>)}</div>
      </div>
    );
  }
  if (block.type === "code") {
    return (
      <div className="crz-academy-code">
        <header><span>{str(c.language) || "Código"}</span><button type="button" onClick={() => navigator.clipboard?.writeText(str(c.code))}>Copiar</button></header>
        <pre><code>{str(c.code)}</code></pre>
      </div>
    );
  }
  if (block.type === "file") {
    const url = str(c.url);
    return (
      <a className="crz-academy-file" href={url || "#"} target="_blank" rel="noreferrer">
        <span>↓</span>
        <div><strong>{str(c.name) || "Arquivo"}</strong>{str(c.size) && <small>{str(c.size)}</small>}</div>
      </a>
    );
  }
  if (block.type === "button") {
    const variant = str(c.variant) === "secondary" ? "secondary" : "primary";
    return (
      <a className={"crz-button crz-button--" + variant + " crz-button--md"} href={str(c.url) || "#"}>
        {str(c.label) || "Abrir"}
      </a>
    );
  }
  if (["info","attention","important","success"].includes(block.type)) {
    return (
      <div className={"crz-academy-callout is-" + block.type}>
        <strong>{str(c.title) || block.type.toUpperCase()}</strong>
        <p>{str(c.text)}</p>
      </div>
    );
  }
  if (block.type === "separator") {
    return <hr className="crz-academy-separator" />;
  }
  if (block.type === "step") {
    return (
      <div className="crz-academy-step">
        <b>{num(c.number, block.position + 1)}</b>
        <div><strong>{str(c.title)}</strong><p>{str(c.text)}</p></div>
      </div>
    );
  }

  return null;
}
