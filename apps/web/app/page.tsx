'use client';

import { useState } from 'react';
import Header from '@/src/components/Header';
import FileUploader from '@/src/components/FileUploader';
import ColorPaletteDisplay from '@/src/components/ColorPaletteDisplay';
import type { ColorPaletteResult } from '@hue-und-you/types';

export default function Home() {
  const [result, setResult] = useState<ColorPaletteResult | null>(null);

  return (
    <div className="min-h-screen w-full bg-var(--background) flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col items-center px-4 pb-20">
        <div className="w-full max-w-2xl">
          <FileUploader
            maxSizeMB={10}
            acceptedTypes={['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']}
            onResultChange={setResult}
          />
        </div>

        {result && <ColorPaletteDisplay result={result} />}
      </main>
    </div>
  );
}
