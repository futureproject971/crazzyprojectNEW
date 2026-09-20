import { FloatingNavbar } from "@/components/navigation/FloatingNavbar";
import { HeroSection } from "@/components/hero/HeroSection";
import { BenefitsBar } from "@/components/hero/BenefitsBar";
import { SocialSection } from "@/sections/SocialSection";

export default function Home() {
  return (
    <main className="site-shell" id="inicio">
      <FloatingNavbar />
      <HeroSection />
      <BenefitsBar />
      <SocialSection />
    </main>
  );
}
