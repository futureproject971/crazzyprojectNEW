import { FloatingNavbar } from "@/components/navigation/FloatingNavbar";
import { HeroSection } from "@/components/hero/HeroSection";
import { BenefitsBar } from "@/components/hero/BenefitsBar";
import { SocialSection } from "@/sections/SocialSection";
import { FeaturedProductsCarousel } from "@/components/products/FeaturedProductsCarousel";
import { StoreShowcase } from "@/components/categories/StoreShowcase";
import { Footer } from "@/components/layout/Footer";

export default function Home() {
  return (
    <main className="site-shell" id="inicio">
      <FloatingNavbar />
      <HeroSection />
      <BenefitsBar />
      <SocialSection />
      <FeaturedProductsCarousel />
      <StoreShowcase />
      <Footer />
    </main>
  );
}
