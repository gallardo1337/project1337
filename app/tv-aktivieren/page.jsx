import { hasLibrarySession } from "../../lib/serverSupabase";
import TVActivationClient from "./TVActivationClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Apple TV verbinden · Project 1337",
  description: "Project 1337 auf einem Apple TV freigeben.",
};

export default async function TVActivationPage({ searchParams }) {
  const params = await searchParams;
  const initialCode = typeof params?.code === "string" ? params.code : "";
  const authenticated = await hasLibrarySession();

  return (
    <TVActivationClient
      initialCode={initialCode}
      initialAuthenticated={authenticated}
    />
  );
}
