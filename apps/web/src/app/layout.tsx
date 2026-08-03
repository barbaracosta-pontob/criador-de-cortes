import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ponto B — Cut Creator",
  description: "Descobre os melhores cortes de um vídeo para redes sociais e ads",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
