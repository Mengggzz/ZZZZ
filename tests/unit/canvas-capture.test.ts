// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { calculateCropBounds, captureVideoFrame } from '../../src/lib/canvas-capture';
import { CameraViewport } from '../../src/components/booth/CameraViewport';

describe('Canvas Capture Cropper', () => {
  describe('calculateCropBounds', () => {
    it('calculates center-crop coordinates for 16:9 webcam to 3:2 frame', () => {
      const videoWidth = 1920;
      const videoHeight = 1080;
      const targetAspect = 3 / 2; // 1.5

      const bounds = calculateCropBounds(videoWidth, videoHeight, targetAspect);
      expect(bounds.targetHeight).toBe(1080);
      expect(bounds.targetWidth).toBe(1620);
      expect(bounds.offsetX).toBe(150); // (1920 - 1620) / 2
      expect(bounds.offsetY).toBe(0);
    });

    it('calculates center-crop coordinates for 4:3 webcam to 3:2 frame', () => {
      // 4:3 aspect is 1.333 < 1.5, so height is cropped
      const videoWidth = 1200;
      const videoHeight = 900;
      const targetAspect = 3 / 2; // 1.5

      const bounds = calculateCropBounds(videoWidth, videoHeight, targetAspect);
      expect(bounds.targetWidth).toBe(1200);
      expect(bounds.targetHeight).toBe(800); // 1200 / 1.5 = 800
      expect(bounds.offsetX).toBe(0);
      expect(bounds.offsetY).toBe(50); // (900 - 800) / 2
    });

    it('calculates center-crop for portrait aspect ratio to 3:2 frame', () => {
      const videoWidth = 1080;
      const videoHeight = 1920;
      const targetAspect = 3 / 2; // 1.5

      const bounds = calculateCropBounds(videoWidth, videoHeight, targetAspect);
      expect(bounds.targetWidth).toBe(1080);
      expect(bounds.targetHeight).toBe(720); // 1080 / 1.5 = 720
      expect(bounds.offsetX).toBe(0);
      expect(bounds.offsetY).toBe(600); // (1920 - 720) / 2
    });

    it('returns full bounds when aspect ratio matches target exactly', () => {
      const videoWidth = 1500;
      const videoHeight = 1000;
      const targetAspect = 3 / 2;

      const bounds = calculateCropBounds(videoWidth, videoHeight, targetAspect);
      expect(bounds.targetWidth).toBe(1500);
      expect(bounds.targetHeight).toBe(1000);
      expect(bounds.offsetX).toBe(0);
      expect(bounds.offsetY).toBe(0);
    });

    it('throws error for invalid dimensions or target aspect', () => {
      expect(() => calculateCropBounds(0, 1080, 1.5)).toThrow();
      expect(() => calculateCropBounds(1920, -10, 1.5)).toThrow();
      expect(() => calculateCropBounds(1920, 1080, 0)).toThrow();
    });
  });

  describe('captureVideoFrame', () => {
    let mockContext: any;
    let mockBlob: Blob;

    beforeEach(() => {
      mockBlob = new Blob(['mock-jpeg-bytes'], { type: 'image/jpeg' });
      mockContext = {
        translate: vi.fn(),
        scale: vi.fn(),
        drawImage: vi.fn(),
      };

      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockContext as any);
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
        this: HTMLCanvasElement,
        callback: (blob: Blob | null) => void,
        type?: string,
        quality?: any
      ) {
        callback(mockBlob);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('captures frame with default 3:2 aspect and mirrored canvas', async () => {
      const video = document.createElement('video');
      Object.defineProperty(video, 'videoWidth', { value: 1920, configurable: true });
      Object.defineProperty(video, 'videoHeight', { value: 1080, configurable: true });

      const blob = await captureVideoFrame(video);
      expect(blob).toBe(mockBlob);

      // Verify canvas operations
      expect(mockContext.translate).toHaveBeenCalledWith(1620, 0);
      expect(mockContext.scale).toHaveBeenCalledWith(-1, 1);
      expect(mockContext.drawImage).toHaveBeenCalledWith(
        video,
        150, 0, 1620, 1080, // source crop
        0, 0, 1620, 1080     // target
      );
    });

    it('allows non-mirrored capture when specified in options', async () => {
      const video = document.createElement('video');
      Object.defineProperty(video, 'videoWidth', { value: 1920, configurable: true });
      Object.defineProperty(video, 'videoHeight', { value: 1080, configurable: true });

      const blob = await captureVideoFrame(video, 3 / 2, { mirrored: false });
      expect(blob).toBe(mockBlob);

      expect(mockContext.translate).not.toHaveBeenCalled();
      expect(mockContext.scale).not.toHaveBeenCalled();
      expect(mockContext.drawImage).toHaveBeenCalledWith(
        video,
        150, 0, 1620, 1080,
        0, 0, 1620, 1080
      );
    });

    it('uses fallback dimensions 1280x720 when video dimensions are 0', async () => {
      const video = document.createElement('video');
      Object.defineProperty(video, 'videoWidth', { value: 0, configurable: true });
      Object.defineProperty(video, 'videoHeight', { value: 0, configurable: true });

      const blob = await captureVideoFrame(video);
      expect(blob).toBe(mockBlob);

      // 1280x720 cropped to 3:2 -> width: 1080, offsetX: 100
      expect(mockContext.drawImage).toHaveBeenCalledWith(
        video,
        100, 0, 1080, 720,
        0, 0, 1080, 720
      );
    });

    it('rejects if canvas 2D context is unavailable', async () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

      const video = document.createElement('video');
      await expect(captureVideoFrame(video)).rejects.toThrow('Failed to get canvas 2D context');
    });

    it('rejects if canvas.toBlob returns null', async () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
        callback(null);
      });

      const video = document.createElement('video');
      await expect(captureVideoFrame(video)).rejects.toThrow('Canvas toBlob returned null');
    });
  });

  describe('CameraViewport Component', () => {
    it('renders video element with autoPlay, playsInline, and muted attributes', () => {
      render(React.createElement(CameraViewport));
      const video = screen.getByTestId('camera-video') as HTMLVideoElement;
      expect(video).toBeDefined();
      expect(video.autoplay).toBe(true);
      expect(video.hasAttribute('playsinline')).toBe(true);
      expect(video.muted).toBe(true);
    });

    it('attaches MediaStream to video srcObject', () => {
      const mockStream = new MediaStream();
      render(React.createElement(CameraViewport, { stream: mockStream }));
      const video = screen.getByTestId('camera-video') as HTMLVideoElement;
      expect(video.srcObject).toBe(mockStream);
    });

    it('applies mirror style by default and removes it when mirrored is false', () => {
      const { rerender } = render(React.createElement(CameraViewport, { mirrored: true }));
      let video = screen.getByTestId('camera-video');
      expect(video.className).toContain('-scale-x-100');

      rerender(React.createElement(CameraViewport, { mirrored: false }));
      video = screen.getByTestId('camera-video');
      expect(video.className).not.toContain('-scale-x-100');
    });

    it('renders countdown overlay when countdown is active', () => {
      const { rerender } = render(React.createElement(CameraViewport, { countdown: null }));
      expect(screen.queryByTestId('countdown-display')).toBeNull();

      rerender(React.createElement(CameraViewport, { countdown: 3 }));
      const countdown = screen.getByTestId('countdown-display');
      expect(countdown.textContent).toBe('3');

      rerender(React.createElement(CameraViewport, { countdown: 1 }));
      expect(screen.getByTestId('countdown-display').textContent).toBe('1');
    });

    it('renders flash overlay when isFlashing is true', () => {
      const { rerender } = render(React.createElement(CameraViewport, { isFlashing: false }));
      expect(screen.queryByTestId('camera-flash')).toBeNull();

      rerender(React.createElement(CameraViewport, { isFlashing: true }));
      expect(screen.getByTestId('camera-flash')).toBeDefined();
    });

    it('renders slot badge when currentSlot is provided', () => {
      render(React.createElement(CameraViewport, { currentSlot: 2, totalSlots: 4 }));
      const badge = screen.getByTestId('slot-badge');
      expect(badge.textContent).toContain('Slot 2/4');
    });

    it('renders participant label when label is provided', () => {
      render(React.createElement(CameraViewport, { label: 'Host (You)' }));
      const label = screen.getByTestId('viewport-label');
      expect(label.textContent).toBe('Host (You)');
    });

    it('renders camera placeholder when stream is null and showPlaceholder is true', () => {
      render(React.createElement(CameraViewport, { stream: null, showPlaceholder: true }));
      expect(screen.getByTestId('camera-placeholder')).toBeDefined();
    });

    it('forwards ref to the video element for captureVideoFrame access', () => {
      const ref = createRef<HTMLVideoElement>();
      render(React.createElement(CameraViewport, { ref }));
      expect(ref.current).toBeInstanceOf(HTMLVideoElement);
    });
  });
});

