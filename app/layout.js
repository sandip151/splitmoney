import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "SplitMoney",
  description: "Splitwise-like expense splitting with Supabase",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <div className="nav">
            <Link href="/">Home</Link>
            <Link href="/projects">Project Management</Link>
            <Link href="/users">User Management</Link>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}

