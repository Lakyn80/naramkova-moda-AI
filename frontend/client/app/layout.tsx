import "./globals.css";

export const metadata = {
  title: "Náramková Moda – coming soon"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body className="min-h-screen bg-white text-black">
        {children}
      </body>
    </html>
  );
}
