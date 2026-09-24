import type { Metadata } from "next";
import { Inter, Orbitron, Poppins } from "next/font/google";
import { AuthProvider } from "@/modules/auth/AuthProvider";
import { CartProvider } from "@/modules/cart/CartProvider";
import { PublicInteractionGuard } from "@/core/security/PublicInteractionGuard";
import { ThemeProvider } from "@/core/theme/ThemeProvider";
import { PwaRegister } from "@/core/pwa";
import { GlobalMusicProvider } from "@/core/music/GlobalMusicProvider";
import "@/core/music/styles.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-orbitron",
  weight: ["500", "600", "700", "800"],
});

const poppins = Poppins({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CRAZZY PROJECT",
  description: "Jogos. Pessoas. Cultura. Sempre juntos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${orbitron.variable} ${poppins.variable}`}>
        <PwaRegister />
        <PublicInteractionGuard />
        <ThemeProvider>
          <AuthProvider>
            <GlobalMusicProvider><CartProvider>{children}</CartProvider></GlobalMusicProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
