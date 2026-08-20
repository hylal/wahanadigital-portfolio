import type { APIRoute } from 'astro';
import { client } from '../lib/graphql';

export const get: APIRoute = async () => {
  const baseUrl = 'https://wahanadigital.com';
  
  // Static pages
  const staticPages = [
    '/',
    '/about',
    '/portfolio',
    '/contact',
    '/blog'
  ];
  
  let blogPosts = [];
  try {
    const data = await client.request(`
      query GetSitemapPosts {
        posts(first: 100) {
          nodes {
            slug
            date
          }
        }
      }
    `);
    blogPosts = data.posts.nodes.map((post: any) => `/blog/${post.slug}`);
  } catch (error) {
    console.error('Failed to fetch posts for sitemap:', error);
  }
  
  const allUrls = [...staticPages, ...blogPosts];
  
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${allUrls.map(url => `
    <url>
      <loc>${baseUrl}${url}</loc>
      <lastmod>${new Date().toISOString()}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>${url === '/' ? '1.0' : '0.8'}</priority>
    </url>
  `).join('')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
};