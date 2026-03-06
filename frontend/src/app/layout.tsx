import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finance Ally",
  description: "AI-powered trading workstation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
