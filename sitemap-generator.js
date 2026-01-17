import { SitemapStream, streamToPromise } from 'sitemap';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const YOUR_DOMAIN = 'https://recode-alpha.vercel.app/';

// Add new routes here as your SPA grows
const links = [
    { url: '/', changefreq: 'daily', priority: 1.0, lastmod: new Date().toISOString() },
    { url: '/favicon.ico', changefreq: 'monthly', priority: 0.9 },
    // Example: { url: '/about', changefreq: 'monthly', priority: 0.8 },
];

async function generateSitemap() {
    const distDir = resolve(__dirname, 'dist');
    const sitemapPath = resolve(distDir, 'sitemap.xml');

    if (!existsSync(distDir)) {
        mkdirSync(distDir, { recursive: true });
    }

    const smStream = new SitemapStream({ hostname: YOUR_DOMAIN });

    for (const link of links) {
        smStream.write(link);
    }
    smStream.end();

    const sitemapOutput = await streamToPromise(smStream);
    writeFileSync(sitemapPath, sitemapOutput);

    console.log('✅ Sitemap successfully generated at:', sitemapPath);
}

generateSitemap().catch(console.error);