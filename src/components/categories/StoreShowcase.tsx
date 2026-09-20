import { storeCategories } from "@/data/home";
import { NeonSectionIcon } from "@/components/ui/NeonSectionIcon";

function CategoryIcon({ src, tone }: { src: string; tone: string }) {
  return (
    <span
      className={`store-category-icon store-category-icon--${tone}`}
      aria-hidden="true"
      style={{
        WebkitMaskImage: `url("${src}")`,
        maskImage: `url("${src}")`,
      }}
    />
  );
}

export function StoreShowcase() {
  return (
    <section className="store-showcase" id="loja" aria-labelledby="store-title">
      <div className="store-head">
        <div className="store-title-wrap">
          <NeonSectionIcon src="/icons/package.svg" />
          <div>
            <h2 id="store-title">Explore Nossa Loja</h2>
            <p>Tudo que um gamer precisa, em um só lugar.</p>
          </div>
        </div>
        <a href="#loja" className="section-link">Ver todas as categorias →</a>
      </div>

      <div className="store-grid">
        {storeCategories.map((item) => (
          <a href="#produtos" className={`store-card store-card--${item.art}`} key={item.id}>
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
