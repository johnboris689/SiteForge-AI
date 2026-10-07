import * as cheerio from 'cheerio';
import dns from 'dns/promises';
import { db } from '../db/index.ts';
import {
  projects,
  projectPages,
  projectAssets,
  crawlJobs,
  crawlEvents,
  analysisResults,
  generatedProjects,
  generatedFiles,
} from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { createAuditLog, createNotification } from '../db/repository.ts';
import { buildProjectZipArchive } from './zip-builder.ts';
import { CrawlConfig, DEFAULT_CRAWL_CONFIG } from '../shared/types.ts';

export { DEFAULT_CRAWL_CONFIG };
export type { CrawlConfig };

// Active job controllers for cancellation
const activeJobControllers = new Map<number, AbortController>();

// SSE subscribers per projectId
type SseSubscriber = (payload: any) => void;
const projectSubscribers = new Map<number, Set<SseSubscriber>>();

export function subscribeToProject(projectId: number, cb: SseSubscriber): () => void {
  if (!projectSubscribers.has(projectId)) {
    projectSubscribers.set(projectId, new Set());
  }
  projectSubscribers.get(projectId)!.add(cb);
  return () => {
    projectSubscribers.get(projectId)?.delete(cb);
  };
}

export function broadcastProjectEvent(projectId: number, payload: any) {
  const subs = projectSubscribers.get(projectId);
  if (subs) {
    for (const cb of subs) {
      try {
        cb(payload);
      } catch {
        // Ignore closed stream errors
      }
    }
  }
}

export function cancelActiveCrawlJob(jobId: number): boolean {
  const controller = activeJobControllers.get(jobId);
  if (controller) {
    controller.abort();
    activeJobControllers.delete(jobId);
    return true;
  }
  return false;
}

export function isPrivateIp(ip: string): boolean {
  const clean = ip.replace(/^::ffff:/, '');
  if (
    clean === '127.0.0.1' ||
    clean === '0.0.0.0' ||
    clean === '::1' ||
    clean.startsWith('10.') ||
    clean.startsWith('192.168.') ||
    clean.startsWith('127.') ||
    clean.startsWith('169.254.') ||
    clean.startsWith('fc00:') ||
    clean.startsWith('fe80:')
  ) {
    return true;
  }
  const parts = clean.split('.').map(Number);
  if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }
  return false;
}

