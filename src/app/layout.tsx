import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { AccentProvider } from "@/providers/accent-provider";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tracker27.ru"),
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
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var a=localStorage.getItem("accent-color");if(a)document.documentElement.setAttribute("data-accent",a)}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AccentProvider>
            <QueryProvider>
              {children}
            </QueryProvider>
            <Toaster />
            <ServiceWorkerRegister />
          </AccentProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
