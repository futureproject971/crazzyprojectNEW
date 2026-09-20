import { FloatingNavbar } from "@/components/navigation/FloatingNavbar";
import { HeroSection } from "@/components/hero/HeroSection";
import { BenefitsBar } from "@/components/hero/BenefitsBar";

export default function Home() {
  return (
    <main className="site-shell" id="inicio">
      <FloatingNavbar />
      <HeroSection />
      <BenefitsBar />

      <section className="navbar-stage" aria-label="Próximas seções em construção">
        <div className="navbar-stage-grid" />
      </section>
    </main>
  );
}
