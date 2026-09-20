import type { CSSProperties } from "react";

export function Avatar({
  src,
  alt = "",
  fallback = "CR",
  size = 36,
}: {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: number;
}) {
  const style = { "--crz-avatar-size": `${size}px` } as CSSProperties;
  return (
    <span className="crz-avatar" style={style} aria-label={alt || undefined}>
      {src ? <img src={src} alt={alt} /> : <span aria-hidden="true">{fallback.slice(0, 2).toUpperCase()}</span>}
    </span>
  );
}
