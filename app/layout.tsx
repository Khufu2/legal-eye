import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./editorial.css";
import "./polish.css";
import "./consensus.css";

export const metadata: Metadata = {
  title: "Legal Eye — Legal Intelligence",
  description: "Legal intelligence built from Africa for serious global practice. Research, draft, review and automate complex legal work with verifiable authority.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f8f7",
  colorScheme: "light",
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
