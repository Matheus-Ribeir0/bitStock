import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "bitStock · Gestão da loja",
  description:
    "Estoque organizado. Atendimento mais simples. Gestão de produtos e manutenção de computadores.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
