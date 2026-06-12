const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

// Use Playwright Extra Stealth
chromium.use(stealth);

/**
 * Extracts emails from html using standard regex matching
 */
function extractEmails(html) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const ignoreExtensions = /\.(png|jpg|jpeg|gif|svg|webp|css|js|mp4)$/i;
  
  const matches = html.match(emailRegex) || [];
  const validEmails = new Set();
  
  for (const email of matches) {
    if (!ignoreExtensions.test(email)) {
      validEmails.add(email.toLowerCase());
    }
  }
  
  return Array.from(validEmails);
}

/**
 * Crawls a website (Homepage + Contact pages) to find email addresses
 */
async function crawlWebsiteForEmails(url) {
  if (!url) return [];
  console.log(`[Playwright Scraper] Crawling website for emails: ${url}`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  const emails = new Set();
  
  try {
    // 1. Visit homepage
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    const homepageHtml = await page.content();
    extractEmails(homepageHtml).forEach(e => emails.add(e));
    
    // 2. Find links to contact or about pages
    const contactHref = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      const found = anchors.find(a => {
        const text = a.innerText.toLowerCase();
        const href = a.getAttribute('href')?.toLowerCase() || '';
        return text.includes('contact') || text.includes('about') || href.includes('contact') || href.includes('about');
      });
      return found ? found.getAttribute('href') : null;
    });
    
    // 3. Visit contact page if found
    if (contactHref) {
      let resolvedUrl = contactHref;
      if (!contactHref.startsWith('http')) {
        resolvedUrl = new URL(contactHref, url).toString();
      }
      
      console.log(`[Playwright Scraper] Found contact link: ${resolvedUrl}. Crawling contact page...`);
      await page.goto(resolvedUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
      const contactHtml = await page.content();
      extractEmails(contactHtml).forEach(e => emails.add(e));
    }
  } catch (err) {
    console.warn(`[Playwright Scraper] Error crawling ${url}: ${err.message}`);
  } finally {
    await browser.close();
  }
  
  return Array.from(emails);
}

/**
 * Main GMB Google Maps Scraper execution (Step 7)
 */
async function scrapeGmbPlaywright(query, maxResults = 10) {
  console.log(`[Playwright Scraper] Launching GMB search: "${query}" (Max: ${maxResults})`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  
  const results = [];
  
  try {
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 20000 });
    
    // Infinite Scroll loop to load items
    let previousCount = 0;
    let scrollAttempts = 0;
    
    while (results.length < maxResults && scrollAttempts < 15) {
      const cards = await page.locator('a[href*="/maps/place/"]').all();
      if (cards.length === previousCount) {
        scrollAttempts++;
      } else {
        previousCount = cards.length;
        scrollAttempts = 0;
      }
      
      if (cards.length > 0) {
        await cards[cards.length - 1].scrollIntoViewIfNeeded().catch(() => {});
      }
      
      await page.waitForTimeout(1500);
      if (cards.length >= maxResults) break;
    }
    
    // Extract listings
    const cards = await page.locator('a[href*="/maps/place/"]').all();
    console.log(`[Playwright Scraper] Found ${cards.length} candidate business cards. Starting details extraction...`);
    
    for (const card of cards.slice(0, maxResults)) {
      try {
        await card.click();
        await page.waitForTimeout(2000);
        
        const name = await page.locator('h1.DUwDvf').first().innerText().catch(() => '');
        if (!name) continue;
        
        // Find phone
        const phone = await page.locator('button[data-item-id^="phone:tel:"]').getAttribute('data-item-id')
          .then(val => val ? val.replace('phone:tel:', '').trim() : '')
          .catch(() => '');
          
        // Find authority website
        const website = await page.locator('a[data-item-id="authority"]').getAttribute('href')
          .catch(() => '');
          
        console.log(`[Playwright Scraper] Extracted: Name="${name}", Phone="${phone}", Website="${website}"`);
        
        // Deep website email harvest
        let emails = [];
        if (website) {
          emails = await crawlWebsiteForEmails(website);
        }
        
        results.push({
          name,
          phone: phone || '',
          website: website || '',
          emails
        });
      } catch (cardErr) {
        console.warn(`[Playwright Scraper] Error extracting card details: ${cardErr.message}`);
      }
    }
    
  } catch (err) {
    console.error(`[Playwright Scraper] Critical scraping failure:`, err);
  } finally {
    await browser.close();
  }
  
  return results;
}

module.exports = {
  scrapeGmbPlaywright,
  crawlWebsiteForEmails
};
