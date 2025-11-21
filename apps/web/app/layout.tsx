import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/src/components/ThemeProvider';
import { Toaster } from '@/src/components/Toaster';
import ThemeSwitcher from '@/src/components/ThemeSwitcher';

export const metadata: Metadata = {
  title: 'hue-und-you',
  description: 'ML-driven perceptual color extractor',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
          <Toaster richColors closeButton position="bottom-left" />
        </ThemeProvider>
      </body>
    </html>
  );
}
