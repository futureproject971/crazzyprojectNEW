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
      <SocialSection />
      <FeaturedProductsCarousel />
      <StoreShowcase />
    </main>
  );
}
