export function NeonSectionIcon({
  src,
  variant = "blue",
}: {
  src: string;
  variant?: "blue" | "pink" | "gold" | "green";
}) {
  return (
    <img
      className={`section-neon-icon section-neon-icon--${variant}`}
      src={src}
      alt=""
      aria-hidden="true"
    />
  );
}
