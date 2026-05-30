"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body>
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "1rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}>
          <div style={{ fontSize: "4rem", fontWeight: "bold", opacity: 0.2, marginBottom: "1.5rem" }}>
            500
          </div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
            Критическая ошибка
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#888", marginBottom: "1.5rem" }}>
            Приложение столкнулось с серьёзной проблемой.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.625rem 1rem",
              borderRadius: "0.75rem",
              border: "1px solid #ddd",
              background: "transparent",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Перезагрузить
          </button>
        </div>
      </body>
    </html>
  );
}
