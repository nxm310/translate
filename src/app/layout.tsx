import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b0f19",
};

export const metadata: Metadata = {
  title: "Traduction Live",
  description: "Traduction vocale en temps réel propulsée par Gemini Live API.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Traduction",
  },
  applicationName: "Traduction",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>{children}</body>
    </html>
  );
}
