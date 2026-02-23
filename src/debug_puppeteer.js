const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('response', response => console.log('RESPONSE:', response.url(), response.status()));

    console.log("Navigating...");
    await page.goto('http://127.0.0.1:8080/index.html', { waitUntil: 'networkidle0' });

    console.log("Checking final DOM state...");
    const html = await page.evaluate(() => document.body.innerHTML.substring(0, 500));
    console.log("HTML Start:", html);

    await browser.close();
})();
