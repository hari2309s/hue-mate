'use client';

import Header from '@/src/components/Header';
import FileUploader from '@/src/components/FileUploader';
import ColorPaletteDisplay from '@/src/components/ColorPaletteDisplay';
import ImagePreview from '@/src/components/ImagePreview';
import { useAppStore } from '@/src/stores/useAppStore';

export default function HomePage() {
  const result = useAppStore((state) => state.result);
  const previewSrc = useAppStore((state) => state.previewSrc);

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
