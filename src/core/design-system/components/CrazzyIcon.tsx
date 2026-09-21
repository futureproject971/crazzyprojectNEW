import type { CSSProperties } from "react";
import {
  fallbackIconRegistry,
  neonIconRegistry,
  type FallbackIconName,
  type NeonIconName,
} from "../icons/registry";
import { cn } from "../utils/cn";

type BaseProps = {
  size?: number;
  className?: string;
  label?: string;
};

export function NeonIcon({
  name,
  size = 28,
  className,
  label,
}: BaseProps & { name: NeonIconName }) {
  return (
    <img
      src={neonIconRegistry[name]}
      width={size}
      height={size}
      className={cn("crz-neon-icon", className)}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
    />
  );
}

export function LineIcon({
  name,
  size = 18,
  className,
  label,
}: BaseProps & { name: FallbackIconName }) {
  const style = {
    width: size,
    height: size,
    WebkitMaskImage: `url("${fallbackIconRegistry[name]}")`,
    maskImage: `url("${fallbackIconRegistry[name]}")`,
  } as CSSProperties;

  return (
    <span
      className={cn("crz-line-icon", className)}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
