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

<header>
  <h1>Millennium</h1>
  <label class="open">
    Открыть фото
    <input type="file" accept="image/*" onchange={onFile} hidden />
  </label>
  {#if image !== null}
    <button class="primary" onclick={download}>Скачать</button>
  {/if}
</header>

{#if image === null}
  <main class="empty">
    <p>Выбери фото — оно не покинет это устройство.</p>
  </main>
{:else}
  <aside>
    <h2>Пресеты</h2>
    {#each BUILTIN_PRESETS as preset (preset.id)}
      <button class:active={JSON.stringify(ops) === JSON.stringify(preset.ops)} onclick={() => applyPreset(preset)}>
        {preset.name}
      </button>
    {/each}
  </aside>
  <main>
    <canvas bind:this={canvas}></canvas>
  </main>
{/if}

{#if error}
  <footer class="error">{error}</footer>
{/if}

<style>
  :global(body) {
    margin: 0;
  }
  header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 20px;
  }
  h1 {
    font-size: 20px;
    margin-right: auto;
  }
  .open,
  button {
    font: inherit;
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid #444;
    background: #222;
    color: #eee;
    cursor: pointer;
  }
  button.primary {
    background: #2c5d8f;
  }
  aside {
    padding: 12px 20px;
  }
  aside h2 {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #888;
  }
  aside button {
    display: block;
    width: 100%;
    margin-bottom: 8px;
    text-align: left;
  }
  aside button.active {
    border-color: #6ea8dd;
  }
  main {
    padding: 0 20px;
  }
  main.empty {
    display: grid;
    place-items: center;
    min-height: 60vh;
    color: #888;
  }
  canvas {
    max-width: 100%;
    max-height: 70vh;
  }
  footer.error {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 10px;
    background: #5b1d1d;
    color: #fdd;
  }
  @media (min-width: 700px) {
    :global(body) {
      display: grid;
      grid-template-areas:
        'header header'
        'sidebar main';
      grid-template-columns: 220px 1fr;
    }
    header {
      grid-area: header;
    }
    aside {
      grid-area: sidebar;
    }
    main {
      grid-area: main;
    }
  }
</style>
