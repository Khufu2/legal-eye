import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";
import "./editorial.css";
import "./polish.css";
import "./consensus.css";
import "./refinement.css";

export const metadata: Metadata = {
  title: "Legal Eye — Legal Intelligence",
  description: "Legal intelligence built from Africa for serious global practice. Research, draft, review and automate complex legal work with verifiable authority.",
  applicationName: "Legal Eye",
  appleWebApp: { capable: true, title: "Legal Eye", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#242426",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
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
      <body className="antialiased">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
