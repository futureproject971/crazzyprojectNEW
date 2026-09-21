import { FeedbackFeed } from "@/components/feedback/FeedbackFeed";
import { GeneralChat } from "@/components/chat/GeneralChat";
import { TicketPanel } from "@/components/tickets/TicketPanel";

export function SocialSection() {
  return (
    <section className="social-section" aria-label="Comunidade CRAZZY PROJECT">
      <FeedbackFeed />
      <GeneralChat />
      <TicketPanel />
    </section>
  );
}
