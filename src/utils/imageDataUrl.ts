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

const loadImageElement = async (dataUrl: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode image'));
    image.src = dataUrl;
  });
};

const drawImageToDataUrl = (
  source: CanvasImageSource,
  width: number,
  height: number,
  options: Required<Pick<OrientedImageOptions, 'mimeType' | 'quality' | 'maxSize'>>
) => {
  let targetW = width;
  let targetH = height;

  const maxDim = Math.max(targetW, targetH);
  if (maxDim > options.maxSize) {
    const scale = options.maxSize / maxDim;
    targetW = Math.max(1, Math.round(targetW * scale));
    targetH = Math.max(1, Math.round(targetH * scale));
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create image canvas');
  }

  ctx.drawImage(source, 0, 0, targetW, targetH);
  return canvas.toDataURL(options.mimeType, options.quality);
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
  const normalizedOptions = { mimeType, quality, maxSize };

  // If not an image, just return as-is.
  if (!blob.type?.startsWith('image/')) {
    return await blobToDataUrl(blob);
  }

  // Best effort: use createImageBitmap with EXIF orientation support.
  try {
    const bitmap: ImageBitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const dataUrl = drawImageToDataUrl(bitmap, bitmap.width, bitmap.height, normalizedOptions);
    bitmap.close?.();
    return dataUrl;
  } catch {
    // Fallback for mobile browsers where camera images can fail in createImageBitmap
    // but still decode through the native image element pipeline.
    try {
      const originalDataUrl = await blobToDataUrl(blob);
      const image = await loadImageElement(originalDataUrl);
      return drawImageToDataUrl(image, image.naturalWidth || image.width, image.naturalHeight || image.height, normalizedOptions);
    } catch {
      // Last resort: keep the upload alive even when preview normalization is unavailable.
      return await blobToDataUrl(blob);
    }
  }
};
