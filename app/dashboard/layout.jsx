// app/dashboard/layout.jsx
export const metadata = {
  title: "1337 Dashboard",
};

export default function DashboardLayout({ children }) {
  // Einfach nur die Children rendern, Header etc. kommt aus page.jsx
  return <>{children}</>;
}
