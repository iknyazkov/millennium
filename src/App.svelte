<script lang="ts">
  import { BUILTIN_PRESETS } from './core/builtin';
  import type { Op, Preset } from './core/preset';
  import { renderOps } from './render/engine';

  // Session state: the current op list IS the editing session.
  // Applying a preset copies its ops in — preset ≡ saved session state.
  let image = $state<ImageBitmap | null>(null);
  let ops = $state<Op[]>([]);
  let error = $state('');
  let canvas = $state<HTMLCanvasElement | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);

  // The active preset, derived — null when the session has no (or a custom) op list.
  let activeId = $derived(
    BUILTIN_PRESETS.find((p) => JSON.stringify(p.ops) === JSON.stringify(ops))?.id ?? null,
  );

  let runId = 0;
  $effect(() => {
    if (image === null || canvas === null) return;
    const id = ++runId;
    renderOps(image, ops)
      .then((out) => {
        if (id !== runId) return; // a newer render already started
        canvas!.width = out.width;
        canvas!.height = out.height;
        canvas!.getContext('2d')!.drawImage(out, 0, 0);
        error = '';
      })
      .catch(() => {
        if (id === runId) error = 'WebGL недоступен в этом браузере';
      });
  });

  async function onFile(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      image = await createImageBitmap(file);
    } catch {
      error = `Не смог открыть «${file.name}»`;
    }
  }

  function applyPreset(preset: Preset) {
    ops = structuredClone(preset.ops);
  }

  async function download() {
    if (image === null) return;
    const out = await renderOps(image, ops); // full resolution, same ops
    out.toBlob(
      (blob) => {
        if (blob === null) return;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'millennium.jpg';
        link.click();
        URL.revokeObjectURL(link.href);
      },
      'image/jpeg',
      0.92,
    );
  }
</script>