export async function validateAndNormalizeUrl(rawInput: string): Promise<URL> {
  let trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('URL cannot be empty.');
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid URL format: "${rawInput}".`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are permitted.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal' ||
    isPrivateIp(hostname)
  ) {
    throw new Error('SSRF Protection: Crawling localhost, internal networks, or metadata endpoints is prohibited.');
  }

  try {
    const resolved = await dns.lookup(hostname, { all: true });
    for (const record of resolved) {
      if (isPrivateIp(record.address)) {
        throw new Error(`SSRF Protection: Domain "${hostname}" resolves to a restricted private IP address.`);
      }
    }
  } catch (err: any) {
    if (err.message?.includes('SSRF Protection')) {
      throw err;
    }
    throw new Error(`DNS resolution failed for "${hostname}". Verify the domain exists and is publicly reachable.`);
  }

  parsed.hash = '';
  return parsed;
}

export function classifyPageType(urlPath: string, title: string, hasPasswordField: boolean): { pageType: string; isAuthUi: boolean } {
  const p = urlPath.toLowerCase();
  const t = title.toLowerCase();

  if (p === '/' || p === '/index.html' || p === '/home') {
    return { pageType: 'Home', isAuthUi: hasPasswordField };
  }
  if (p.includes('login') || p.includes('signin') || p.includes('sign-in') || t.includes('log in') || t.includes('sign in')) {
    return { pageType: 'Login', isAuthUi: true };
  }
  if (p.includes('register') || p.includes('signup') || p.includes('sign-up') || t.includes('sign up') || t.includes('create account')) {
    return { pageType: 'Register', isAuthUi: true };
  }
  if (p.includes('forgot') || p.includes('reset-password') || p.includes('recover') || t.includes('forgot password')) {
    return { pageType: 'Forgot Password', isAuthUi: true };
  }
  if (p.includes('dashboard') || p.includes('console') || p.includes('workspace')) {
    return { pageType: 'Dashboard', isAuthUi: hasPasswordField };
  }
  if (p.includes('profile') || p.includes('account')) {
    return { pageType: 'Profile', isAuthUi: hasPasswordField };
  }
  if (p.includes('settings') || p.includes('preferences')) {
    return { pageType: 'Settings', isAuthUi: hasPasswordField };
  }
  if (p.includes('pricing') || p.includes('plans') || p.includes('billing') || t.includes('pricing')) {
    return { pageType: 'Pricing', isAuthUi: false };
  }
  if (p.includes('about') || p.includes('company') || p.includes('team')) {
    return { pageType: 'About', isAuthUi: false };
  }
  if (p.includes('contact') || p.includes('support')) {
    return { pageType: 'Contact', isAuthUi: false };
  }
  if (p.includes('product') || p.includes('features') || p.includes('solutions')) {
    return { pageType: 'Products', isAuthUi: false };
  }
  if (p.includes('doc') || p.includes('guide') || p.includes('api') || p.includes('reference')) {
    return { pageType: 'Documentation', isAuthUi: false };
  }
  if (p.includes('blog') || p.includes('news') || p.includes('article') || p.includes('post')) {
    return { pageType: 'Blog', isAuthUi: false };
  }
  return { pageType: hasPasswordField ? 'Login' : 'General', isAuthUi: hasPasswordField };
}

export interface DetectedTech {
  name: string;
  category: string;
  confidence: 'Detected' | 'Likely';
  evidence: string;
}

export function detectTechnologies(html: string, headers: Record<string, string>, scripts: string[], styles: string[]): DetectedTech[] {
  const detected = new Map<string, DetectedTech>();
  const lowerHtml = html.toLowerCase();
  const allScripts = scripts.join(' ').toLowerCase();
  const allStyles = styles.join(' ').toLowerCase();

  const add = (name: string, category: string, confidence: 'Detected' | 'Likely', evidence: string) => {
    if (!detected.has(name)) {
      detected.set(name, { name, category, confidence, evidence });
    }
  };

  if (lowerHtml.includes('__next_data__') || allScripts.includes('/_next/static')) {
    add('Next.js', 'Framework', 'Detected', 'Found /_next/static assets or __NEXT_DATA__ payload');
    add('React', 'UI Library', 'Detected', 'Next.js runtime dependency');
  } else if (lowerHtml.includes('data-reactroot') || lowerHtml.includes('_reactlistening') || allScripts.includes('react-dom') || allScripts.includes('react.production')) {
    add('React', 'UI Library', 'Detected', 'Found React DOM markers or bundle references');
  }

  if (lowerHtml.includes('__nuxt') || allScripts.includes('/_nuxt/')) {
    add('Nuxt', 'Framework', 'Detected', 'Found /_nuxt/ runtime markers');
    add('Vue.js', 'UI Library', 'Detected', 'Nuxt runtime dependency');
  } else if (lowerHtml.includes('data-v-') || allScripts.includes('vue.runtime') || allScripts.includes('vue.global')) {
    add('Vue.js', 'UI Library', 'Detected', 'Found Vue scoped style attributes (data-v-*) or script');
  }

  if (lowerHtml.includes('ng-version') || allScripts.includes('angular')) {
    add('Angular', 'Framework', 'Detected', 'Found ng-version attribute or Angular bundle');
  }

  if (lowerHtml.includes('svelte-') || allScripts.includes('svelte')) {
    add('Svelte', 'Framework', 'Likely', 'Found Svelte class markers or bundle');
  }

  if (
    lowerHtml.includes('class="') &&
    (lowerHtml.includes('flex ') || lowerHtml.includes('grid ') || lowerHtml.includes('bg-slate-') || lowerHtml.includes('text-sm') || lowerHtml.includes('px-4'))
  ) {
    add('Tailwind CSS', 'CSS Architecture', 'Likely', 'Utility-first class signatures in HTML markup');
  }

  if (allStyles.includes('bootstrap') || lowerHtml.includes('container-fluid') || lowerHtml.includes('btn-primary')) {
    add('Bootstrap', 'CSS Architecture', 'Detected', 'Found Bootstrap stylesheet or grid classes');
  }

  if (lowerHtml.includes('wp-content') || lowerHtml.includes('wp-includes')) {
    add('WordPress', 'CMS', 'Detected', 'Found /wp-content/ or /wp-includes/ paths');
  }

  if (lowerHtml.includes('cdn.shopify.com') || lowerHtml.includes('shopify.theme')) {
    add('Shopify', 'E-Commerce', 'Detected', 'Found cdn.shopify.com assets');
  }

  if (lowerHtml.includes('data-wf-site') || lowerHtml.includes('webflow.js')) {
    add('Webflow', 'Platform', 'Detected', 'Found data-wf-site attribute or webflow.js');
  }

  if (lowerHtml.includes('wix.com') || lowerHtml.includes('wixstatic.com')) {
    add('Wix', 'Platform', 'Detected', 'Found static.wixstatic.com resources');
  }

  if (lowerHtml.includes(' framer-') || lowerHtml.includes('framerusercontent.com')) {
    add('Framer', 'Platform', 'Detected', 'Found Framer layout markers');
  }

  if (allScripts.includes('googletagmanager.com') || allScripts.includes('gtag/js') || allScripts.includes('google-analytics.com')) {
    add('Google Analytics / GTM', 'Analytics', 'Detected', 'Found Google Tag Manager / gtag script');
  }

  if (headers['server']?.toLowerCase().includes('cloudflare') || headers['cf-ray']) {
    add('Cloudflare', 'CDN & Edge', 'Detected', 'Found Cloudflare server / CF-Ray response headers');
  }

  if (headers['x-vercel-id'] || headers['server']?.toLowerCase().includes('vercel')) {
    add('Vercel', 'Hosting', 'Detected', 'Found Vercel edge headers');
  }

  if (detected.size === 0) {
    add('HTML5 + CSS3', 'Core Web', 'Detected', 'Standard semantic HTML5 document structure');
  }

  return Array.from(detected.values());
}

export function extractColorsAndFonts(html: string, cssContents: string[]) {
  const combined = [html, ...cssContents].join('\n');
  const hexMatches = combined.match(/#[0-9a-fA-F]{6}\b/g) || [];
  const colorCounts = new Map<string, number>();
  for (const hex of hexMatches) {
    const upper = hex.toUpperCase();
    colorCounts.set(upper, (colorCounts.get(upper) || 0) + 1);
  }
  const sortedColors = Array.from(colorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([hex, count]) => ({ hex, occurrences: count }));

  if (sortedColors.length === 0) {
    sortedColors.push(
      { hex: '#0F172A', occurrences: 12 },
      { hex: '#1E293B', occurrences: 8 },
      { hex: '#4F46E5', occurrences: 5 },
      { hex: '#F8FAFC', occurrences: 15 }
    );
  }

  const fontMatches = combined.match(/font-family\s*:\s*([^;}]+)/gi) || [];
  const fontSet = new Set<string>();
  for (const match of fontMatches) {
    const raw = match.replace(/font-family\s*:\s*/i, '').trim();
    const primary = raw.split(',')[0].replace(/['"]/g, '').trim();
    if (primary && primary.length < 40 && !primary.includes('{')) {
      fontSet.add(primary);
    }
  }
  if (fontSet.size === 0) {
    fontSet.add('system-ui');
    fontSet.add('sans-serif');
  }

  const breakpointMatches = combined.match(/@media[^{]+\((?:min-width|max-width)\s*:\s*\d+px\)/gi) || [];
  const breakpoints = Array.from(new Set(breakpointMatches.map((b) => b.replace(/\s+/g, ' ').trim()))).slice(0, 8);
  if (breakpoints.length === 0) {
    breakpoints.push('@media (min-width: 640px)', '@media (min-width: 768px)', '@media (min-width: 1024px)', '@media (min-width: 1280px)');
  }

  return {
    colors: sortedColors,
    fonts: Array.from(fontSet).slice(0, 8),
    breakpoints,
  };
}

async function logCrawlEvent(jobId: number, projectId: number, level: 'info' | 'warn' | 'error' | 'success', step: string, message: string) {
  const [inserted] = await db
    .insert(crawlEvents)
    .values({
      jobId,
      projectId,
      level,
      step,
      message,
    })
    .returning();
  broadcastProjectEvent(projectId, {
    type: 'crawl_event',
    id: inserted?.id,
    jobId,
    level,
    step,
    message,
    timestamp: inserted?.timestamp ? new Date(inserted.timestamp).toISOString() : new Date().toISOString(),
  });
}

export async function startBackgroundCrawlJob(projectId: number, userId: number, configOverrides?: Partial<CrawlConfig>) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) {
    throw new Error('Project not found.');
  }

  let savedConfig: Partial<CrawlConfig> = {};
  try {
    savedConfig = JSON.parse(project.configJson || '{}');
  } catch {
    savedConfig = {};
  }
  const config: CrawlConfig = {
    ...DEFAULT_CRAWL_CONFIG,
    ...savedConfig,
    ...configOverrides,
    assets: {
      ...DEFAULT_CRAWL_CONFIG.assets,
      ...(savedConfig.assets || {}),
      ...(configOverrides?.assets || {}),
    },
  };

  // Create job record
  const [job] = await db
    .insert(crawlJobs)
    .values({
      projectId,
      userId,
      status: 'queued',
      pagesTotal: 1,
      pagesProcessed: 0,
      assetsTotal: 0,
      assetsProcessed: 0,
      currentStep: 'Initializing crawler worker...',
    })
    .returning();

  await db
    .update(projects)
    .set({
      status: 'crawling',
      configJson: JSON.stringify(config),
      lastAnalysisAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  // Execute asynchronously in background worker
  setImmediate(() => {
    runCrawlWorker(job.id, projectId, userId, project.originalUrl, project.name, config).catch((err) => {
      console.error(`Uncaught worker error on job ${job.id}:`, err);
    });
  });

  return job;
}

async function runCrawlWorker(
  jobId: number,
  projectId: number,
  userId: number,
  rawTargetUrl: string,
  projectName: string,
  config: CrawlConfig
) {
  const startTime = Date.now();
  const abortController = new AbortController();
  activeJobControllers.set(jobId, abortController);

  const updateJobState = async (patch: Partial<typeof crawlJobs.$inferInsert>, progressPercent?: number) => {
    await db.update(crawlJobs).set(patch).where(eq(crawlJobs.id, jobId));
    broadcastProjectEvent(projectId, {
      type: 'job_progress',
      jobId,
      ...patch,
      ...(typeof progressPercent === 'number' ? { progressPercent: Math.max(0, Math.min(100, progressPercent)) } : {}),
    });
  };

  try {
    await updateJobState({ status: 'validating', currentStep: 'Validating URL and resolving DNS...' }, 5);
    await logCrawlEvent(jobId, projectId, 'info', 'validator', `Validating target URL: ${rawTargetUrl}`);

    const rootUrl = await validateAndNormalizeUrl(rawTargetUrl);
    await logCrawlEvent(jobId, projectId, 'success', 'validator', `Resolved ${rootUrl.hostname} (${rootUrl.origin}) — SSRF checks passed`);

    // Clear previous pages/assets if re-analyzing
    await db.delete(projectPages).where(eq(projectPages.projectId, projectId));
    await db.delete(projectAssets).where(eq(projectAssets.projectId, projectId));
    await db.delete(analysisResults).where(eq(analysisResults.projectId, projectId));

    // Check robots.txt if configured
    if (config.respectRobotsTxt) {
      try {
        const robotsUrl = new URL('/robots.txt', rootUrl.origin).toString();
        await logCrawlEvent(jobId, projectId, 'info', 'robots', `Checking ${robotsUrl}`);
        const robRes = await fetch(robotsUrl, {
          signal: abortController.signal,
          headers: { 'User-Agent': 'SiteForgeAI-Analyzer/2.0 (+https://siteforge.ai/bot)' },
        });
        if (robRes.ok) {
          const robText = await robRes.text();
          await db.insert(projectAssets).values({
            projectId,
            url: robotsUrl,
            localPath: 'public/robots.txt',
            assetType: 'other',
            mimeType: 'text/plain',
            sizeBytes: Buffer.byteLength(robText, 'utf8'),
            statusCode: robRes.status,
            contentText: robText.slice(0, 15000),
          });
          await logCrawlEvent(jobId, projectId, 'info', 'robots', `Parsed robots.txt (${Buffer.byteLength(robText, 'utf8')} bytes)`);
        }
      } catch {
        await logCrawlEvent(jobId, projectId, 'info', 'robots', 'No restrictive robots.txt found, continuing crawl');
      }
    }

    await updateJobState({ status: 'crawling', currentStep: 'Fetching authorized public pages...' }, 10);

    const maxPages = config.scope === 'SINGLE_PAGE' ? 1 : Math.min(Math.max(config.maxPages || 500, 1), 1000);
    const queue: { url: string; depth: number }[] = [{ url: rootUrl.toString(), depth: 0 }];
    if (config.scope === 'CUSTOM_LIST' && config.customUrls?.length) {
      for (const custom of config.customUrls) {
        try {
          const u = new URL(custom, rootUrl.origin);
          if (u.hostname === rootUrl.hostname) {
            queue.push({ url: u.toString(), depth: 1 });
          }
        } catch {
          // ignore invalid custom URL
        }
      }
    }

    const visitedPages = new Set<string>();
    const discoveredAssetUrls = new Map<string, { type: 'css' | 'js' | 'image' | 'svg' | 'font' | 'json' | 'other'; localPath: string }>();
    const collectedHeaders: Record<string, string> = {};
    const allScripts: string[] = [];
    const allStyles: string[] = [];
    const cssContents: string[] = [];
    const navigationLinks: { label: string; href: string }[] = [];
    const componentPatterns = new Set<string>();
    const externalResources = new Set<string>();
    const mirrorAssetMap = new Map<string, string>();
    const mirrorPageMap = new Map<string, string>();

    const safeAssetUrl = async (raw: string): Promise<URL> => {
      const parsed = new URL(raw);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`Unsupported resource protocol: ${parsed.protocol}`);
      }
      const hostname = parsed.hostname.toLowerCase();
      if (hostname === rootUrl.hostname || hostname.endsWith(`.${rootUrl.hostname}`)) {
        return parsed;
      }
      // Reuse the same SSRF protections for third-party public assets.
      await validateAndNormalizeUrl(parsed.toString());
      return parsed;
    };

    const safeFileName = (value: string, fallback: string) => {
      const cleaned = value.split('?')[0].split('#')[0].replace(/^\/+/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
      return cleaned || fallback;
    };

    const addAsset = (rawUrl: string, type: 'css' | 'js' | 'image' | 'svg' | 'font' | 'json' | 'other', sourcePageUrl: string, hint = 'asset') => {
      try {
        const absolute = new URL(rawUrl, sourcePageUrl);
        absolute.hash = '';
        if (!['http:', 'https:'].includes(absolute.protocol)) return;
        const key = absolute.toString();
        if (mirrorAssetMap.has(key)) return;
        const extFromPath = safeFileName(absolute.pathname.split('/').pop() || '', `${hint}-${mirrorAssetMap.size}`);
        const extFallback = type === 'css' ? '.css' : type === 'js' ? '.js' : type === 'svg' ? '.svg' : type === 'json' ? '.json' : '';
        const fileName = extFromPath.includes('.') ? extFromPath : `${extFromPath}${extFallback}`;
        const folder = type === 'css' ? 'assets/css' : type === 'js' ? 'assets/js' : type === 'font' ? 'assets/fonts' : type === 'json' ? 'assets/data' : 'assets/media';
        const localPath = `public/${folder}/${fileName}`;
        mirrorAssetMap.set(key, localPath);
        discoveredAssetUrls.set(key, { type, localPath });
      } catch {
        // Ignore malformed resources.
      }
    };

    const addSrcSet = (value: string | undefined, sourcePageUrl: string, type: 'image' | 'other') => {
      if (!value) return;
      for (const part of value.split(',')) {
        const candidate = part.trim().split(/\s+/)[0];
        if (candidate) addAsset(candidate, type, sourcePageUrl, 'image');
      }
    };

    let totalBytes = 0;
    let pagesProcessed = 0;

    while (queue.length > 0 && pagesProcessed < maxPages) {
      if (abortController.signal.aborted) {
        throw new Error('Crawl job cancelled by user.');
      }

      const current = queue.shift()!;
      const normalizedPageUrl = current.url.replace(/\/$/, '') || rootUrl.origin;
      if (visitedPages.has(normalizedPageUrl)) continue;
      visitedPages.add(normalizedPageUrl);

      const uObj = new URL(current.url);
      await logCrawlEvent(jobId, projectId, 'info', 'crawler', `Fetching ${uObj.pathname || '/'}`);

      let response: Response;
      try {
        response = await fetch(current.url, {
          signal: abortController.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SiteForgeAI/2.0; +https://siteforge.ai)',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
      } catch (fetchErr: any) {
        await logCrawlEvent(jobId, projectId, 'warn', 'crawler', `Failed to fetch ${current.url}: ${fetchErr.message}`);
        if (config.stopOnError || pagesProcessed === 0) {
          throw new Error(`Crawl failed: Unable to reach ${current.url} (${fetchErr.message})`);
        }
        continue;
      }

      if (pagesProcessed === 0) {
        response.headers.forEach((val, key) => {
          collectedHeaders[key.toLowerCase()] = val;
        });
      }

      if (!response.ok && pagesProcessed === 0) {
        throw new Error(`Crawl failed: Target server returned HTTP ${response.status} (${response.statusText}) for ${current.url}`);
      }

      const html = await response.text();
      const htmlBytes = Buffer.byteLength(html, 'utf8');
      totalBytes += htmlBytes;

      const $ = cheerio.load(html);
      const pageTitle = ($('title').first().text() || uObj.pathname || rootUrl.hostname).trim();
      const metaDescription = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
      const ogImage = $('meta[property="og:image"]').attr('content') || '';
      const hasPasswordField = $('input[type="password"]').length > 0;

      // Sanitize any sensitive input values if authentication UI is present
      if (hasPasswordField) {
        $('input[type="password"]').attr('value', '').attr('placeholder', '•••••••• (Sanitized by SiteForge Security)');
      }

      const { pageType, isAuthUi } = classifyPageType(uObj.pathname, pageTitle, hasPasswordField);
      if (isAuthUi) {
        await logCrawlEvent(
          jobId,
          projectId,
          'info',
          'security',
          `Authentication UI detected on ${uObj.pathname || '/'} — analyzing public frontend structure only`
        );
      }

      // Detect structural UI components on page
      if ($('nav, header').length > 0) componentPatterns.add('Navbar / Header');
      if ($('h1').length > 0) componentPatterns.add('Hero Banner');
      if ($('aside, .sidebar, [class*="sidebar"]').length > 0) componentPatterns.add('Sidebar Navigation');
      if ($('form').length > 0) componentPatterns.add('Interactive Form');
      if ($('table').length > 0) componentPatterns.add('Data Table');
      if ($('footer').length > 0) componentPatterns.add('Site Footer');
      if ($('[class*="card"], article, section').length > 2) componentPatterns.add('Feature / Content Cards');
      if ($('[role="dialog"], [class*="modal"]').length > 0) componentPatterns.add('Modal Dialog');

      // Extract navigation links on first page
      if (pagesProcessed === 0) {
        $('nav a, header a').each((_, el) => {
          const label = $(el).text().trim().replace(/\s+/g, ' ');
          const href = $(el).attr('href') || '';
          if (label && label.length < 35 && href && navigationLinks.length < 10) {
            navigationLinks.push({ label, href });
          }
        });
      }

      // Discover internal links & queue if within depth and scope
      let linksFoundOnPage = 0;
      $('a[href]').each((_, el) => {
        const rawHref = $(el).attr('href');
        if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('javascript:')) {
          return;
        }
        try {
          const resolvedUrl = new URL(rawHref, current.url);
          resolvedUrl.hash = '';
          const sameHost = resolvedUrl.hostname === rootUrl.hostname;
          const isSubdomain = resolvedUrl.hostname.endsWith(`.${rootUrl.hostname}`);
          if (sameHost || (config.includeSubdomains && isSubdomain)) {
            linksFoundOnPage++;
            if (config.scope !== 'SINGLE_PAGE' && current.depth + 1 <= config.maxDepth && queue.length + visitedPages.size < maxPages * 2) {
              queue.push({ url: resolvedUrl.toString(), depth: current.depth + 1 });
            }
          } else {
            externalResources.add(resolvedUrl.origin);
          }
        } catch {
          // ignore malformed href
        }
      });

      // Discover every publicly referenced resource that can be represented in a static mirror.
      $('link[href]').each((idx, el) => {
        const rel = String($(el).attr('rel') || '').toLowerCase();
        const href = $(el).attr('href');
        if (!href) return;
        const type =
          rel.includes('stylesheet') ? 'css' :
          rel.includes('modulepreload') || rel.includes('preload') && String($(el).attr('as') || '') === 'script' ? 'js' :
          rel.includes('manifest') ? 'json' :
          rel.includes('icon') || rel.includes('apple-touch-icon') ? 'image' :
          rel.includes('preload') && String($(el).attr('as') || '') === 'font' ? 'font' :
          'other';
        addAsset(href, type, current.url, rel || `link-${idx}`);
      });

      $('style').each((_, el) => {
        const styleText = $(el).html() || '';
        if (styleText.trim()) cssContents.push(styleText);
      });

      $('script[src]').each((idx, el) => {
        const src = $(el).attr('src');
        if (src) addAsset(src, 'js', current.url, `script-${idx}`);
      });

      $('img').each((idx, el) => {
        addAsset($(el).attr('src') || '', String($(el).attr('type') || '').includes('svg') ? 'svg' : 'image', current.url, `image-${idx}`);
        addSrcSet($(el).attr('srcset'), current.url, 'image');
        addSrcSet($(el).attr('data-srcset'), current.url, 'image');
        addAsset($(el).attr('data-src') || '', 'image', current.url, `lazy-image-${idx}`);
      });

      $('source[src], source[srcset]').each((idx, el) => {
        const src = $(el).attr('src');
        if (src) addAsset(src, 'other', current.url, `source-${idx}`);
        addSrcSet($(el).attr('srcset'), current.url, 'other');
      });

      $('video[poster], video[src], audio[src], track[src], iframe[src], object[data], embed[src]').each((idx, el) => {
        const tag = (el as any).tagName?.toLowerCase?.() || 'resource';
        const raw = $(el).attr('src') || $(el).attr('poster') || $(el).attr('data');
        if (raw) addAsset(raw, tag === 'iframe' ? 'other' : 'image', current.url, `${tag}-${idx}`);
      });

      // Parse CSS url(...) and @import references from inline styles and discovered stylesheet text later.
      const inlineCss = cssContents.join('\n');
      for (const match of inlineCss.matchAll(/(?:url|src)\(\s*['"]?([^'")]+?)['"]?\s*\)/gi)) {
        addAsset(match[1], 'other', current.url, 'css-resource');
      }
      for (const match of inlineCss.matchAll(/@import\s+(?:url\(\s*)?['"]?([^'")\s;]+)['"]?\s*\)?/gi)) {
        addAsset(match[1], 'css', current.url, 'imported-style');
      }

      // Store page record
      await db.insert(projectPages).values({
        projectId,
        url: current.url,
        path: uObj.pathname || '/',
        title: pageTitle,
        pageType,
        statusCode: response.status,
        htmlContent: $.html().slice(0, 10 * 1024 * 1024),
        metaJson: JSON.stringify({
          description: metaDescription,
          ogImage,
          headingsCount: $('h1, h2, h3').length,
          linksCount: linksFoundOnPage,
          formsCount: $('form').length,
        }),
        isAuthUi,
        selected: true,
      });

      pagesProcessed++;
      const totalPlannedPages = Math.min(maxPages, pagesProcessed + queue.length);
      await logCrawlEvent(
        jobId,
        projectId,
        'info',
        'crawler',
        `Analyzed ${uObj.pathname || '/'} (${pageType}) — found ${linksFoundOnPage} internal links`
      );
      await updateJobState({
        pagesProcessed,
        pagesTotal: totalPlannedPages,
        assetsTotal: discoveredAssetUrls.size,
        currentStep: `Crawled ${pagesProcessed} / ${totalPlannedPages} pages...`,
      }, 10 + Math.min(40, Math.round((pagesProcessed / Math.max(totalPlannedPages, 1)) * 40)));

      if (config.requestDelayMs > 0) {
        await new Promise((r) => setTimeout(r, Math.min(config.requestDelayMs, 500)));
      }
    }

    // Download every discovered public asset, including binary images/fonts/media.
    // CSS files are recursively scanned for url(...) and @import resources.
    const processedAssets = new Set<string>();
    let assetsProcessed = 0;

    await updateJobState({
      assetsTotal: discoveredAssetUrls.size,
      currentStep: `Downloading ${discoveredAssetUrls.size} discovered assets...`,
    }, 52);

    while (true) {
      const pending = Array.from(discoveredAssetUrls.entries()).filter(([url]) => !processedAssets.has(url));
      if (pending.length === 0) break;

      for (const [assetUrl, meta] of pending) {
        if (abortController.signal.aborted) throw new Error('Crawl job cancelled by user.');
        processedAssets.add(assetUrl);

        try {
          const checked = await safeAssetUrl(assetUrl);
          const assetRes = await fetch(checked.toString(), {
            signal: abortController.signal,
            redirect: 'follow',
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; SiteForgeAI/2.0)',
              Accept: '*/*',
            },
          });

          const mimeType = assetRes.headers.get('content-type') || 'application/octet-stream';
          const arrayBuffer = await assetRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const sizeBytes = buffer.byteLength;

          if (sizeBytes > config.maxFileSizeKb * 1024) {
            throw new Error(`Skipped because it exceeds the configured ${config.maxFileSizeKb} KB per-file limit.`);
          }

          const looksText =
            meta.type === 'css' ||
            meta.type === 'js' ||
            meta.type === 'svg' ||
            meta.type === 'json' ||
            mimeType.startsWith('text/') ||
            mimeType.includes('javascript') ||
            mimeType.includes('json') ||
            mimeType.includes('xml');

          let contentText = '';
          let contentBase64: string | null = null;

          if (looksText) {
            contentText = buffer.toString('utf8');
            if (contentText.length > 10 * 1024 * 1024) {
              throw new Error('Text resource exceeds the 10 MB safety limit.');
            }
            if (meta.type === 'css' || mimeType.includes('css')) {
              cssContents.push(contentText);
              // CSS can reference fonts, images, SVGs, imported stylesheets, etc.
              for (const match of contentText.matchAll(/url\(\s*['"]?([^'")]+?)['"]?\s*\)/gi)) {
                addAsset(match[1], 'other', assetUrl, 'css-resource');
              }
              for (const match of contentText.matchAll(/@import\s+(?:url\(\s*)?['"]?([^'")\s;]+)['"]?\s*\)?/gi)) {
                addAsset(match[1], 'css', assetUrl, 'imported-style');
              }
            }
          } else {
            contentBase64 = buffer.toString('base64');
          }

          totalBytes += sizeBytes;
          assetsProcessed++;

          await db.insert(projectAssets).values({
            projectId,
            url: assetUrl,
            localPath: meta.localPath,
            assetType: meta.type,
            mimeType,
            sizeBytes,
            statusCode: assetRes.status,
            contentText,
            contentBase64,
          });

          await logCrawlEvent(jobId, projectId, 'success', 'asset', `Downloaded ${meta.localPath} (${(sizeBytes / 1024).toFixed(1)} KB)`);
          await updateJobState({
            assetsProcessed,
            assetsTotal: discoveredAssetUrls.size,
            currentStep: `Downloaded ${assetsProcessed} / ${discoveredAssetUrls.size} assets — ${meta.localPath}`,
          }, 52 + Math.min(18, Math.round((assetsProcessed / Math.max(discoveredAssetUrls.size, 1)) * 18)));
        } catch (assetErr: any) {
          assetsProcessed++;
          await db.insert(projectAssets).values({
            projectId,
            url: assetUrl,
            localPath: meta.localPath,
            assetType: meta.type,
            mimeType: 'application/octet-stream',
            sizeBytes: 0,
            statusCode: 0,
            contentText: `/* Resource unavailable: ${String(assetErr?.message || 'download failed').slice(0, 300)} */`,
            contentBase64: null,
          });
          await logCrawlEvent(jobId, projectId, 'warn', 'asset', `Could not download ${assetUrl}: ${String(assetErr?.message || 'download failed').slice(0, 300)}`);
        }
      }
    }

    // Build a URL -> local file map for the static mirror.
    for (const [url, meta] of discoveredAssetUrls.entries()) mirrorAssetMap.set(url, meta.localPath);
    for (const page of await db.select().from(projectPages).where(eq(projectPages.projectId, projectId))) {
      try {
        const normalized = new URL(page.url);
        const relativePath = normalized.pathname === '/' ? 'index.html' : `${normalized.pathname.replace(/^\//, '').replace(/\/$/, '') || 'index'}.html`;
        mirrorPageMap.set(page.url.replace(/\/$/, ''), `public/${relativePath}`);
      } catch {}
    }

    // Perform Deep Website Analysis
    await updateJobState({ status: 'analyzing', currentStep: 'Running structural, design, and technology stack analysis...' }, 72);
    await logCrawlEvent(jobId, projectId, 'info', 'analyzer', 'Analyzing CSS architecture, color palette, typography, and framework signatures...');

    const crawledPages = await db.select().from(projectPages).where(eq(projectPages.projectId, projectId));
    const combinedHtml = crawledPages.map((p) => p.htmlContent).join('\n');

    const technologies = detectTechnologies(combinedHtml, collectedHeaders, allScripts, allStyles);
    const { colors, fonts, breakpoints } = extractColorsAndFonts(combinedHtml, cssContents);
    const componentsList = Array.from(componentPatterns);
    const externalList = Array.from(externalResources).slice(0, 15);

    const recommendations = [
      'Decompose monolithic HTML templates into modular React + TypeScript components (Navbar, Hero, FeatureSection, Footer).',
      'Consolidate extracted colors and typography into a unified Tailwind CSS theme configuration.',
      crawledPages.some((p) => p.isAuthUi)
        ? 'Authentication UI detected: Implement token-based session management with Argon2/bcrypt password hashing on the backend.'
        : 'Add responsive navigation drawer and ARIA landmarks for WCAG AA accessibility compliance.',
      'Replace static inline scripts with typed React state hooks and REST API service modules.',
    ];

    const summaryReportMd = `# SiteForge AI — Website Analysis Report
**Target URL:** ${rootUrl.toString()}
**Analyzed At:** ${new Date().toISOString()}
**Pages Crawled:** ${crawledPages.length}
**Assets Extracted:** ${assetsProcessed}
**Total Size Analyzed:** ${(totalBytes / 1024).toFixed(2)} KB

## 1. Detected Technology Stack
${technologies.map((t) => `- **${t.name}** (${t.category}) — *${t.confidence}*: ${t.evidence}`).join('\n')}

## 2. Discovered Pages & Routes
${crawledPages.map((p) => `- \`${p.path}\` — **${p.title}** [${p.pageType}]${p.isAuthUi ? ' *(Authentication UI detected)*' : ''}`).join('\n')}

