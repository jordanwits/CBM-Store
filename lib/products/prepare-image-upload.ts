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

// The store shows images as squares about 420px across (twice that on high-resolution screens),
// cropped to the shorter side, so a shorter side under this gets stretched and looks soft.
const MIN_SHARP_EDGE = 800;

async function measure(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return null;
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

/**
 * Warn before uploading images too small to look sharp on the store, and let the admin decide.
 * Returns the files to go ahead with: all of them, or without the small ones if they cancel.
 */
export async function confirmSmallImages(files: File[]): Promise<File[]> {
  const small: { file: File; label: string }[] = [];
  for (const file of files) {
    const size = await measure(file);
    if (size && Math.min(size.width, size.height) < MIN_SHARP_EDGE) {
      small.push({ file, label: `${file.name} (${size.width} × ${size.height} pixels)` });
    }
  }
  if (small.length === 0) return files;

  const advice = `Images at least ${MIN_SHARP_EDGE} pixels on each side look sharp.`;
  const message = small.length === 1
    ? `${small[0].label} is small, so it will look blurry on the store. ${advice}\n\nUpload it anyway?`
    : `These images are small, so they will look blurry on the store:\n\n${small.map(s => `• ${s.label}`).join('\n')}\n\n${advice}\n\nOK uploads them anyway. Cancel leaves them out.`;
  if (window.confirm(message)) return files;

  const leftOut = new Set(small.map(s => s.file));
  return files.filter(file => !leftOut.has(file));
}

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