<div class="app">
  <header class="nav">
    <div class="nav-inner">
      <span class="nav-brand">Millennium</span>
      <div class="nav-actions">
        <label class="btn btn-ghost" for="file">
          Открыть фото
          <input
            bind:this={fileInput}
            id="file"
            type="file"
            accept="image/*"
            hidden
            onchange={onFile}
          />
        </label>
        {#if image !== null}
          <button class="btn btn-primary" type="button" onclick={download}>Скачать</button>
        {/if}
      </div>
    </div>
  </header>

  {#if image === null}
    <section class="empty" aria-label="Начало работы">
      <div class="empty-inner">
        <p class="eyebrow">Локальный фото-редактор</p>
        <h1>Фотография не покидает устройство</h1>
        <p class="lead">
          Выбери фото — обработка идёт на GPU прямо в браузере, ничего никуда
          не загружается.
        </p>
        <button class="btn-pill" type="button" onclick={() => fileInput?.click()}>
          Открыть фото
          <svg
            class="od-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </section>
  {:else}
    <div class="editor">
      <aside class="presets">
        <h2>Пресеты</h2>
        <div class="preset-list">
          {#each BUILTIN_PRESETS as preset (preset.id)}
            <button
              class="preset"
              class:active={activeId === preset.id}
              type="button"
              onclick={() => applyPreset(preset)}
            >
              {preset.name}
            </button>
          {/each}
        </div>
      </aside>
      <main class="stage">
        <div class="frame">
          <canvas bind:this={canvas} aria-label="Отредактированное фото"></canvas>
        </div>
      </main>
    </div>
  {/if}

  {#if error}
    <footer class="error" role="alert">
      <svg
        class="od-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M12 9v4M12 17h.01" />
        <circle cx="12" cy="12" r="9" />
      </svg>
      <span>{error}</span>
    </footer>
  {/if}
</div>

<style>
  .app {
    display: grid;
    grid-template-columns: minmax(0, 1fr); /* explicit: implicit auto tracks size to content */
    grid-template-rows: auto minmax(0, 1fr);
    height: 100vh;
    height: 100dvh; /* phone Safari: vh ignores the collapsed URL bar */
  }
  .app h1,
  .app h2,
  .app p {
    margin: 0;
  }

  /* ── Frosted top bar ─────────────────────────────────────────── */
  .nav {
    position: sticky;
    top: 0;
    z-index: 10;
    background: color-mix(in oklab, var(--bg), transparent 25%);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    backdrop-filter: saturate(180%) blur(20px);
    border-bottom: 1px solid var(--border-soft);
  }
  .nav-inner {
    max-width: var(--container-max);
    margin-inline: auto;
    padding-inline: var(--container-gutter-desktop);
    height: 52px;
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }
  .nav-brand {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 600;
    letter-spacing: var(--tracking-display);
    margin-inline-end: auto;
  }
  .nav-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  /* ── Buttons: capsule family + compact commerce controls ─────── */
  .btn,
  .btn-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    font-family: var(--font-body);
    line-height: 1.2;
    letter-spacing: -0.005em;
    cursor: pointer;
    border: none;
    transition:
      background-color var(--motion-fast) var(--ease-standard),
      color var(--motion-fast) var(--ease-standard),
      box-shadow var(--motion-fast) var(--ease-standard),
      transform var(--motion-fast) var(--ease-standard);
  }
  .btn:active,
  .btn-pill:active,
  .preset:active {
    transform: scale(0.98);
  }
  .btn:focus-visible,
  .btn-pill:focus-visible,
  .preset:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .btn {
    padding: 6px 14px;
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    font-weight: 500;
  }
  .btn-primary {
    background: var(--accent);
    color: var(--accent-on);
  }
  .btn-ghost {
    background: transparent;
    color: var(--fg);
    box-shadow: var(--elev-ring);
  }
  .btn-pill {
    padding: 10px 20px;
    border-radius: var(--radius-pill);
    font-size: var(--text-base);
    font-weight: 400;
    background: var(--accent);
    color: var(--accent-on);
  }

  @media (hover: hover) {
    .btn-primary:hover,
    .btn-pill:hover {
      background: var(--accent-hover);
    }
    .btn-ghost:hover {
      background: var(--surface);
    }
    .preset:hover:not(.active) {
      background: var(--surface-raised);
    }
  }
  .btn-primary:active,
  .btn-pill:active {
    background: var(--accent-active);
  }

  /* ── Empty state: cinematic showcase chapter ─────────────────── */
  .empty {
    display: grid;
    place-items: center;
    padding: var(--space-8) var(--container-gutter-phone);
  }
  .empty-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-4);
    max-width: 560px;
  }
  .eyebrow {
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 600;
    line-height: 1;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .empty h1 {
    font-family: var(--font-display);
    font-size: clamp(40px, 7vw, var(--text-3xl));
    font-weight: 600;
    line-height: var(--leading-tight);
    letter-spacing: var(--tracking-display);
  }
  .lead {
    font-size: var(--text-lg);
    line-height: 1.38;
    color: var(--fg-2);
    letter-spacing: -0.011em;
    max-width: 34ch;
  }
  .empty .btn-pill {
    margin-block-start: var(--space-2);
  }

  /* ── Editor state ────────────────────────────────────────────── */
  /* Phone: presets strip on top (auto), stage takes what's left.
   * One row for two children left the stage in an implicit row and
   * the canvas' natural width ripped the page into horizontal scroll. */
  .editor {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 0;
  }
  .presets {
    border-bottom: 1px solid var(--border-soft);
    background: color-mix(in oklab, var(--surface), transparent 35%);
    padding-block: var(--space-3);
  }
  .presets h2 {
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    padding-inline: var(--container-gutter-phone);
    padding-block-end: var(--space-3);
  }
  .preset-list {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    overflow-x: auto;
    scrollbar-width: none;
    padding-inline: var(--container-gutter-phone);
  }
  .preset-list::-webkit-scrollbar {
    display: none;
  }
  .preset {
    flex: none;
    display: inline-flex;
    align-items: center;
    padding: 8px 16px;
    border-radius: var(--radius-pill);
    border: none;
    background: var(--surface-raised);
    color: var(--fg);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 400;
    line-height: 1.2;
    letter-spacing: -0.005em;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color var(--motion-fast) var(--ease-standard),
      color var(--motion-fast) var(--ease-standard),
      transform var(--motion-fast) var(--ease-standard);
  }
  .preset.active {
    background: var(--accent);
    color: var(--accent-on);
  }

  .stage {
    display: grid;
    grid-template-columns: minmax(0, 1fr); /* definite width for the frame's 100% */
    grid-template-rows: minmax(0, 1fr);
    place-items: center;
    padding: var(--space-6) var(--container-gutter-phone);
    min-height: 0;
    min-width: 0; /* grid item must be allowed to shrink below content */
  }
  /* Constant photo area: fixed design size, shrinks only when the
   * viewport can't hold it. The photo fits inside by its own aspect
   * ratio — the frame never stretches to the screen. */
  .frame {
    width: min(880px, 100%);
    height: min(660px, 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--elev-raised);
    overflow: hidden;
  }
  .frame canvas {
    display: block;
    max-width: 100%;
    max-height: 100%;
  }

  @media (min-width: 700px) {
    .editor {
      grid-template-columns: 240px minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr);
    }
    .presets {
      border-bottom: none;
      border-inline-end: 1px solid var(--border-soft);
      padding-block: var(--space-5);
    }
    .presets h2 {
      padding-inline: var(--space-5);
    }
    .preset-list {
      flex-direction: column;
      align-items: stretch;
      overflow-y: auto;
      padding-inline: var(--space-5);
    }
    .preset {
      justify-content: flex-start;
    }
    .stage {
      padding: var(--space-8) var(--space-6);
    }
  }

  /* ── Error banner ────────────────────────────────────────────── */
  .error {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--container-gutter-phone);
    background: color-mix(in oklab, var(--danger), black 55%);
    color: #f5c2c2;
    font-size: var(--text-sm);
    border-top: 1px solid color-mix(in oklab, var(--danger), transparent 60%);
  }
  .error :global(.od-icon) {
    --od-icon-size: 16px;
    color: #f5a1a1;
    flex: none;
  }

  /* Functional inline SVG glyphs own their geometry */
  .od-icon {
    display: inline-block;
    inline-size: var(--od-icon-size, 1em);
    block-size: var(--od-icon-size, 1em);
    flex: none;
  }

  @media (max-width: 639px) {
    .nav-inner {
      padding-inline: var(--container-gutter-phone);
    }
    .btn-pill {
      padding: 8px 16px;
      font-size: var(--text-sm);
    }
  }
</style>
