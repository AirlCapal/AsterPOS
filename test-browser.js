import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR STACK:', error.stack));
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' }).catch(e => console.log(e));
  await browser.close();
})();
