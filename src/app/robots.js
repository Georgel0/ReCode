export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/favicon.ico'],
      },
    ],
    sitemap: 'https://recode-alpha.vercel.app/sitemap.xml',
  };
}