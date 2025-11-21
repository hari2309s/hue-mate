'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, ToasterProps } from 'sonner';
import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert } from 'lucide-react';

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      icons={{
        success: <CircleCheck className="size-4" />,
        info: <Info className="size-4" />,
        warning: <TriangleAlert className="size-4" />,
        error: <OctagonX className="size-4" />,
        loading: <Loader2 className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-[var(--card)] group-[.toaster]:text-[var(--card-foreground)] group-[.toaster]:border-[var(--border)] group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-[var(--muted-foreground)]',
          actionButton: 'group-[.toast]:bg-soft-orange group-[.toast]:text-white',
          cancelButton:
            'group-[.toast]:bg-[var(--muted)] group-[.toast]:text-[var(--muted-foreground)]',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
