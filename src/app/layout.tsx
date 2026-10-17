import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#07130f" },
  ],
  width: "device-width",
  initialScale: 1,
};

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Emas Bung | Jual Beli Antam",
  description: "Transaksi Emas Antam Aman, COD Jabodetabek.",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/apple-icon.png" },
  openGraph: {
    title: "Emas Bung | Jual Beli Antam",
    description: "Transaksi Emas Antam Aman, COD Jabodetabek.",
    siteName: "Emas Bung",
    locale: "id_ID",
    type: "website",
    images: [{ url: "/icon-512.png", width: 512, height: 512 }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Emas Bung",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={`${manrope.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
