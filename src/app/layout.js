import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "ATM Analyzer Pro",
  description: "Intelligent ATM transaction analytics for banks and financial institutions.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="site-top-nav">
          <Link href="/" className="site-top-nav-brand">
            ATM Analyzer<span>PRO</span>
          </Link>
          <nav className="site-top-nav-links">
            <Link href="/">Application</Link>
            <Link href="/about">Product overview</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
