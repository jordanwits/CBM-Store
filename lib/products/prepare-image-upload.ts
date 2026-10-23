/**
 * Shrink a product photo in the browser before it is uploaded.
 *
 * The storefront serves images straight from Supabase Storage (next.config.js has
 * images.unoptimized, since Vercel's optimizer is a metered add-on), so whatever file the
 * admin uploads is exactly what every shopper downloads. Phone photos arrive at 2 to 10MB;
 * capping the long edge and re-encoding as WebP brings them to a few hundred KB. Doing it
 * here rather than in the server action also keeps the upload under Vercel's request size
 * limit.
 *
 * Anything that cannot be decoded (or that would lose something by being redrawn, like an
 * animated GIF or an SVG) is passed through untouched, so a failure here never blocks an
 * upload that worked before.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.82;
const PASS_THROUGH_TYPES = new Set(['image/gif', 'image/svg+xml']);
const WEB_SAFE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

function renamed(name: string, ext: string): string {
  const dot = name.lastIndexOf('.');
  return `${dot > 0 ? name.slice(0, dot) : name}.${ext}`;
}

export async function prepareImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || PASS_THROUGH_TYPES.has(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    // Phone photos are often stored sideways with an EXIF rotation flag; bake it in.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    // Older Safari cannot encode WebP and quietly hands back a PNG instead. Fall back to
    // JPEG for photos, but keep PNGs as PNG so logos with transparency don't turn black.
    let blob = await canvasToBlob(canvas, 'image/webp', QUALITY);
    if (!blob || blob.type !== 'image/webp') {
      blob = file.type === 'image/png'
        ? await canvasToBlob(canvas, 'image/png')
        : await canvasToBlob(canvas, 'image/jpeg', QUALITY);
    }
    if (!blob) return file;

    // An already-small image can come out bigger after re-encoding; keep the original then,
    // unless it is a format browsers can't all show (e.g. HEIC decoded by Safari).
    if (scale === 1 && blob.size >= file.size && WEB_SAFE_TYPES.has(file.type)) return file;

    const ext = blob.type.split('/')[1] === 'jpeg' ? 'jpg' : blob.type.split('/')[1];
    return new File([blob], renamed(file.name, ext), { type: blob.type, lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
