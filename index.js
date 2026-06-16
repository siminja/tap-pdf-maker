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

// 프리텐다드 폰트 CSS (CDN)
const PRETENDARD_CSS = `
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
* {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  font-family: 'Pretendard', 'NanumGothic', 'Nanum Gothic', sans-serif !important;
}
/* KPI 패널·헤더 좌우 패딩을 본문과 동일하게 통일 */
.kpi-panel, .kpi-p, .hd, .ms, .ss, .score-strip, .kpi-sec, .kpi-section,
.score-strip, .ks-wrap, .ks {
  padding-left: 64px !important;
  padding-right: 64px !important;
}
`;

app.post('/api/pdf', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { html, filename } = req.body;
  if (!html) return res.status(400).json({ ok: false, error: 'html 필요' });

  // Google Fonts 링크 제거 + 프리텐다드 주입 + 여백 통일
  let processedHtml = html
    .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, '')
    .replace(/<link[^>]*fonts\.gstatic\.com[^>]*>/gi, '');

  // </head> 앞에 스타일 주입
  if (processedHtml.includes('</head>')) {
    processedHtml = processedHtml.replace(
      '</head>',
      `<style>${PRETENDARD_CSS}</style></head>`
    );
  } else {
    processedHtml = `<style>${PRETENDARD_CSS}</style>` + processedHtml;
  }

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

    // 프리텐다드 CDN 로드 허용
    await page.setContent(processedHtml, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '0', right: '0' },
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
