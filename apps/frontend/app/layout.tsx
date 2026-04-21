import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HueGame",
  description: "Realtime multiplayer browser game for host and mobile players."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
