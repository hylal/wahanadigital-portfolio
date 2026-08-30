import { client } from './graphql.ts';
import fs from 'fs';
import path from 'path';

export interface Post {
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  date: string;
  featuredImage?: {
    sourceUrl: string;
    altText: string;
    mediaDetails?: {
      width: number;
      height: number;
    };
  };
  author?: {
    node: {
      name: string;
    };
  };
}

const CACHE_DIR = path.join(process.cwd(), 'src/data');
const CACHE_FILE = path.join(CACHE_DIR, 'posts-cache.json');
const CACHE_META_FILE = path.join(CACHE_DIR, 'posts-cache-meta.json');

interface CacheMeta {
  fetchedAt: string;
  count: number;
  source: 'api' | 'fallback';
}

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function readCache(): { posts: Post[]; meta: CacheMeta } | null {
  try {
    if (!fs.existsSync(CACHE_FILE) || !fs.existsSync(CACHE_META_FILE)) {
      return null;
    }
    const posts = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    const meta = JSON.parse(fs.readFileSync(CACHE_META_FILE, 'utf-8'));
    return { posts, meta };
  } catch {
    return null;
  }
}

function writeCache(posts: Post[], source: 'api' | 'fallback') {
  ensureCacheDir();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(posts, null, 2));
  fs.writeFileSync(CACHE_META_FILE, JSON.stringify({
    fetchedAt: new Date().toISOString(),
    count: posts.length,
    source
  }, null, 2));
}

// Background async refresh from API
async function backgroundRefresh() {
  try {
    const query = `
      query GetAllPosts {
        posts(first: 100) {
          nodes {
            slug
            title
            excerpt
            content
            date
            featuredImage {
              node {
                sourceUrl
                altText
                mediaDetails {
                  width
                  height
                }
              }
            }
            author {
              node {
                name
              }
            }
          }
        }
      }
    `;
    const data = await client.request(query);
    const posts = data?.posts?.nodes || [];
    if (posts.length > 0) {
      writeCache(posts, 'api');
    }
  } catch {
    // ignore
  }
}

export async function getAllPosts(): Promise<Post[]> {
  const cached = readCache();
  backgroundRefresh();

  if (cached && cached.posts.length > 0) {
    return cached.posts;
  }

  try {
    const query = `
      query GetAllPosts {
        posts(first: 100) {
          nodes {
            slug
            title
            excerpt
            content
            date
            featuredImage {
              node {
                sourceUrl
                altText
                mediaDetails {
                  width
                  height
                }
              }
            }
            author {
              node {
                name
              }
            }
          }
        }
      }
    `;
    const data = await client.request(query);
    const posts = data?.posts?.nodes || [];
    if (posts.length > 0) {
      writeCache(posts, 'api');
      return posts;
    }
  } catch (error) {
    console.warn('[posts] Failed to fetch initial posts:', error instanceof Error ? error.message : error);
  }

  return [];
}

export async function getLatestPosts(limit = 3): Promise<Post[]> {
  const posts = await getAllPosts();
  return posts.slice(0, limit);
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const posts = await getAllPosts();
  const found = posts.find(p => p.slug === slug);
  if (found && found.content) {
    return found;
  }

  // Jika tidak ada content-nya di cache, coba fetch spesifik ke API
  try {
    const query = `
      query GetPostBySlug($slug: ID!) {
        post(id: $slug, idType: SLUG) {
          title
          content
          date
          excerpt
          featuredImage {
            node {
              sourceUrl
              altText
            }
          }
          author {
            node {
              name
            }
          }
        }
      }
    `;
    const data = await client.request(query, { slug });
    if (data?.post) {
      return data.post;
    }
  } catch {
    // ignore
  }

  // Kalau gagal juga, return found (meskipun tanpa content lengkap, daripada 404)
  return found || null;
}

export async function refreshCache(): Promise<void> {
  console.log('[posts] Refreshing cache from API with full content...');
  try {
    const query = `
      query GetAllPosts {
        posts(first: 100) {
          nodes {
            slug
            title
            excerpt
            content
            date
            featuredImage {
              node {
                sourceUrl
                altText
                mediaDetails {
                  width
                  height
                }
              }
            }
            author {
              node {
                name
              }
            }
          }
        }
      }
    `;
    const data = await client.request(query);
    const posts = data?.posts?.nodes || [];
    if (posts.length > 0) {
      writeCache(posts, 'api');
      console.log(`[posts] Cache refreshed successfully with ${posts.length} posts (including content).`);
    } else {
      console.warn('[posts] API returned 0 posts.');
    }
  } catch (error) {
    console.error('[posts] Failed to refresh cache:', error instanceof Error ? error.message : error);
  }
}