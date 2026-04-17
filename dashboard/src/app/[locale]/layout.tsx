import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import Toaster from "@/components/Toaster";
import ConfirmProvider from "@/components/ConfirmDialog";
import SWRegister from "@/components/SWRegister";

export const metadata = {
  manifest: "/manifest.webmanifest",
  themeColor: "#ab3500",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "en" | "ar")) {
    notFound();
  }

  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#ab3500" />
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body className="bg-surface text-on-surface antialiased">
        <NextIntlClientProvider messages={messages}>
          <Toaster>
            <ConfirmProvider>
              <SWRegister />
              {children}
            </ConfirmProvider>
          </Toaster>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
