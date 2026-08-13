import { Compass, LayoutDashboard } from "lucide-react";
import { StatusLink, StatusPage } from "@/components/status-page";

/**
 * 404 for the whole app.
 *
 * The headline is what happened, not the number — "404" tells a developer
 * something and tells everyone else nothing. The code sits above it as context.
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
