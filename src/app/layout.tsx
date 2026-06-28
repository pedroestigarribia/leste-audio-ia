import type { Metadata } from "next";
import { Montserrat } from "next/font/google";

import "@/app/globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Leste Audio IA",
  description: "Transcreva audios do WhatsApp, resuma, organize e copie.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${montserrat.variable} min-h-screen bg-leste-canvas text-slate-950`}>
        {children}
      </body>
    </html>
  );
}
