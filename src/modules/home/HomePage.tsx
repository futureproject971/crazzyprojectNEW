import { HeroSection } from "@/components/hero/HeroSection";
import { BenefitsBar } from "@/components/hero/BenefitsBar";
import { SocialSection } from "@/sections/SocialSection";
import { FeaturedProductsCarousel } from "@/components/products/FeaturedProductsCarousel";
import { StoreShowcase } from "@/components/categories/StoreShowcase";

export function HomePage() {
  return (
    <main id="inicio" className="crz-home">
      <HeroSection />
      <BenefitsBar />
      <section className="crz-home-shortcuts" aria-label="FREE e prêmios CRAZZY">
        <a className="crz-home-shortcut crz-home-shortcut--free" href="/club/rewards">
          <span className="crz-home-shortcut__icon">⚡</span>
          <span><small>GRÁTIS</small><strong>FREE</strong><em>Testes, campanhas e recompensas sem compra.</em></span>
          <b>ENTRAR →</b>
        </a>
        <a className="crz-home-shortcut crz-home-shortcut--prizes" href="/club/luck">
          <span className="crz-home-shortcut__icon">🎁</span>
          <span><small>CRAZZY CLUB</small><strong>PRÊMIOS</strong><em>Roleta, raspadinha, drops e cupons.</em></span>
          <b>JOGAR →</b>
        </a>
      </section>
      <SocialSection />
      <FeaturedProductsCarousel />
      <StoreShowcase />
    </main>
  );
}
