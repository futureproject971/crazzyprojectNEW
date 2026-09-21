import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "../utils/cn";

type BaseFieldProps = {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
};

export function Input({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: BaseFieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("crz-field", className)} htmlFor={id}>
      {label && <span className="crz-field-label">{label}</span>}
      <input
        id={id}
        className="crz-input"
        aria-invalid={Boolean(error) || undefined}
        {...props}
      />
      {error ? <span className="crz-field-error">{error}</span> : hint ? <span className="crz-field-hint">{hint}</span> : null}
    </label>
  );
}

export function SearchInput({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: BaseFieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("crz-field", className)} htmlFor={id}>
      {label && <span className="crz-field-label">{label}</span>}
      <span className="crz-input-shell">
        <span className="crz-input-shell-icon" aria-hidden="true">⌕</span>
        <input
          id={id}
          type="search"
          className="crz-input"
          aria-invalid={Boolean(error) || undefined}
          {...props}
        />
      </span>
      {error ? <span className="crz-field-error">{error}</span> : hint ? <span className="crz-field-hint">{hint}</span> : null}
    </label>
  );
}

export function Select({
  label,
  hint,
  error,
  className,
  id,
  children,
  ...props
}: BaseFieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={cn("crz-field", className)} htmlFor={id}>
      {label && <span className="crz-field-label">{label}</span>}
      <select id={id} className="crz-select" aria-invalid={Boolean(error) || undefined} {...props}>
        {children}
      </select>
      {error ? <span className="crz-field-error">{error}</span> : hint ? <span className="crz-field-hint">{hint}</span> : null}
    </label>
  );
}
