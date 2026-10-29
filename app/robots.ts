import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.APP_URL || 'https://safetyalchemist.com').replace(/\/$/, '');
  return {
    rules: [
      {
        userAgent: ['*', 'GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended'],
        allow: ['/', '/login', '/signup', '/portal'],
        disallow: ['/api/', '/today', '/schedule', '/inspections', '/recommendations', '/members', '/team', '/brand', '/billing', '/platform'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

