// Build with NEXT_PUBLIC_GA_ENABLED=true. Google requests are intercepted, never sent.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE});
try {
 const context=await browser.newContext({viewport:{width:390,height:844}});
 let googleRequests=0;
 await context.route('https://getreplypass.com/**',async route=>{
  if (route.request().headers()['next-router-prefetch']) { await route.abort(); return; }
  const u=new URL(route.request().url());
  const response=await route.fetch({url:(process.env.TEST_APP_URL||'http://127.0.0.1:3003')+u.pathname+u.search});
  await route.fulfill({response});
 });
 await context.route(/https:\/\/[^/]*(googletagmanager|google-analytics)\.com\//,async route=>{googleRequests++;await route.fulfill({body:'',contentType:'text/javascript'});});
 const page=await context.newPage();
 await page.goto('https://getreplypass.com/');
 await page.getByRole('button',{name:'Reject analytics'}).waitFor();assert.equal(googleRequests,0);
 await page.getByRole('button',{name:'Reject analytics'}).click();await page.reload();assert.equal(googleRequests,0);
 await page.getByRole('button',{name:'Cookie preferences',exact:true}).click();
 await page.getByRole('button',{name:'Accept analytics'}).click();
 await page.waitForFunction(()=>window.dataLayer?.some(x=>x[0]==='event'));
 const commands=await page.evaluate(()=>window.dataLayer.map(x=>Array.from(x)));
 assert.equal(commands[0][0],'consent');assert.equal(commands[0][2].analytics_storage,'denied');
 assert.equal(commands[1][2].ad_storage,'denied');assert.equal(commands[1][2].analytics_storage,'granted');
 assert.equal(commands.filter(x=>x[1]==='page_view').length,1);
 await page.goto('https://getreplypass.com/@stella?private=secret');
 await page.waitForFunction(()=>window.dataLayer?.some(x=>x[1]==='page_view'));
 const payload=await page.evaluate(()=>JSON.stringify(window.dataLayer));assert.ok(!payload.includes('secret'));assert.ok(!payload.includes('@stella'));
 await page.getByRole('button',{name:'Cookie preferences',exact:true}).click();
 await page.getByRole('button',{name:'Reject analytics'}).click();await page.waitForLoadState('load');
 await page.reload();const before=googleRequests;await page.reload();assert.equal(googleRequests,before);
 assert.equal(await page.evaluate(()=>!!window.gtag),false);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await context.unrouteAll({behavior:'wait'});
 console.log('PASS consent default/reject/accept/withdraw, sanitized page views, mobile overflow; Google intercepted.');
} finally {await browser.close();}
