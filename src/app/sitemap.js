export default function sitemap() {
  const baseUrl = 'https://recode-alpha.vercel.app';

  const routes = [
    '',
    '/code-converter',
    '/code-refactor',
    '/code-analysis',
    '/code-generator',
    '/css-frameworks',
    '/sql-builder',
    '/regex-generator',
    '/json-formatter',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString().split('T')[0],
    changeFrequency: 'monthly',
    priority: route === '' ? 1 : 0.8,
  }));

  return routes;
}
