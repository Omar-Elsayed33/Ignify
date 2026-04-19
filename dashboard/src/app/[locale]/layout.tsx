import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import Toaster from "@/components/Toaster";
import ConfirmProvider from "@/components/ConfirmDialog";
import SWRegister from "@/components/SWRegister";
import LocaleHtmlAttrs from "@/components/LocaleHtmlAttrs";

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

  return (
    <NextIntlClientProvider messages={messages}>
      <LocaleHtmlAttrs locale={locale} />
      <Toaster>
        <ConfirmProvider>
          <SWRegister />
          {children}
        </ConfirmProvider>
      </Toaster>
    </NextIntlClientProvider>
  );
}
