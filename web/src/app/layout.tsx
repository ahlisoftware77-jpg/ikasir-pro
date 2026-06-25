import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display, Oswald, Outfit, Caveat, Alfa_Slab_One, Limelight, Prata, Montserrat, Great_Vibes } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import LayoutWrapper from "@/components/LayoutWrapper";
import NavigationGuard from "@/components/NavigationGuard";

const inter = Inter({ subsets: ["latin"] });
const playfair = Playfair_Display({ subsets: ["latin"], variable: '--font-playfair' });
const oswald = Oswald({ subsets: ["latin"], weight: ['700'], variable: '--font-oswald' });
const outfit = Outfit({ subsets: ["latin"], variable: '--font-outfit' });
const caveat = Caveat({ subsets: ["latin"], variable: '--font-caveat' });
const alfaSlabOne = Alfa_Slab_One({ subsets: ["latin"], weight: ['400'], variable: '--font-alfa-slab-one' });
const limelight = Limelight({ subsets: ["latin"], weight: ['400'], variable: '--font-limelight' });
const prata = Prata({ subsets: ["latin"], weight: ['400'], variable: '--font-prata' });
const montserrat = Montserrat({ subsets: ["latin"], weight: ['900'], variable: '--font-montserrat' });
const greatVibes = Great_Vibes({ subsets: ["latin"], weight: ['400'], variable: '--font-great-vibes' });

export const metadata: Metadata = {
  title: "IKASIR PRO - Modern POS Ecosystem",
  description: "Dashboard Web Admin untuk Manajemen IKASIR PRO",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

import { ThemeProvider } from "@/context/ThemeContext";
import { BrandingProvider } from "@/context/BrandingContext";
import BlockingModal from "@/components/BlockingModal";
import { Toaster } from "react-hot-toast";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${inter.className} ${playfair.variable} ${oswald.variable} ${outfit.variable} ${caveat.variable} ${alfaSlabOne.variable} ${limelight.variable} ${prata.variable} ${montserrat.variable} ${greatVibes.variable}`}>
      <body>
        <ThemeProvider>
          <BrandingProvider>
            <AuthProvider>
              <BlockingModal />
              <NavigationGuard />
              <Toaster position="top-right" toastOptions={{ duration: 3000 }} containerStyle={{ zIndex: 99999 }} />
              <LayoutWrapper>
                {children}
              </LayoutWrapper>
            </AuthProvider>
          </BrandingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
