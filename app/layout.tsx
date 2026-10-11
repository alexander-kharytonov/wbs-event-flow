import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeModeScript } from "@/components/ui/theme-mode-script";
import type { UiLocale } from "@/lib/i18n/locale";
import type { Messages } from "@/lib/i18n/messages";
import { getUiModePreference } from "@/lib/ui-mode-request";
import { LocaleProvider } from "@/providers/locale-provider";
import "./globals.css";
import { NotificationsProvider } from "@/providers/notifications-provider";
import { AppThemeProvider } from "@/providers/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Event Flow",
  description: "Event Flow",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, messages, modePreference] = await Promise.all([
    getLocale(),
    getMessages(),
    getUiModePreference(),
  ]);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeModeScript mode={modePreference.mode} />
        <AppRouterCacheProvider>
          <LocaleProvider
            locale={locale as UiLocale}
            messages={messages as Messages}
            identity={modePreference.identity}
          >
            <AppThemeProvider preference={modePreference}>
              <NotificationsProvider>{children}</NotificationsProvider>
            </AppThemeProvider>
          </LocaleProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
