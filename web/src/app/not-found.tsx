"use client";

import { Compass, LayoutDashboard } from "lucide-react";
import { StatusLink, StatusPage } from "@/components/status-page";

/**
 * 404 for the whole app.
 *
 * The headline is what happened, not the number — "404" tells a developer
 * something and tells everyone else nothing. The code sits above it as context.
 *
 * A CLIENT component, like its two sibling error pages. `StatusPage` takes the
 * glyph as a component, and a Lucide icon is a function — React cannot serialise
 * one across the server/client boundary, so as a server component this logged
 * "Only plain objects can be passed to Client Components" on every render. The
 * page is static content either way; nothing is lost by rendering it on the
 * client, and the alternative is passing an icon NAME and mapping it, which is
 * only worth it where the module must stay JSX-free (see lib/modules.ts).
 */
export default function NotFound() {
  return (
    <StatusPage
      code="404"
      icon={Compass}
      title="This page does not exist"
      description="The link may be old, or the page may have been renamed. Nothing in your accounts has changed."
      actions={
        <StatusLink href="/dashboard">
          <LayoutDashboard size={15} />
          Go to Overview
        </StatusLink>
      }
    />
  );
}
