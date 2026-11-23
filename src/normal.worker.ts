import { normalPixels } from './normal-pixels.js';

addEventListener('message', (event: MessageEvent<{ id: number; bitmap: ImageBitmap; radius: number }>) => {
  const { id, bitmap, radius } = event.data;
  try {
    const { width, height } = bitmap;
    const ctx = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bitmap, 0, 0);
    const result = ctx.createImageData(width, height);
    normalPixels(ctx.getImageData(0, 0, width, height), result, radius);
    postMessage({ id, result }, { transfer: [result.data.buffer] });
  } catch {
    postMessage({ id, result: null });
  } finally { bitmap.close(); }
});
