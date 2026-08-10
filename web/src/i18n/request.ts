import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requested = cookieStore.get("bb-locale")?.value || routing.defaultLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

