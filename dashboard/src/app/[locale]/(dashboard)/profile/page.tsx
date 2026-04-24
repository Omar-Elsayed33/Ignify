import { redirect } from "@/i18n/navigation";

export default async function ProfileRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/settings/business-profile", locale });
}
