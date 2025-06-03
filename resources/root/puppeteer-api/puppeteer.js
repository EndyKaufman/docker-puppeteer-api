/**
 * Puppeteer scraper API. Direct call examples are located at the file bottom.
 *
 * @author Lukasz Frankowski
 */

const packageInfo = require('./package.json');

const puppeteer = require('puppeteer-core');
const program = require('commander');
const blocked_domains = ['googlesyndication.com', 'adservice.google.com'];
const minimal_args = [
    '--autoplay-policy=user-gesture-required',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-client-side-phishing-detection',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-dev-shm-usage',
    '--disable-domain-reliability',
    '--disable-extensions',
    '--disable-features=AudioServiceOutOfProcess',
    '--disable-hang-monitor',
    '--disable-ipc-flooding-protection',
    '--disable-notifications',
    '--disable-offer-store-unmasked-wallet-cards',
    '--disable-popup-blocking',
    '--disable-print-preview',
    '--disable-prompt-on-repost',
    '--disable-renderer-backgrounding',
    '--disable-setuid-sandbox',
    '--disable-speech-api',
    '--disable-sync',
    '--hide-scrollbars',
    '--ignore-gpu-blacklist',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-default-browser-check',
    '--no-first-run',
    '--no-pings',
    '--no-sandbox',
    '--no-zygote',
    '--password-store=basic',
    '--use-gl=swiftshader',
    '--use-mock-keychain',
    '--headless',
    '--disable-gpu',
];
/**
 * Starts the browser and returns the content when element appears.
 *
 * @param {string} url URL to fetch
 * @param {string} selector CSS selector to check if element appeared, if empty is returns immediately after page is loaded
 * @return {Promise<string>} HTML content after element appeared
 */
async function scrape({ url, selector, delayBeforeClose }, sessionId = "local", returnFullPage = false) {

    return new Promise(async (resolve, reject) => {
        try {
            if (sessionId) console.log(`[${sessionId}, ${new Date().toISOString()}]`, 'starting chrome browser');
            // see https://github.com/puppeteer/puppeteer/issues/1793#issuecomment-438971272
            const browser = await puppeteer.launch({
                executablePath: '/usr/bin/chromium-browser',
                // timeout: 60000,
                // waitForInitialPage: true,
                args: ['--no-sandbox', '--disable-gpu']
            });

            let j = 0;
            const page = await browser.newPage();
            // await page.setRequestInterception(true);
            // page.on('request', (request) => {
            //     const url = request.url();
            //     if (blocked_domains.some((domain) => url.includes(domain))) {
            //         request.abort();
            //     } else {
            //         request.continue();
            //     }
            // });
            if (process.env.USER_AGENT) {
                page.setUserAgent(process.env.USER_AGENT);
            }

            async function stop() {
                if (i) {
                    if (sessionId) console.log(`[${sessionId}, ${new Date().toISOString()}]`, 'clearing refresh interval');
                    clearInterval(i);
                }
                if (sessionId) console.log(`[${sessionId}, ${new Date().toISOString()}]`, 'closing chrome browser');
                try {
                    await page.close();
                    await browser.close();
                } catch (e) {
                    console.error(`[${sessionId}]`, `puppeteer error: ${e.message}`);
                }
            }

            async function check() {
                let elements = await page.$$(selector);
                if (elements.length) {
                    if (sessionId) console.log(`[${sessionId}, ${new Date().toISOString()}]`, `element with selector: '${selector}' appeared, resolving content`);
                    if (returnFullPage) {

                        const content = await page.content();

                        if (delayBeforeClose) {
                            await new Promise((res2) => setTimeout(() => {
                                res2(true)
                            }, delayBeforeClose));
                        }

                        resolve(content);
                    } else {
                        const elementContents = (await Promise.all(
                            elements.map(element => page.evaluate(el => el.outerHTML, element))
                        )).join("\n");

                        if (delayBeforeClose) {
                            await new Promise((res2) => setTimeout(() => {
                                res2(true)
                            }, delayBeforeClose));
                        }

                        resolve(elementContents);
                    }
                    await stop();
                } else if (++j === 60) { // 60 secs timeout
                    if (sessionId) console.log(`[${sessionId}, ${new Date().toISOString()}]`, `element with selector: '${selector}' didn't appear, timeout`);
                    reject([204, 'didn\'t appear']);
                    await stop();
                }
            }

            let i = null, k = null;
            page.once('load', async () => {
                if (k) {
                    if (sessionId) console.log(`[${sessionId}, ${new Date().toISOString()}]`, 'clearing wait for page load timeout');
                    clearTimeout(k);
                }

                if (selector) {
                    if (sessionId) console.log(`[${sessionId}, ${new Date().toISOString()}]`, `page loaded; looking for selector: '${selector}'. setting 1000 ms refresh interval`);
                    i = setInterval(check, 1000);
                } else {
                    if (sessionId) console.log(`[${sessionId}, ${new Date().toISOString()}]`, `page loaded; resolving content immediately`);
                    const content = await page.content();

                    if (delayBeforeClose) {
                        await new Promise((res2) => setTimeout(() => {
                            res2(true)
                        }, delayBeforeClose));
                    }

                    resolve(content);
                    await stop();
                }
            });

            if (sessionId) console.log(`[${sessionId}, ${new Date().toISOString()}]`, `going to: ${url}`);
            try {
                await page.goto(url);
            } catch (e) {
                if (sessionId) console.error(`[${sessionId}]`, `error: ${e.message}, but continue to wait for onload yet another time`);
                k = setTimeout(async () => {
                    reject([503, 'pageload timeout']);
                    await stop();
                }, 30000);
            }
        } catch (e) {
            console.error(`[${sessionId}]`, `puppeteer error: ${e.message}`);
            reject([500, `puppeteer error: ${e.message}`]);
            await stop();
        }

    });

}

// exports

exports.scrape = scrape;

// CLI

program.version(packageInfo.version);

program
    .command('fetch <url>')
    .description('fetches URL')
    .action(async function (url, cmd) {
        let req = { url };
        console.log(await scrape(req, null, true));
    });

program
    .command('scrape <url>')
    .description('scrapes URL')
    .option('-s, --selector <selector>', 'returns content after appearance of element pointed by css selector')
    .action(async function (url, cmd) {
        let req = { url };
        req.selector = cmd.selector;
        console.log(await scrape(req, null, false));
    });


program.parse(process.argv);


// direct call examples

// scrape({
//     url: 'http://example.com/',
//     selector: 'h1'
// }).then((content) => {
//     console.log(content);
// });

// securedScrape({
//     url: 'http://example.com/',
//     selector: 'h1',
//     hash: 'c020eed4c5703931fb45596bf32fd709'
// }).then((content) => {
//     console.log(content);
// });
