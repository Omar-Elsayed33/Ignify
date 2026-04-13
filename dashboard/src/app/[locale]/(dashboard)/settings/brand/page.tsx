import { redirect } from "@/i18n/navigation";

export default function BrandRedirectPage({
  params,
}: {
  params: { locale: string };
}) {
  redirect({ href: "/settings/business-profile", locale: params.locale });
}
