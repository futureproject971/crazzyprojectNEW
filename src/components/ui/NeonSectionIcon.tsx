export function NeonSectionIcon({
  src,
  variant = "blue",
}: {
  src: string;
  variant?: "blue" | "pink" | "gold" | "green";
}) {
  return (
    <span
      className={`section-neon-icon section-neon-icon--${variant}`}
      aria-hidden="true"
      style={{
        WebkitMaskImage: `url("${src}")`,
        maskImage: `url("${src}")`,
      }}
    />
  );
}
