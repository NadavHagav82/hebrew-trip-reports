export type OrientedImageOptions = {
  /** Output MIME type. Defaults to 'image/jpeg'. */
  mimeType?: string;
  /** JPEG/WebP quality 0..1. Defaults to 0.92. */
  quality?: number;
  /** Downscale so max(width,height) <= maxSize. Defaults to 1800. */
  maxSize?: number;
};

export const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
};

/**
 * Normalizes image orientation (EXIF) and optionally downscales, returning a data URL.
 *
 * Why: many phone camera images rely on EXIF Orientation. Some renderers (incl. react-pdf)
 * ignore it and show the image rotated. Using createImageBitmap({ imageOrientation: 'from-image' })
 * applies orientation correctly.
 */
export const blobToOrientedImageDataUrl = async (
  blob: Blob,
  options: OrientedImageOptions = {}
): Promise<string> => {
  const mimeType = options.mimeType || 'image/jpeg';
  const quality = options.quality ?? 0.92;
  const maxSize = options.maxSize ?? 1800;

  // If not an image, just return as-is.
  if (!blob.type?.startsWith('image/')) {
    return await blobToDataUrl(blob);
  }

  // Best effort: use createImageBitmap with EXIF orientation support.
  try {
    const bitmap: ImageBitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });

    let targetW = bitmap.width;
    let targetH = bitmap.height;

    const maxDim = Math.max(targetW, targetH);
    if (maxDim > maxSize) {
      const scale = maxSize / maxDim;
      targetW = Math.max(1, Math.round(targetW * scale));
      targetH = Math.max(1, Math.round(targetH * scale));
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return await blobToDataUrl(blob);
    }

    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close?.();

    return canvas.toDataURL(mimeType, quality);
  } catch {
    // Fallback: no orientation normalization available
    return await blobToDataUrl(blob);
  }
};
