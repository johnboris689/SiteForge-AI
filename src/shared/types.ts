export interface CrawlConfig {
  scope: 'ENTIRE' | 'SINGLE_PAGE' | 'SELECTED_PAGES' | 'SAME_DOMAIN' | 'CUSTOM_LIST';
  extractionMode: 'STATIC_MIRROR' | 'FRONTEND_ANALYSIS' | 'DEEP_ANALYSIS' | 'AI_RECONSTRUCTION';
  maxPages: number;
  maxDepth: number;
  maxFileSizeKb: number;
  requestDelayMs: number;
  sameDomainOnly: boolean;
  includeSubdomains: boolean;
  followExternalAssets: boolean;
  respectRobotsTxt: boolean;
  stopOnError: boolean;
  retryFailed: boolean;
  assets: {
    html: boolean;
    css: boolean;
    js: boolean;
    images: boolean;
    svg: boolean;
    fonts: boolean;
    json: boolean;
    metadata: boolean;
  };
  customUrls?: string[];
}

export const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
  scope: 'SAME_DOMAIN',
  extractionMode: 'DEEP_ANALYSIS',
  maxPages: 8,
  maxDepth: 2,
  maxFileSizeKb: 2048,
  requestDelayMs: 150,
  sameDomainOnly: true,
  includeSubdomains: false,
  followExternalAssets: true,
  respectRobotsTxt: true,
  stopOnError: false,
  retryFailed: true,
  assets: {
    html: true,
    css: true,
    js: true,
    images: true,
    svg: true,
    fonts: true,
    json: true,
    metadata: true,
  },
};
