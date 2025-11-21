import Header from '@/src/components/Header';
import FileUploader from '@/src/components/FileUploader';

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-(--background) flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
        <div className="w-full max-w-2xl">
          <FileUploader
            maxSizeMB={10}
            acceptedTypes={['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']}
          />
        </div>
      </main>
    </div>
  );
}
