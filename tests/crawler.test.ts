import assert from 'node:assert/strict';
import {
  isPrivateIp,
  classifyPageType,
  detectTechnologies,
  extractColorsAndFonts,
} from '../src/server/crawler.ts';

async function runTests() {
  console.log('Running SiteForge AI test suite...');

  // 1. SSRF Private IP Protection Tests
  assert.equal(isPrivateIp('127.0.0.1'), true, '127.0.0.1 must be blocked');
  assert.equal(isPrivateIp('10.0.0.1'), true, '10.x.x.x must be blocked');
  assert.equal(isPrivateIp('172.16.5.4'), true, '172.16.x.x must be blocked');
  assert.equal(isPrivateIp('192.168.1.1'), true, '192.168.x.x must be blocked');
  assert.equal(isPrivateIp('169.254.169.254'), true, 'Cloud metadata IP must be blocked');
  assert.equal(isPrivateIp('93.184.216.34'), false, 'Public IP should be allowed');
  console.log('✓ SSRF private IP protection verified');

  // 2. Page Classification & Auth UI Sanitization Detection
  const homeClass = classifyPageType('/', 'Welcome to Example', false);
  assert.equal(homeClass.pageType, 'Home');
  assert.equal(homeClass.isAuthUi, false);

  const loginClass = classifyPageType('/auth/login', 'Sign In', true);
  assert.equal(loginClass.pageType, 'Login');
  assert.equal(loginClass.isAuthUi, true);

  const pricingClass = classifyPageType('/pricing', 'Plans & Pricing', false);
  assert.equal(pricingClass.pageType, 'Pricing');
  console.log('✓ Route and Authentication UI classification verified');

  // 3. Technology Stack Detection
  const sampleNextHtml = '<html><body><div id="__NEXT_DATA__"></div><div class="flex bg-slate-900 px-4"></div></body></html>';
  const techs = detectTechnologies(sampleNextHtml, { server: 'cloudflare' }, ['/_next/static/chunks/main.js'], []);
  const techNames = techs.map((t) => t.name);
  assert.ok(techNames.includes('Next.js'), 'Should detect Next.js');
  assert.ok(techNames.includes('React'), 'Should detect React');
  assert.ok(techNames.includes('Tailwind CSS'), 'Should detect Tailwind CSS');
  assert.ok(techNames.includes('Cloudflare'), 'Should detect Cloudflare');
  console.log('✓ Technology signature detection verified');

  // 4. Design System Token Extraction
  const extracted = extractColorsAndFonts(
    '<div style="color: #4f46e5; background: #0f172a;"></div>',
    ['body { font-family: "Plus Jakarta Sans", sans-serif; color: #4F46E5; } @media (min-width: 1024px) {}']
  );
  assert.ok(extracted.colors.some((c) => c.hex === '#4F46E5'), 'Should extract #4F46E5');
  assert.ok(extracted.fonts.includes('Plus Jakarta Sans'), 'Should extract Plus Jakarta Sans');
  console.log('✓ Design token extraction verified');

  console.log('All SiteForge AI unit tests passed!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
