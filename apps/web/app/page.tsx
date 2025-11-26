'use client';

import { useState, useCallback } from 'react';
import Header from '@/src/components/Header';
import FileUploader from '@/src/components/FileUploader';
import ColorPaletteDisplay from '@/src/components/ColorPaletteDisplay';
import ImagePreview from '@/src/components/ImagePreview';
import type { ColorPaletteResult } from '@hue-und-you/types';

export default function HomePage() {
  const [result, setResult] = useState<ColorPaletteResult | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  const handleResultChange = useCallback((newResult: ColorPaletteResult | null) => {
    setResult(newResult);
  }, []);

  const handlePreviewChange = useCallback((newPreview: string | null) => {
    setPreviewSrc(newPreview);
  }, []);

  return (
    <div className="min-h-screen w-full bg-(--background) flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col items-center px-4 pb-20">
        <div className="w-full max-w-5xl space-y-8">
          {/* Upload Section */}
          <section
            className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]"
            aria-label="Image upload and preview"
          >
            <FileUploader
              maxSizeMB={10}
              acceptedTypes={['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']}
              onResultChange={handleResultChange}
              onPreviewChange={handlePreviewChange}
            />
            <ImagePreview imageSrc={previewSrc} />
          </section>

          {/* Results Section */}
          {result && (
            <section aria-label="Color palette results">
              <ColorPaletteDisplay result={result} />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
