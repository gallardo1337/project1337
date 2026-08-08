import HomePage from "../page";

export const metadata = {
  title: "1337 Library v1 – Das Original",
  description: "Die archivierte erste Version der 1337 Library.",
};

export default function V1ArchivePage() {
  return <HomePage basePath="/v1" version="v1" />;
}