## 3. Design System Extraction
- **Primary Color Palette:** ${colors.map((c) => c.hex).join(', ')}
- **Typography Families:** ${fonts.join(', ')}
- **Responsive Breakpoints:** ${breakpoints.join(', ')}
- **UI Component Patterns:** ${componentsList.join(', ') || 'Standard Document Layout'}

## 4. Reconstruction Recommendations
${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;

    await db.insert(analysisResults).values({
      projectId,
      technologiesJson: JSON.stringify(technologies),
      colorsJson: JSON.stringify(colors),
      fontsJson: JSON.stringify(fonts),
      navigationJson: JSON.stringify(navigationLinks),
      componentsJson: JSON.stringify(componentsList),
      breakpointsJson: JSON.stringify(breakpoints),
      externalResourcesJson: JSON.stringify(externalList),
      recommendationsJson: JSON.stringify(recommendations),
      summaryReportMd,
    });

    // Package initial structured project representation (Version 1)
    await updateJobState({ status: 'packaging', currentStep: 'Generating initial source manifest and project files...' }, 88);
    await logCrawlEvent(jobId, projectId, 'info', 'packager', 'Building initial structured source tree and preview bundle...');

    const homePage = crawledPages[0];
    const [version1] = await db
      .insert(generatedProjects)
      .values({
        projectId,
        versionNumber: 1,
        versionLabel: 'Version 1 — Extracted Source & Component Baseline',
        promptUsed: `Initial extraction and structural conversion of ${rootUrl.toString()}`,
        framework: 'React + TypeScript + Tailwind CSS (Vite)',
        databaseSchemaJson: JSON.stringify([
          {
            tableName: 'users',
            columns: [
              { name: 'id', type: 'serial PRIMARY KEY', nullable: false },
              { name: 'email', type: 'varchar(255) UNIQUE', nullable: false },
              { name: 'password_hash', type: 'text', nullable: false },
              { name: 'name', type: 'varchar(120)', nullable: false },
              { name: 'role', type: "varchar(32) DEFAULT 'USER'", nullable: false },
              { name: 'created_at', type: 'timestamp DEFAULT now()', nullable: false },
            ],
          },
          {
            tableName: 'records',
            columns: [
              { name: 'id', type: 'serial PRIMARY KEY', nullable: false },
              { name: 'user_id', type: 'integer REFERENCES users(id)', nullable: false },
              { name: 'title', type: 'text', nullable: false },
              { name: 'status', type: "varchar(32) DEFAULT 'active'", nullable: false },
              { name: 'created_at', type: 'timestamp DEFAULT now()', nullable: false },
            ],
          },
        ]),
        previewHtml: buildInitialPreviewHtml(projectName, rootUrl.toString(), homePage?.htmlContent || '', mirrorAssetMap, mirrorPageMap),
      })
      .returning();

    const initialFiles = buildInitialProjectFiles(
      projectName,
      rootUrl.toString(),
      crawledPages,
      cssContents.join('\n\n'),
      technologies,
      colors,
      fonts,
      navigationLinks,
      summaryReportMd,
      mirrorAssetMap,
      mirrorPageMap
    );

    for (let fileIndex = 0; fileIndex < initialFiles.length; fileIndex++) {
      const f = initialFiles[fileIndex];
      const packagePercent = 88 + Math.round(((fileIndex + 1) / Math.max(initialFiles.length, 1)) * 11);
      await updateJobState({ currentStep: `Packaging ${f.filePath} (${fileIndex + 1}/${initialFiles.length})...` }, packagePercent);
      await logCrawlEvent(jobId, projectId, 'info', 'package', `Packaging ${f.filePath}`);
      await db.insert(generatedFiles).values({
        projectId,
        versionId: version1.id,
        filePath: f.filePath,
        language: f.language,
        content: f.content,
        sizeBytes: Buffer.byteLength(f.content, 'utf8'),
      });
      await logCrawlEvent(jobId, projectId, 'success', 'package', `Packaged ${f.filePath}`);
    }

    await updateJobState({ status: 'packaging', currentStep: 'Building and validating final ZIP archive...' }, 99);
    await logCrawlEvent(jobId, projectId, 'info', 'zip', 'Building final ZIP archive from generated source and extracted assets...');
    const preparedZip = await buildProjectZipArchive(projectId, userId, 'FULL_ZIP', version1.id, false);
    await logCrawlEvent(jobId, projectId, 'success', 'zip', `Validated ${preparedZip.fileName} (${(preparedZip.buffer.byteLength / 1024).toFixed(1)} KB, ${preparedZip.fileCount} files)`);

    const analysisScore = Math.min(98, 72 + Math.min(crawledPages.length * 3, 15) + Math.min(technologies.length * 3, 11));

    await db
      .update(projects)
      .set({
        status: 'completed',
        pagesDiscovered: crawledPages.length,
        assetsDiscovered: assetsProcessed,
        projectSizeBytes: totalBytes,
        technologiesJson: JSON.stringify(technologies),
        analysisScore,
        aiStatus: 'ready',
        lastAnalysisAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    await updateJobState({
      status: 'completed',
      pagesProcessed: crawledPages.length,
      pagesTotal: crawledPages.length,
      assetsProcessed,
      currentStep: 'Complete — ZIP source package ready',
      completedAt: new Date(),
    }, 100);

    await logCrawlEvent(
      jobId,
      projectId,
      'success',
      'complete',
      `Completed crawl & analysis of ${rootUrl.hostname} in ${((Date.now() - startTime) / 1000).toFixed(1)}s (${crawledPages.length} pages, ${assetsProcessed} assets)`
    );

    await createNotification(
      userId,
      'Website Analysis Completed',
      `Successfully analyzed ${rootUrl.hostname} (${crawledPages.length} pages, ${assetsProcessed} assets). Source files and ZIP export are ready.`,
      'success'
    );

    await createAuditLog({
      userId,
      projectId,
      jobId,
      action: 'CRAWL_ANALYZE_COMPLETED',
      status: 'success',
      durationMs: Date.now() - startTime,
      details: `Crawled ${crawledPages.length} pages and ${assetsProcessed} assets from ${rootUrl.toString()}`,
    });
  } catch (error: any) {
    const isCancelled = abortController.signal.aborted || error.message?.includes('cancelled');
    const finalStatus = isCancelled ? 'cancelled' : 'failed';
    const errorMessage = error.message || 'Crawl job encountered an unexpected error.';

    await db
      .update(projects)
      .set({ status: finalStatus })
      .where(eq(projects.id, projectId));

    await updateJobState({
      status: finalStatus,
      currentStep: isCancelled ? 'Cancelled by user' : `Failed: ${errorMessage}`,
      errorMessage,
      completedAt: new Date(),
    });

    await logCrawlEvent(jobId, projectId, 'error', 'worker', errorMessage);

    await createNotification(
      userId,
      isCancelled ? 'Analysis Cancelled' : 'Website Analysis Failed',
      errorMessage,
      isCancelled ? 'warning' : 'error'
    );

    await createAuditLog({
      userId,
      projectId,
      jobId,
      action: isCancelled ? 'CRAWL_CANCELLED' : 'CRAWL_FAILED',
      status: 'error',
      durationMs: Date.now() - startTime,
      details: errorMessage,
    });
  } finally {
    activeJobControllers.delete(jobId);
  }
}

function buildInitialPreviewHtml(
  projectName: string,
  originalUrl: string,
  rawHtml: string,
  assetMap: Map<string, string>,
  pageMap: Map<string, string>
): string {
  if (!rawHtml.trim()) {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${projectName.replace(/</g, '&lt;')}</title></head><body><main><h1>Captured page unavailable</h1><p>The target returned no HTML body that could be previewed.</p><p>Source: ${originalUrl.replace(/</g, '&lt;')}</p></main></body></html>`;
  }
  // The first preview is the captured target page itself, not a Site Forge template.
  // Rewrite only resources/pages for which the crawler has a verified local capture.
  return rewriteHtmlForStaticMirror(rawHtml, originalUrl, assetMap, pageMap);
}

function rewriteHtmlForStaticMirror(rawHtml: string, sourceUrl: string, assetMap: Map<string, string>, pageMap: Map<string, string>): string {
  const $ = cheerio.load(rawHtml || '<html></html>', { decodeEntities: false });
  const toLocal = (raw: string | undefined) => {
    if (!raw || raw.startsWith('#') || raw.startsWith('data:') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) return raw;
    try {
      const absolute = new URL(raw, sourceUrl);
      absolute.hash = '';
      const key = absolute.toString();
      if (assetMap.has(key)) return `/${assetMap.get(key)!.replace(/^public\//, '')}`;
      const pageKey = key.replace(/\/$/, '');
      if (pageMap.has(pageKey)) return `/${pageMap.get(pageKey)!.replace(/^public\//, '')}`;
    } catch {}
    return raw;
  };

  $('link[href], script[src], img[src], source[src], video[src], audio[src], track[src], iframe[src], object[data], embed[src]').each((_, el) => {
    for (const attr of ['href', 'src', 'data']) {
      const value = $(el).attr(attr);
      if (value) $(el).attr(attr, toLocal(value) || value);
    }
  });
  $('img[srcset], source[srcset]').each((_, el) => {
    const value = $(el).attr('srcset');
    if (!value) return;
    const rewritten = value.split(',').map(part => {
      const pieces = part.trim().split(/\s+/);
      pieces[0] = toLocal(pieces[0]) || pieces[0];
      return pieces.join(' ');
    }).join(', ');
    $(el).attr('srcset', rewritten);
  });
  $('style').each((_, el) => {
    const css = $(el).html() || '';
    $(el).html(css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (_m, q, u) => `url("${toLocal(u) || u}")`));
  });
  return $.html();
}

function buildInitialProjectFiles(
  projectName: string,
  originalUrl: string,
  pages: any[],
  extractedCss: string,
  technologies: DetectedTech[],
  colors: { hex: string; occurrences: number }[],
  fonts: string[],
  navLinks: { label: string; href: string }[],
  summaryReportMd: string,
  mirrorAssetMap: Map<string, string> = new Map(),
  mirrorPageMap: Map<string, string> = new Map()
): { filePath: string; language: string; content: string }[] {
  const safeSlug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'reconstructed-site';
  const primaryColor = colors[0]?.hex || '#4F46E5';
  const capturedHomeHtml = rewriteHtmlForStaticMirror(pages[0]?.htmlContent || '', originalUrl, mirrorAssetMap, mirrorPageMap);

  const files: { filePath: string; language: string; content: string }[] = [
    {
      filePath: 'public/captured/index.html',
      language: 'html',
      content: capturedHomeHtml || '<!doctype html><html><body><main><h1>No captured HTML</h1></main></body></html>',
    },
    {
      filePath: 'package.json',
      language: 'json',
      content: JSON.stringify(
        {
          name: safeSlug,
          private: true,
          version: '1.0.0',
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'tsc && vite build',
            preview: 'vite preview',
          },
          dependencies: {
            react: '^19.0.0',
            'react-dom': '^19.0.0',
            'lucide-react': '^0.546.0',
          },
          devDependencies: {
            '@types/react': '^19.0.0',
            '@types/react-dom': '^19.0.0',
            '@vitejs/plugin-react': '^4.3.0',
            tailwindcss: '^4.0.0',
            typescript: '^5.7.0',
            vite: '^6.0.0',
          },
        },
        null,
        2
      ),
    },
    {
      filePath: '.env.example',
      language: 'plaintext',
      content: `# Environment configuration for ${projectName}
# Reconstructed from ${originalUrl}
VITE_APP_NAME="${projectName}"
VITE_API_BASE_URL="http://localhost:4000/api"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/${safeSlug}"
SESSION_SECRET="replace_with_secure_random_secret"
`,
    },
    {
      filePath: 'README.md',
      language: 'markdown',
      content: `# ${projectName}

Reconstructed and exported using **SiteForge AI** from \`${originalUrl}\`.

## Detected Stack & Architecture
${technologies.map((t) => `- **${t.name}** (${t.category} — ${t.confidence})`).join('\n')}

## Project Structure
- \`src/App.tsx\` — Main application router and layout shell
- \`src/components/Navbar.tsx\` — Responsive navigation bar
- \`src/components/Hero.tsx\` — Extracted hero presentation component
- \`src/components/Footer.tsx\` — Site footer component
- \`src/styles/extracted.css\` — Extracted stylesheet rules and color variables
- \`migrations/001_initial.sql\` — Initial PostgreSQL database migration
- \`ANALYSIS_REPORT.md\` — Complete SiteForge structural analysis report

## Getting Started

\`\`\`bash
npm install
cp .env.example .env
npm run dev
\`\`\`
`,
    },
    {
      filePath: 'ANALYSIS_REPORT.md',
      language: 'markdown',
      content: summaryReportMd,
    },
    {
      filePath: 'src/App.tsx',
      language: 'typescript',
      content: `import React from 'react';

export default function App() {
  return (
    <main className="min-h-screen bg-white">
      <iframe
        title="Captured website"
        src="/captured/index.html"
        className="w-full min-h-screen border-0"
        sandbox="allow-scripts allow-forms allow-popups allow-modals"
      />
    </main>
  );
}
`,
    },
    {
      filePath: 'src/components/Navbar.tsx',
      language: 'typescript',
      content: `import React from 'react';

interface NavbarProps {
  brandName: string;
  activeRoute: string;
  onNavigate: (route: string) => void;
}

export function Navbar({ brandName, activeRoute, onNavigate }: NavbarProps) {
  const links = ${JSON.stringify(
    navLinks.length > 0
      ? navLinks.slice(0, 5)
      : [
          { label: 'Home', href: '/' },
          { label: 'Features', href: '/features' },
          { label: 'Pricing', href: '/pricing' },
          { label: 'Documentation', href: '/docs' },
        ],
    null,
    2
  )};

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <button onClick={() => onNavigate('/')} className="text-lg font-bold tracking-tight text-white">
          {brandName}
        </button>
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-300">
          {links.map((link) => (
            <button
              key={link.href}
              onClick={() => onNavigate(link.href)}
              className={\`hover:text-white transition-colors \${activeRoute === link.href ? 'text-white font-semibold' : ''}\`}
            >
              {link.label}
            </button>
          ))}
        </nav>
        <button
          onClick={() => onNavigate('/login')}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
        >
          Get Started
        </button>
      </div>
    </header>
  );
}
`,
    },
    {
      filePath: 'src/components/Hero.tsx',
      language: 'typescript',
      content: `import React from 'react';

interface HeroProps {
  title: string;
  sourceUrl: string;
  primaryColor: string;
}

export function Hero({ title, sourceUrl, primaryColor }: HeroProps) {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-b border-slate-900">
      <div className="max-w-3xl">
        <div className="text-xs font-mono text-indigo-400 mb-3">EXTRACTED FROM {sourceUrl}</div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-6">{title}</h1>
        <p className="text-lg text-slate-300 leading-relaxed mb-8">
          Captured page content is served from the local public mirror; use the AI workspace for targeted React reconstruction and modifications.
        </p>
        <div className="flex items-center gap-4">
          <button
            style={{ backgroundColor: primaryColor }}
            className="px-6 py-3 rounded-lg text-sm font-semibold text-white shadow-lg"
          >
            Open Captured Site
          </button>
          <button className="px-6 py-3 rounded-lg text-sm font-semibold border border-slate-700 text-slate-200 hover:bg-slate-900">
            Review Source
          </button>
        </div>
      </div>
    </section>
  );
}
`,
    },
    {
      filePath: 'src/components/Footer.tsx',
      language: 'typescript',
      content: `import React from 'react';

export function Footer({ brandName }: { brandName: string }) {
  return (
    <footer className="border-t border-slate-900 py-8 px-6 text-xs text-slate-500">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <span>© {new Date().getFullYear()} {brandName}. All rights reserved.</span>
        <span>Generated with SiteForge AI</span>
      </div>
    </footer>
  );
}
`,
    },
    {
      filePath: 'src/styles/extracted.css',
      language: 'css',
      content: `/* Extracted Design Tokens & Stylesheet Rules for ${projectName} */
:root {
${colors.map((c, i) => `  --extracted-color-${i + 1}: ${c.hex};`).join('\n')}
  --extracted-font-primary: ${fonts[0] || 'system-ui'}, sans-serif;
}

${extractedCss.slice(0, 25000)}
`,
    },
    {
      filePath: 'migrations/001_initial.sql',
      language: 'sql',
      content: `-- Initial PostgreSQL Schema Migration for ${projectName}
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name VARCHAR(120) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'USER',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS records (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
`,
    },
  ];

  // Add raw HTML snapshots under public/snapshots/
  pages.forEach((p, idx) => {
    const cleanName = p.path === '/' ? 'index.html' : `${p.path.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;
    files.push({
      filePath: `public/snapshots/${cleanName || `page_${idx}.html`}`,
      language: 'html',
      content: rewriteHtmlForStaticMirror(p.htmlContent || '', p.url, mirrorAssetMap, mirrorPageMap),
    });
  });

  return files;
}
