import { AppShell } from "@/core/app-shell";
import { HeroSection } from "@/components/hero/HeroSection";
import { BenefitsBar } from "@/components/hero/BenefitsBar";
import { SocialSection } from "@/sections/SocialSection";
import { FeaturedProductsCarousel } from "@/components/products/FeaturedProductsCarousel";
import { StoreShowcase } from "@/components/categories/StoreShowcase";

export default function Home() {
  return (
    <AppShell mode="visitor" activeNav="home" cartCount={0}>
      <main id="inicio">
        <HeroSection />
        <BenefitsBar />
        <SocialSection />
        <FeaturedProductsCarousel />
        <StoreShowcase />
      </main>
    </AppShell>
  );
}
