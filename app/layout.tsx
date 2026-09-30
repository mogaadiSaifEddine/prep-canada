import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AppProvider } from '@/components/app/AppProvider';
import { Frame } from '@/components/app/Frame';
import { BOOT_SCRIPT } from '@/lib/client/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Prep Canada',
  description: 'IELTS General Training and TEF Canada coach: placement tests, a personal course and unlimited mock tests at your level.',
  manifest: '/manifest.webmanifest',
  icons: { icon: [{ url: '/icons/icon-192.png', type: 'image/png' }], apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Prep Canada' }
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#F5F7FB' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-exam="ielts" suppressHydrationWarning>
      <head>
        {/* Theme, language and direction before first paint (no flash of the wrong theme) */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        <link rel="preload" href="/fonts/geist-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>
        <AppProvider>
          <Frame>{children}</Frame>
        </AppProvider>
      </body>
    </html>
  );
}
