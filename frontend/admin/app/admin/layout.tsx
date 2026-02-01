import Link from "next/link";

export default function AdministraceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold">Administrace</h1>
          <nav className="flex gap-4 text-sm text-gray-600">
            <Link href="/admin/products" className="hover:text-gray-900">
              Produkty
            </Link>
            <Link href="/admin/categories" className="hover:text-gray-900">
              Kategorie
            </Link>
            <Link href="/admin/media" className="hover:text-gray-900">
              Média
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
