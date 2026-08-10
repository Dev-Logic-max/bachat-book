import * as React from "react";
import { ToastProvider } from "@/components/ui/toast";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="bg-canvas flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          {/* Header Branding */}
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="bg-navy-900 text-brass dark:bg-brass dark:text-navy-900 flex size-12 items-center justify-center rounded-card font-display text-xl font-bold shadow-md">
              BB
            </div>
            <h1 className="font-display mt-3 text-2xl font-bold tracking-tight">
              Bachat Book
            </h1>
            <p className="text-muted mt-1 text-xs">
              Premium personal finance for Pakistan
            </p>
          </div>

          {/* Auth Card */}
          <div className="bg-surface border-border rounded-panel border p-6 shadow-xl sm:p-8">
            {children}
          </div>

          {/* Footer note */}
          <p className="text-faint mt-6 text-center text-[11.5px]">
            &copy; {new Date().getFullYear()} Bachat Book. All rights reserved.
          </p>
        </div>
      </div>
    </ToastProvider>
  );
}
