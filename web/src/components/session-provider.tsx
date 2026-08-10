"use client";

import * as React from "react";
import type { UserSession } from "@/lib/session";

const SessionContext = React.createContext<UserSession | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: UserSession;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const session = React.useContext(SessionContext);
  if (!session) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return session;
}
