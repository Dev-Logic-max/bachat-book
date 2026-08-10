import { cn } from "@/lib/utils";

/**
 * A real brand mark is the single highest premium-per-effort item on a
 * transaction row — a coloured circle with an initial is what makes an app look
 * like a prototype.
 *
 * Until /public/logos is populated this renders a brand-coloured monogram, which
 * upgrades to the real mark the moment `logo` is set on the merchant.
 */
export function MerchantMark({
  name,
  brand,
  logo,
  size = 36,
  className,
}: {
  name: string;
  brand: string;
  logo?: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .replace(/[^a-zA-Z\s.]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  // Real marks sit on a white tile with a hairline — favicons carry their own
  // backgrounds, so tinting the tile would clash with half of them.
  if (logo) {
    return (
      <span
        className={cn(
          "border-border bg-surface inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border",
          className,
        )}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt=""
          width={Math.round(size * 0.62)}
          height={Math.round(size * 0.62)}
          className="object-contain"
          style={{ width: size * 0.62, height: size * 0.62 }}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        className,
      )}
      style={{ width: size, height: size, background: brand }}
    >
      <span
        className="font-semibold leading-none text-white"
        style={{ fontSize: size * 0.34, letterSpacing: "-0.02em" }}
      >
        {initials || "•"}
      </span>
    </span>
  );
}
