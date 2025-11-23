/**
 * Compress an image from URL to reduce file size
 * @param imageUrl - URL of the image to compress
 * @param quality - Compression quality (0-1), default 0.6
 * @param maxWidth - Maximum width in pixels, default 1200
 * @returns Promise with compressed image as data URL
 */
export const compressImage = async (
  imageUrl: string,
  quality: number = 0.6,
  maxWidth: number = 1200
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Calculate new dimensions while maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to data URL with compression
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageUrl;
  });
};

/**
 * Compress multiple images
 * @param imageUrls - Array of image URLs to compress
 * @param quality - Compression quality (0-1), default 0.6
 * @param maxWidth - Maximum width in pixels, default 1200
 * @returns Promise with array of compressed images as data URLs
 */
export const compressImages = async (
  imageUrls: string[],
  quality: number = 0.6,
  maxWidth: number = 1200
): Promise<string[]> => {
  const compressionPromises = imageUrls.map(url => 
    compressImage(url, quality, maxWidth)
  );
  
  return Promise.all(compressionPromises);
};
