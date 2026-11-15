# Millennium

Семейный фото-редактор на пресетах. PWA: фото не покидают устройство —
обработка идёт на GPU прямо в браузере (WebGL), пресеты = versioned JSON op-list.

## Разработка

```sh
npm install
npm run dev        # http://localhost:5173
npx vitest run     # тесты ядра
npm run fixture    # сгенерировать hue-мишень public/test.png
npm run smoke      # смоук в Chromium (нужен запущенный dev-сервер)
```

## Деплой

Пуш в `main` собирает и публикует сайт через GitHub Actions (`.github/workflows/deploy.yml`).
Сайт: `https://iknyazkov.github.io/millennium/` (base задан в `vite.config.ts`).
`vercel.json` в репо — опциональное зеркало на Vercel для доступа вне РФ.

## Архитектура

- `src/core/` — чистый TS: схема пресетов, граница валидации `parsePreset`
- `src/render/` — адаптер op-list → WebGLImageFilter (`src/vendor/`, MIT)
- `src/App.svelte` — тонкий UI (Svelte 5)

Хранилище пользовательских пресетов — IndexedDB (в разработке).
