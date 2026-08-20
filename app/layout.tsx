import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ponto — Planning poker sem cerimônia",
  description: "Uma sala, uma senha e estimativas rápidas para o time.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
