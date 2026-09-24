type Benefit = {
  icon: string;
  title: string;
  subtitle: string;
};

const benefits: Benefit[] = [
  { icon: "/icons/neon-v2/community.svg", title: "Comunidade CRAZZY", subtitle: "Jogue e converse com a galera" },
  { icon: "/icons/neon-v2/diamond.svg", title: "Catálogo Organizado", subtitle: "planos e opções em um só lugar" },
  { icon: "/icons/neon-v2/lightning.svg", title: "Entrega Rápida", subtitle: "Receba no seu e-mail" },
  { icon: "/icons/neon-v2/shield.svg", title: "Compra Segura", subtitle: "Seus dados protegidos" },
  { icon: "/icons/neon-v2/community.svg", title: "Chat da Comunidade", subtitle: "converse direto no site" },
];

export function BenefitsBar() {
  return (
    <section className="benefits-bar" aria-label="Benefícios CRAZZY PROJECT">
      <div className="benefits-inner">
        {benefits.map((item) => (
          <div className="benefit-item" key={item.title}>
            <img className="benefit-icon" src={item.icon} alt="" aria-hidden="true" />
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
