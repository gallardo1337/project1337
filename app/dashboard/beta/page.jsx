import { redirect } from "next/navigation";

export default function LegacyDashboardBetaRedirect() {
  redirect("/dashboard/v2");
}
