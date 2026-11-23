// Test setup: jsdom has no canvas, but every game module draws or prepares sprites at load. Give each canvas a 2D
// context that accepts every call and draws nothing, and add the page's #game canvas, so the game logic can run in
// Node. (Rendering itself, Three.js and WebGL, isn't exercised here; the browser is the place to check that.)
const noop = () => {};

function fakeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const state: Record<string | symbol, unknown> = { canvas, font: '10px sans-serif', globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000' };
  const imageData = (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(0, w * h * 4)), colorSpace: 'srgb' });
  const special: Record<string, unknown> = {
    // about 0.6 em per character, so text layout code gets plausible widths
    measureText: (s: string) => {
      const px = Number(/(\d+(?:\.\d+)?)px/.exec(String(state.font))?.[1] ?? 10);
      return { width: s.length * px * 0.6, actualBoundingBoxAscent: px * 0.7, actualBoundingBoxDescent: px * 0.2 };
    },
    getImageData: (_x: number, _y: number, w: number, h: number) => imageData(w, h),
    createImageData: (w: number | ImageData, h?: number) => (typeof w === 'number' ? imageData(w, h ?? 0) : imageData(w.width, w.height)),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    isPointInPath: () => false,
  };
  return new Proxy(state, {
    get: (target, key) => (typeof key === 'string' && key in special ? special[key] : key in target ? target[key] : noop),
    set: (target, key, value) => { target[key] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string) {
  if (type !== '2d') return null;
  let g = contexts.get(this);
  if (!g) { g = fakeContext(this); contexts.set(this, g); }
  return g;
} as typeof HTMLCanvasElement.prototype.getContext;

const game = document.createElement('canvas');
game.id = 'game';
document.body.append(game);
