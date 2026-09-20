type Benefit = {
  icon: string;
  title: string;
  subtitle: string;
};

const benefits: Benefit[] = [
  { icon: "/icons/users.svg", title: "+50.000", subtitle: "Clientes satisfeitos" },
  { icon: "/icons/diamond.svg", title: "Produtos Originais", subtitle: "e de procedência" },
  { icon: "/icons/bolt.svg", title: "Entrega Rápida", subtitle: "Receba no seu e-mail" },
  { icon: "/icons/shield-check.svg", title: "Compra Segura", subtitle: "Seus dados protegidos" },
  { icon: "/icons/users.svg", title: "Comunidade Ativa", subtitle: "Gamers do Brasil inteiro" },
];

function BenefitIcon({ src }: { src: string }) {
  return (
    <span
      className="benefit-icon"
      aria-hidden="true"
      style={{
        WebkitMaskImage: `url("${src}")`,
        maskImage: `url("${src}")`,
      }}
    />
  );
}

export function BenefitsBar() {
  return (
    <section className="benefits-bar" aria-label="Benefícios CRAZZY PROJECT">
      <div className="benefits-inner">
        {benefits.map((item) => (
          <div className="benefit-item" key={item.title}>
            <BenefitIcon src={item.icon} />
            <div className="benefit-copy">
              <strong>{item.title}</strong>
              <span>{item.subtitle}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
