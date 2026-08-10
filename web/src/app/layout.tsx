import type { Metadata } from "next";
import { getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { cookies } from "next/headers";
import { Fraunces, Inter, JetBrains_Mono, Noto_Nastaliq_Urdu } from "next/font/google";
import { Themes } from "@/components/theme";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const nastaliq = Noto_Nastaliq_Urdu({
  variable: "--font-nastaliq",
  subsets: ["arabic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bachat Book",
  description: "Premium personal finance for Pakistan.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("bb-locale")?.value || "en";
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      dir="ltr"
      className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable} ${nastaliq.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-canvas text-foreground font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Themes>{children}</Themes>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
