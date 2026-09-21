import { Button } from "./Button";

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange?: (page: number) => void;
}) {
  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
    const start = Math.max(1, Math.min(page - 2, Math.max(1, totalPages - 4)));
    return start + index;
  }).filter((value) => value <= totalPages);

  return (
    <nav className="crz-pagination" aria-label="Paginação">
      <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onChange?.(page - 1)}>
        ‹
      </Button>
      {pages.map((value) => (
        <button
          key={value}
          type="button"
          className="crz-page"
          aria-current={value === page ? "page" : undefined}
          onClick={() => onChange?.(value)}
        >
          {value}
        </button>
      ))}
      <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => onChange?.(page + 1)}>
        ›
      </Button>
    </nav>
  );
}
