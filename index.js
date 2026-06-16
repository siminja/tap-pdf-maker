const express = require('express');
const puppeteer = require('puppeteer-core');

const app = express();
app.use(express.json({ limit: '20mb' }));

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

  // 폰트를 시스템 폰트로 교체 + 배경색 강제 적용
  const processedHtml = html
    .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, '')
    .replace(/<link[^>]*fonts\.gstatic\.com[^>]*>/gi, '')
    .replace(
      /font-family\s*:\s*['"]?Noto Sans KR['"]?[^;]*/gi,
      "font-family: 'NanumGothic', 'Nanum Gothic', sans-serif"
    )
    .replace(
      /font-family\s*:\s*['"]?Pretendard['"]?[^;]*/gi,
      "font-family: 'NanumGothic', 'Nanum Gothic', sans-serif"
    )
    + `<style>
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { font-family: 'NanumGothic', 'Nanum Gothic', sans-serif !important; }
    </style>`;

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
        '--font-render-hinting=none',
      ],
    });

    const page = await browser.newPage();
    await page.setContent(processedHtml, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

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
