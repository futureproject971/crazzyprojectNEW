import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { PaymentsManagerPage } from "@/modules/payments-manager";

export const metadata: Metadata = {
  title: "Payments Manager | CRAZZY PROJECT",
  description: "Operação de pagamentos, eventos e reconciliação.",
};

export default function AdminPaymentsRoute() {
  return (
    <AppShell mode="admin" activeNav="payments" showFooter={false}>
      <PaymentsManagerPage />
    </AppShell>
  );
}
