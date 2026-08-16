import { redirect } from "next/navigation";

export default function LegacyDashboardV2Redirect() {
  redirect("/dashboard");
}
