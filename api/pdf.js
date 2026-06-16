const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const { html, filename } = req.body;
  if (!html) return res.status(400).json({ ok: false, error: 'html 필요' });

  let browser = null;
  try {
    const executablePath = await chromium.executablePath();

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--disable-gpu',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-zygote',
        '--single-process',
      ],
      executablePath,
      headless: 'new',
      defaultViewport: { width: 1280, height: 900 },
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '20mm', right: '20mm' },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename || 'report.pdf')}"`
    );
    return res.status(200).send(Buffer.from(pdf));
  } catch (err) {
    console.error('PDF 생성 오류:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
};
