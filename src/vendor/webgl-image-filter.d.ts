// Type surface of the vendored MIT engine (phoboslab/WebGLImageFilter).
// The file is ES5 and attaches to window; this declares just the parts
// our adapter uses.
declare global {
  interface Window {
    WebGLImageFilter: new (params?: { canvas?: HTMLCanvasElement }) => {
      addFilter(name: string, ...args: number[]): void;
      reset(): void;
      /** Draws the chain over the image and returns the engine's canvas. */
      apply(image: TexImageSource): HTMLCanvasElement;
    };
  }
}

export {};
