import type { CSSProperties } from "react";

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
}: {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
}) {
  const safe = Math.max(0, Math.min(value, max));
  const percent = max > 0 ? (safe / max) * 100 : 0;
  const style = { "--crz-progress": `${percent}%` } as CSSProperties;

  return (
    <div className="crz-progress-wrap">
      {(label || showValue) && (
        <div className="crz-progress-meta">
          <span>{label}</span>
          {showValue && <strong>{Math.round(percent)}%</strong>}
        </div>
      )}
      <div
        className="crz-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={safe}
        style={style}
      >
        <span />
      </div>
    </div>
  );
}
