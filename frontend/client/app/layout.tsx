import "./globals.css";
import { CartProvider } from "../context/CartContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import WhatsAppWidget from "../components/WhatsAppWidget";

export const metadata = {
  title: "Náramková Moda",
  description: "Ozdobte se jedinečností - ručně vyráběné náramky",
  icons: {
    icon: [
      { url: "/logo.jpg", sizes: "any", type: "image/jpeg" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/logo.jpg",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <head>
        <link rel="icon" href="/logo.jpg" type="image/jpeg" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-gradient-to-b from-pink-800 via-pink-600 to-pink-400 overflow-x-hidden text-pink-50">
        <CartProvider>
          <Navbar />
          <main className="min-h-screen">
            {children}
          </main>
          <div
            className="w-full h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
            aria-hidden="true"
          />
          <Footer />
          <WhatsAppWidget
            phone="420776479747"
            defaultMessage="Dobrý den, rád/a bych se zeptal/a na…"
            position="right"
          />
        </CartProvider>
      </body>
    </html>
  );
}
