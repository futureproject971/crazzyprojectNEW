import type { InputHTMLAttributes, ReactNode } from "react";

export function Checkbox({
  label,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode }) {
  return (
    <label className="crz-checkbox-row">
      <input className="crz-checkbox" type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
