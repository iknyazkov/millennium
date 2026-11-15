// Type surface of the vendored MIT engine (phoboslab/WebGLImageFilter).
// The file is ES5 and attaches to window; this declares just the parts
// our adapter uses.
declare global {
  interface Window {
    WebGLImageFilter: new (params?: { canvas?: HTMLCanvasElement }) => {
      // Engine quirk: addFilter stores args as a list and applies them as
      // the filter's argument list — colorMatrix takes ONE array, films
      // take none, amounts take one number. Spread would break colorMatrix.
      addFilter(name: 'colorMatrix', matrix: number[]): void;
      addFilter(name: string, ...args: number[]): void;
      reset(): void;
      /** Draws the chain over the image and returns the engine's canvas. */
      apply(image: TexImageSource): HTMLCanvasElement;
    };
  }
}

export {};
