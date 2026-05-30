import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tracker-tau-two-64.vercel.app"),
  title: {
    default: "Life OS — трекер жизни",
    template: "%s | Life OS",
  },
  description: "Персональная система трекинга целей по 10 категориям жизни. Привычки, матрица, прогресс.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Life OS",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Life OS",
    title: "Life OS — трекер жизни",
    description: "Твоя жизнь. Твои правила. Модульная система отслеживания целей и привычек.",
  },
  twitter: {
    card: "summary",
    title: "Life OS — трекер жизни",
    description: "Модульная система отслеживания целей и привычек по 10 категориям.",
  },
  alternates: {
    canonical: "/",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <QueryProvider>
            {children}
          </QueryProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
