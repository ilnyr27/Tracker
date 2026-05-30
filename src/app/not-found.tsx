import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <div className="mb-6 text-7xl font-bold text-primary/20">404</div>
      <h1 className="text-xl font-bold mb-2">Страница не найдена</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Такой страницы нет. Возможно, она была удалена или вы ошиблись в адресе.
      </p>
      <Link
        href="/today"
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
      >
        На главную
      </Link>
    </div>
  );
}
