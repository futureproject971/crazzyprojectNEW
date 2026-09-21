import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { ReviewsPage } from "@/modules/reviews";

export const metadata: Metadata = {
  title: "Feedbacks | CRAZZY PROJECT",
  description: "Avaliações verificadas da comunidade CRAZZY PROJECT.",
};

export default function FeedbacksPage() {
  return (
    <AppShell mode="visitor" activeNav="feedbacks">
      <ReviewsPage />
    </AppShell>
  );
}
