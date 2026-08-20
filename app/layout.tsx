import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ponto — Planning poker",
  description: "Planning poker com uma sala e senha.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
