import type { Metadata } from "next";
import "./globals.css";
import "./editorial.css";

export const metadata: Metadata = {
  title: "Legal Eye — Legal Intelligence",
  description: "Legal intelligence built from Africa for serious global practice. Research, draft, review and automate complex legal work with verifiable authority.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="codex-preview" content="development" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
