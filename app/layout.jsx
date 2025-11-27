import "./globals.css";

export const metadata = {
  title: "1337 Film-Bibliothek",
  description: "Eigene Film-Bibliothek mit Tags, Actors und Supabase"
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
