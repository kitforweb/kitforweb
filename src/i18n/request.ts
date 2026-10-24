import { getRequestConfig } from "next-intl/server";
import { withToolMessages } from "./messages";
import { defaultLocale, isLocale } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : defaultLocale;
  const base = (await import(`./messages/${locale}.json`)).default;
  return { locale, messages: withToolMessages(base, locale) };
});
