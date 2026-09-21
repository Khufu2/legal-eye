import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";
import "./workspace.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://legal-eye-six.vercel.app"),
  title: {
    default: "LOCKE — Legal intelligence.",
    template: "%s — LOCKE",
  },
  description: "Legal intelligence for research, drafting, review, comparison, workflows and private firm knowledge — grounded in source evidence.",
  applicationName: "LOCKE",
  appleWebApp: { capable: true, title: "LOCKE", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    siteName: "LOCKE",
    title: "LOCKE",
    description: "Legal intelligence.",
  },
  twitter: {
    card: "summary_large_image",
    title: "LOCKE",
    description: "Legal intelligence.",
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
