import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestionale Ordini Arcobaleno",
  description: "Gestione ordini, fornitori e storico prezzi per Pizzeria Arcobaleno",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
