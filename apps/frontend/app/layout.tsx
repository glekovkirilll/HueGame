import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HueGame",
  description: "Multiplayer browser game control surfaces for host and players."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
