import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'hue-und-you',
  description: 'ML-driven perceptual color extractor',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
