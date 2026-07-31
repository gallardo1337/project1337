import HomePage from "../page";
import styles from "./beta.module.css";

export const metadata = {
  title: "1337 Library Beta",
  description: "Beta-Ansicht der 1337 Library",
};

export default function BetaPage() {
  return (
    <main className={styles.betaShell}>
      <HomePage basePath="/beta" />
    </main>
  );
}
