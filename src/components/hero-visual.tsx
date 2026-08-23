import Image from "next/image";

export function HeroVisual({ large = false }: { large?: boolean }) {
  return (
    <div className={`hero-visual${large ? " hero-visual-large" : ""}`} aria-label="Illustration of kotakunp wearing headphones">
      <span className="visual-cross cross-a" aria-hidden="true">+</span>
      <span className="visual-cross cross-b" aria-hidden="true">+</span>
      <span className="visual-dot" aria-hidden="true">·</span>
      <span className="visual-grid grid-a" aria-hidden="true" />
      <div className="visual-data" aria-hidden="true"><b>01</b><i /><i /><i /></div>
      <Image src="/hero-clean.webp" alt="Monochrome character wearing headphones" fill priority sizes="(max-width: 760px) 100vw, 52vw" />
    </div>
  );
}
