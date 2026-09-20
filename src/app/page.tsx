import { FloatingNavbar } from "@/components/navigation/FloatingNavbar";

export default function Home() {
  return (
    <main className="site-shell" id="inicio">
      <FloatingNavbar />
      <section className="navbar-stage" aria-label="Área em construção">
        <div className="navbar-stage-grid" />
      </section>
    </main>
  );
}