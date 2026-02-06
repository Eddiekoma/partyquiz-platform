import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({ 
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#020617",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: {
    default: "PartyQuiz - Databridge360",
    template: "%s | PartyQuiz - Databridge360",
  },
  description: "Create amazing quizzes with music, video, and minigames. Powered by Databridge360.",
  keywords: ["quiz", "party", "music", "games", "entertainment", "databridge360"],
  authors: [{ name: "Databridge360" }],
  creator: "Databridge360",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className={`${inter.className} bg-[#020617] text-slate-50 antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
