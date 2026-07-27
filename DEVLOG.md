# Life OS — Журнал разработки

> Актуальный лог работы: что сделано, что осталось, баги, решения.
> Обновляется в начале/конце каждой сессии.

---

## Инфраструктура

| Слой | Где | URL / Адрес |
|------|-----|-------------|
| **Фронт (ОСНОВНОЙ)** | Docker, порт 3003 | **https://tracker27.ru** ✅ |
| Фронт (резервный) | Vercel | tracker-tau-two-64.vercel.app (нестабилен в РФ без VPN) |
| Supabase (tracker) | Docker на сервере | supabase.tracker27.ru ✅ |
| Supabase Studio | supabase.tracker27.ru | логин: supabase / пароль в SUPABASE-TRACKER-SECRETS.txt |

> ⚠️ **Vercel в РФ нестабилен** (РКН throttle-ит Cloudflare). Основной хост — домашний сервер.
> Подробнее: `_vault/02 - Знания/HOSTING-Russia-RKN.md`

---

## Сессия 2026-07-21 — Диагностика + фикс авторизации

### Что выяснили
- Vercel env `NEXT_PUBLIC_SUPABASE_ANON_KEY` был **неправильный** (ставился 77 дней назад, до переезда на Tracker Supabase)
- Tracker Supabase (supabase.tracker27.ru) был **запущен и здоров**, но с fake SMTP — письма не уходили
- ENABLE_EMAIL_AUTOCONFIRM был **false** → signup падал с 500 (fake SMTP не мог отправить email)
- local .env.local указывал на **облачный** supabase.co (заблокирован в РФ)

### Что сделали
- [x] Обновили Vercel ANON_KEY на правильный (из ~/SUPABASE-TRACKER-SECRETS.txt)
- [x] Обновили local .env.local → https://supabase.tracker27.ru + правильный ключ
- [x] Включили ENABLE_EMAIL_AUTOCONFIRM=true (можно зарегистрироваться без подтверждения)
- [x] Настроили Resend SMTP (smtp.resend.com:465, ключ от Познай себя)
- [x] Сменили SMTP_ADMIN_EMAIL на `noreply@poznaisebya27.ru` (верифицированный домен в Resend) → письма восстановления пароля теперь должны приходить
- [x] Добавили ADDITIONAL_REDIRECT_URLS (Vercel URL) для сброса пароля
- [x] Передеплоили Vercel → новая версия в проде
- [x] Подтвердили что **tracker27.ru на домашнем сервере полностью работает** (SSL ✅, Docker ✅, правильный Supabase URL+ключ бакированы в образе ✅)
- [x] Задокументировали Vercel+РКН проблему: `_vault/02 - Знания/HOSTING-Russia-RKN.md`
- [x] Обновили Tracker Index в vault и граф знаний

### Проблемы авторизации по библиотеке (Vibe Coder 01-Auth.md)
- [x] Страница reset-password — **есть**, работает
- [x] "Забыл пароль" — форма на логин-странице есть (`mode === "forgot"`), SMTP настроен, sender = `noreply@poznaisebya27.ru`

---

## Аудит (2026-05-30) — что было сделано к июню

| # | Проблема | Статус |
|---|----------|--------|
| P0 | Toast-уведомления | ✅ сделано |
| P0 | Confirm перед удалением (цели) | ✅ сделано |
| P0 | Забыл пароль / Сбросить пароль | ✅ страница есть |
| P1 | Редактирование заметок | ❌ нет |
| P1 | Редактирование/удаление категорий | ✅ меню появилось |
| P1 | Удаление задач | ❌ нет |
| P1 | Deadline предупреждения | ❌ нет |
| P2 | Автогенерация задач из шаблонов | ❌ нет (критично!) |

---

## Найденные баги (2026-07-21)

| # | Файл | Баг | Критичность |
|---|------|-----|-------------|
| 1 | today/page.tsx:376 | setSavingCat(true) не сбрасывается при auth failure | 🔴 HIGH |
| 2 | today/page.tsx:1281 | setSaving(true) не сбрасывается при auth failure | 🔴 HIGH |
| 3 | today/page.tsx:589-598 | Удаление категории без confirm-диалога | 🟡 MEDIUM |
| 4 | today/page.tsx:159 | EmojiPicker поиск не работает по тексту | 🟢 LOW |
| 5 | recurrence.ts:74-84 | matchesBiweekly — проблемы с timezone | 🟢 LOW |

---

## Roadmap

### Фаза 1 — Делает приложение рабочим (ПРИОРИТЕТ)
- [ ] **Автогенерация задач из шаблонов** — при открытии /today проверять task_templates через matchesDate() и создавать задачи на текущую дату. Без этого вся система повторяющихся задач не работает.
- [ ] Фикс setSavingCat/setSaving при null user (bugs #1, #2)
- [ ] Confirm при удалении категории (bug #3)

### Фаза 2 — Ключные фичи (из ВОПРОСЫ.md, пользователь отметил [X])
- [ ] Свободный текст по категории в /today (daily_entries — таблица есть, UI нет)
- [ ] Приоритеты задач с цветом (поле priority в Task есть, UI нет)
- [ ] Свайп-жесты для задач (сейчас только для целей)
- [ ] Редактирование заметок + закрепление (pin)

### Фаза 3 — Рост
- [ ] Страница /plans (пустая заглушка) — десятилетний план + годовой по месяцам
- [ ] Дашборд — сводка прогресса, графики по категориям
- [ ] Поиск + хештеги в журнале
- [ ] Markdown в заметках

### Фаза 4 — Инфраструктура
- [ ] Push-уведомления (настоящие, через Service Worker)
- [ ] Offline режим (PWA)
- [ ] Импорт из Excel (2022–2026)
- [ ] Telegram Login

---

## Ссылки и ресурсы

- **Vibe Coder Library**: https://github.com/ilnyr27/Vibe-coder-library-research
- **Auth guidelines**: points/01-Auth.md
- **Supabase Secrets**: ~/SUPABASE-TRACKER-SECRETS.txt (на сервере)
- **Vercel dashboard**: vercel.com/ilnyr27s-projects/tracker
- **SERVER.md**: C:\Users\ilray\Claude\SERVER.md
