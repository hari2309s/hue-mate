import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { ThemeProvider } from '@/src/components/ThemeProvider';
import { Toaster } from '@/src/components/Toaster';
import ThemeSwitcher from '@/src/components/ThemeSwitcher';
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: 'hue-und-you',
  description: 'ML-driven perceptual color extractor',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          {children}
          <ThemeSwitcher />
          <Toaster richColors closeButton position="top-right" />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
