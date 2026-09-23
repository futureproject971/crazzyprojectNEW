import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { TutorialStudioPage } from "@/modules/tutorial-studio";
export const metadata:Metadata={title:"Tutorial Studio | CRAZZY PROJECT"};
export default function AdminAcademy(){return <AppShell mode="admin" activeNav="academy" showFooter={false}><TutorialStudioPage/></AppShell>}
