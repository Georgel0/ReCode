import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AppProvider, ThemeProvider } from '@/context';
import { MainLayout } from '@/components/layout'; 

import '@/styles/index.css';
import '@/styles/Components.css';
import '@/styles/Sidebar.css';
import '@/styles/Modules.css';

export const metadata = {
  title: {
    default: 'ReCode | AI Developer Suite',
    template: 'ReCode | %s' 
  },
  description: 'Advanced AI tools for code conversion, refactoring, and generation.',
  keywords: ['Code Converter', 'Code Refactor', 'Code Analysis', 'Code Generator', 'CSS Converter', 'Regex Generator', 'SQL Generator', 'JSON Formatter'],
};

const themeCheckScript = `
(function() {
  try {
    var theme = localStorage.getItem('recode-theme');
    var supportDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (!theme) {
      theme = supportDarkMode ? 'recode-dark' : 'classic-light';
    }
    
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;


export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="shortcut icon" sizes="96x96" href="/favicon-96x96.png" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="manifest" href="/site.webmanifest" />
        
        <link 
          rel="stylesheet" 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" 
          integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" 
          crossOrigin="anonymous" 
          referrerPolicy="no-referrer" 
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://recode-alpha.vercel.app/" />
        <meta property="og:title" content="ReCode | AI Developer Suite" />
        <meta property="og:description" content="Instantly translate source code between multiple languages. Simplify your migration and boost productivity with AI." />
        <meta property="og:image" content="https://recode-alpha.vercel.app/og-image.png" />
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://recode-alpha.vercel.app/" />
        <meta property="twitter:title" content="ReCode | AI-Powered Code Converter" />
        <meta property="twitter:description" content="Instantly translate source code between multiple languages. Simplify your migration and boost productivity with AI." />
        <meta property="twitter:image" content="https://recode-alpha.vercel.app/og-image.png" />
        
        <script dangerouslySetInnerHTML={{ __html: themeCheckScript }} />
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
      </body>
    </html>
  );
}