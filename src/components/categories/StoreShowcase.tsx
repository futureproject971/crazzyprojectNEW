import { storeCategories } from "@/data/home";
import { NeonSectionIcon } from "@/components/ui/NeonSectionIcon";

function CategoryIcon({ src, tone }: { src: string; tone: string }) {
  return <img className={`store-category-icon store-category-icon--${tone}`} src={src} alt="" aria-hidden="true" />;
}

export function StoreShowcase() {
  return (
    <section className="store-showcase" id="loja" aria-labelledby="store-title">
      <div className="store-head">
        <div className="store-title-wrap">
          <NeonSectionIcon src="/icons/neon-v2/cube.svg" />
          <div>
            <h2 id="store-title">VAI PRO ARSENAL</h2>
            <p>Jogo, conta, ferramenta e umas paradas brabas no mesmo mapa.</p>
          </div>
        </div>
        <a href="/categorias" className="section-link">VER O MAPA TODO →</a>
      </div>

      <div className="store-grid">
        {storeCategories.map((item) => (
          <a href="/produtos" className={`store-card store-card--${item.art}`} key={item.id}>
            <div className="store-card-art" />
            <div className="store-card-footer">
              <CategoryIcon src={item.icon} tone={item.tone} />
              <div>
                <strong>{item.name}</strong>
                <span>{item.subtitle}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
