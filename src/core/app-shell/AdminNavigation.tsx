"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_GROUPS } from "./admin-navigation";

export function AdminNavigation() {
  const pathname = usePathname();
  const current = ADMIN_GROUPS.find(group => group.tools.some(tool => tool.href === pathname)) || ADMIN_GROUPS[0];
  return <div className="crz-admin-navigation">
    <nav className="crz-admin-primary" aria-label="Centrais administrativas">{ADMIN_GROUPS.map(group => <Link key={group.title} href={group.title === "Sistema" ? "/admin/integracoes" : group.tools[0].href} className={group.title === current.title ? "is-active" : ""}>{group.title}</Link>)}</nav>
    <nav className="crz-admin-secondary" aria-label={"Ferramentas de " + current.title}>{current.tools.map(tool => <Link key={tool.href} href={tool.href} aria-current={tool.href === pathname ? "page" : undefined}>{tool.label}</Link>)}<Link href="/admin">Todas as ferramentas</Link></nav>
  </div>;
}
