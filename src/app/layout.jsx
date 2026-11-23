import Script from 'next/script';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AppProvider, ThemeProvider } from '@/context';
import { MainLayout } from '@/components/layout';
import { AuthBootstrap } from '@/components/effects/AuthBootstrap';
import { THEMES, DEFAULT_THEME } from '@/lib/themes';

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
    template: '%s'
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

const PRISM_TOKEN_MAP = {
  '--prism-comment': '.token.comment, .token.block-comment, .token.prolog, .token.doctype, .token.cdata',
  '--prism-punctuation': '.token.punctuation, .token.operator',
  '--prism-keyword': '.token.keyword, .token.selector, .token.important, .token.atrule, .token.builtin',
  '--prism-string': '.token.string, .token.char, .token.attr-value, .token.regex, .token.template-string',
  '--prism-function': '.token.function, .token.function-name, .token.class-name',
  '--prism-number': '.token.number, .token.boolean, .token.constant, .token.symbol',
  '--prism-variable': '.token.variable, .token.property, .token.attr-name, .token.tag',
};

const themeStyleSheet = Object.entries(THEMES)
  .map(([id, theme]) => {
    const vars = Object.entries(theme.tokens)
      .map(([k, v]) => `${k}: ${v};`)
      .join('\n  ');

    const editorRules = theme.editor
      ? Object.entries(theme.editor)
        .filter(([token]) => PRISM_TOKEN_MAP[token])
        .map(
          ([token, color]) =>
            `html[data-theme='${id}'] .code-editor ${PRISM_TOKEN_MAP[token]} { color: ${color} !important; }`
        )
        .join('\n')
      : '';

    return `html[data-theme='${id}'] {\n  color-scheme: ${theme.scheme};\n  ${vars}\n}${editorRules ? `\n${editorRules}` : ''}`;
  })
  .join('\n\n');

const themeMapJson = JSON.stringify(
  Object.fromEntries(
    Object.entries(THEMES).map(([id, t]) => [id, { scheme: t.scheme, glint: Boolean(t.glint) }])
  )
);

const themeCheckScript = `
(function() {
  try {
    var saved = localStorage.getItem('recode-theme') || '${DEFAULT_THEME}';
    var themes = ${themeMapJson};
    var active = themes[saved] ? saved : '${DEFAULT_THEME}';
    var root = document.documentElement;
    root.setAttribute('data-theme', active);
    root.setAttribute('data-scheme', themes[active].scheme);
    if (themes[active].glint) {
      root.setAttribute('data-glint', 'true');
    } else {
      root.removeAttribute('data-glint');
    }
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
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <head>
        <style id="theme-tokens" dangerouslySetInnerHTML={{ __html: themeStyleSheet }} />
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
        <AuthBootstrap />

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
}