import Script from 'next/script';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AppProvider, ThemeProvider } from '@/context';
import { MainLayout } from '@/components/layout';

import '@/styles/index.css';
import '@/styles/base.css';
import '@/styles/components.css';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
};

export const metadata = {
  metadataBase: new URL('https://recode-alpha.vercel.app'),
  title: {
    default: 'ReCode | AI Developer Suite',
    template: 'ReCode | %s'
  },
  description: 'Advanced AI tools for code conversion, refactoring, and generation.',
  keywords: ['Code Converter', 'Code Refactor', 'Code Analysis', 'Code Generator', 'CSS Converter', 'Regex Generator', 'SQL Generator', 'JSON Formatter'],
  manifest: '/site.webmanifest',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-96x96.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    url: '/',
    title: 'ReCode | AI Developer Suite',
    description: 'Instantly translate source code between multiple languages. Simplify your migration and boost productivity with AI.',
    siteName: 'ReCode',
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'ReCode | AI Developer Suite',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ReCode | AI-Powered Code Converter',
    description: 'Instantly translate source code between multiple languages. Simplify your migration and boost productivity with AI.',
    images: ['/og-image.png'],
  },
};

const themeCheckScript = `
(function() {
  try {
    var theme = localStorage.getItem('recode-theme') || 'recode-dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

const siteNameJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "ReCode",
  "url": "https://recode-alpha.vercel.app/"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeCheckScript }} />

        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body>
        <ThemeProvider>
          <AppProvider>
            <MainLayout>
              {children}
            </MainLayout>
          </AppProvider>
        </ThemeProvider>

        <Analytics />
        <SpeedInsights />

        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js"
          strategy="beforeInteractive"
        />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteNameJsonLd) }}
        />
      </body>
    </html>
  );
}                                                                                                                                                                                                                                                                                                        // GG