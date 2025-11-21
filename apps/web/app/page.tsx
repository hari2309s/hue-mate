import Header from '@/src/components/Header';
import FileDropzone from '@/src/components/FileUploader';

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-(--background) flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-(--foreground) mb-2">Upload Your Images</h2>
            <p className="text-(--muted-foreground)">
              Drop your images to extract beautiful color palettes
            </p>
          </div>
          <FileDropzone
            maxSizeMB={10}
            acceptedTypes={['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']}
          />
        </div>
      </main>
    </div>
  );
}
