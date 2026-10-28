export interface CropBounds {
  offsetX: number;
  offsetY: number;
  targetWidth: number;
  targetHeight: number;
}

export interface CaptureVideoOptions {
  mirrored?: boolean;
  quality?: number;
  mimeType?: string;
}

export function calculateCropBounds(
  srcWidth: number,
  srcHeight: number,
  targetAspect: number
): CropBounds {
  if (srcWidth <= 0 || srcHeight <= 0 || targetAspect <= 0) {
    throw new Error('Dimensions and targetAspect must be greater than zero');
  }

  const currentAspect = srcWidth / srcHeight;
  let targetWidth = srcWidth;
  let targetHeight = srcHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (currentAspect > targetAspect) {
    targetWidth = Math.round(srcHeight * targetAspect);
    offsetX = Math.round((srcWidth - targetWidth) / 2);
  } else {
    targetHeight = Math.round(srcWidth / targetAspect);
    offsetY = Math.round((srcHeight - targetHeight) / 2);
  }

  return { offsetX, offsetY, targetWidth, targetHeight };
}

export async function captureVideoFrame(
  videoEl: HTMLVideoElement,
  targetAspect = 3 / 2,
  options: CaptureVideoOptions = {}
): Promise<Blob> {
  const { mirrored = true, quality = 0.92, mimeType = 'image/jpeg' } = options;
  const canvas = document.createElement('canvas');
  const srcWidth = videoEl.videoWidth || 1280;
  const srcHeight = videoEl.videoHeight || 720;
  const bounds = calculateCropBounds(srcWidth, srcHeight, targetAspect);

  canvas.width = bounds.targetWidth;
  canvas.height = bounds.targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2D context');

  // Mirror horizontally if front camera (default)
  if (mirrored) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(
    videoEl,
    bounds.offsetX,
    bounds.offsetY,
    bounds.targetWidth,
    bounds.targetHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null'));
      },
      mimeType,
      quality
    );
  });
}
