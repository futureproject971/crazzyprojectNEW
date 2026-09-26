import { AppShell } from "@/core/app-shell";
import { ComboManagerPage } from "@/modules/combo-manager/ComboManagerPage";
export const metadata = { title: "Combos e descontos | CRAZZY PROJECT" };
export default function ComboManagerRoute() {
  return <AppShell mode="admin" activeNav="admin-sales" showFooter={false}><ComboManagerPage /></AppShell>;
}
