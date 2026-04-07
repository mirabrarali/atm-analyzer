import "./globals.css";

export const metadata = {
  title: "ATM Analyzer Pro",
  description: "Sophisticated AI-driven ATM transaction analysis tool.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
