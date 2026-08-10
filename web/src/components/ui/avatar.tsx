import * as React from "react";
import { cn } from "@/lib/utils";

interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const initials = React.useMemo(() => {
    if (!name) return "BB";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }, [name]);

  const sizeClasses = {
    sm: "size-7 text-xs",
    md: "size-9 text-sm",
    lg: "size-12 text-base font-medium",
  }[size];

  if (src) {
    return (
      <img
        src={src}
        alt={name || "Avatar"}
        className={cn(
          "bg-surface-subtle shrink-0 rounded-full object-cover",
          sizeClasses,
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 flex shrink-0 items-center justify-center rounded-full font-semibold shadow-xs",
        sizeClasses,
        className,
      )}
    >
      {initials}
    </div>
  );
}
