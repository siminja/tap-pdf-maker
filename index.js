const express = require('express');
const puppeteer = require('puppeteer-core');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.options('/api/pdf', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(200).end();
});

app.post('/api/pdf', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { html, filename } = req.body;
  if (!html) return res.status(400).json({ ok: false, error: 'html 필요' });

  let browser = null;
  try {
    const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';

    browser = await puppeteer.launch({
      executablePath,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process',
      ],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '20mm', right: '20mm' },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename || 'report.pdf')}"`);
    return res.status(200).send(Buffer.from(pdf));
  } catch (err) {
    console.error('PDF 오류:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PDF 서버 실행 중: ${PORT}`));
