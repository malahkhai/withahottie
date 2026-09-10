import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE || undefined,headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.TEST_APP_URL || 'http://127.0.0.1:3003';
 for(const route of ['/','/creators']) {
  const r=await page.goto(base+route);assert.equal(r.status(),200);assert.equal(new URL(page.url()).pathname,route);
  assert.equal(await page.locator('a[href^="/signup"]').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(os.tmpdir(),route==='/'?'replypass-home-mobile.png':'replypass-creators-mobile.png'),fullPage:true});
 }
 await page.goto(base+'/');await page.getByRole('link',{name:'I’m a creator'}).click();await page.waitForURL('**/creators');
 await page.goto(base+'/signup');assert.equal(await page.locator('input[name="email"]').count(),0);await page.getByRole('heading',{name:'A connection starts with a creator.'}).waitFor();
 await page.goto(base+'/signup?next=%2F%40unknown_replypass_test');assert.equal(await page.locator('input[name="email"]').count(),0);
 await page.goto(base+'/@stella');
 assert.match(await page.getByRole('link',{name:'Back to @stella profile',exact:true}).getAttribute('href'),/^\/@stella/);
 await page.getByRole('link',{name:'Back to @stella profile',exact:true}).click();assert.equal(new URL(page.url()).pathname,'/@stella');
 await page.getByRole('button',{name:/Message me/}).click();
 const draft='My private question stays with this creator.';
 await page.locator('textarea').fill(draft);
 await page.goto(base+'/login?next='+encodeURIComponent('/@stella?interaction=message'));
 await page.getByRole('link',{name:'Join ReplyPass'}).click();
 assert.equal(new URL(page.url()).searchParams.get('next'),'/@stella?interaction=message');
 await page.getByRole('link',{name:'← Back to @stella'}).click();
 await page.locator('textarea').waitFor();assert.equal(await page.locator('textarea').inputValue(),draft);
 assert.ok(!page.url().includes('private'));
 await page.reload();await page.locator('textarea').waitFor();assert.equal(await page.locator('textarea').inputValue(),draft);
 await page.goto(base+'/@stella');await page.getByRole('link',{name:'About ReplyPass',exact:true}).click();await page.waitForURL(base+'/');
 await page.setViewportSize({width:1440,height:1000});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:path.join(os.tmpdir(),'replypass-home-desktop.png'),fullPage:false});
 assert.deepEqual(errors,[]);
 console.log('PASS: landing pages, signup gating, creator logo, About navigation, private drafts through login/signup/reload, mobile and desktop.');
} finally {await browser.close();}
