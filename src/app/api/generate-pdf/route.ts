import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const { html } = await request.json();

    const tmpDir = '/tmp/pdf-gen';
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const htmlPath = path.join(tmpDir, `report-${Date.now()}.html`);
    const pdfPath = path.join(tmpDir, `report-${Date.now()}.pdf`);

    fs.writeFileSync(htmlPath, html, 'utf-8');

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
    });

    await browser.close();

    const pdfBuffer = fs.readFileSync(pdfPath);

    fs.unlinkSync(htmlPath);
    fs.unlinkSync(pdfPath);

    return NextResponse.json({
      pdf: `data:application/pdf;base64,${pdfBuffer.toString('base64')}`,
      size: pdfBuffer.length,
    });
  } catch (error) {
    console.error('PDF conversion error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
