'use client';

import jsPDF from 'jspdf';

/**
 * Generates a PDF from an HTML string using client-side rendering.
 * Uses an isolated iframe to render the report HTML, then captures it
 * with html2canvas, avoiding CSS conflicts with the host page.
 * Supports multi-page splitting for long content.
 */
export async function generateClientPDF(
  htmlString: string,
  filename: string,
  _options?: { onProgress?: (msg: string) => void }
): Promise<void> {
  try {
    // Create an isolated iframe to render the HTML
    // This avoids CSS conflicts (e.g., Tailwind lab() colors) from the host page
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '297mm'; // A4 landscape width
    iframe.style.height = '210mm'; // A4 landscape height
    iframe.style.border = 'none';
    iframe.style.background = 'white';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) throw new Error('Could not access iframe document');

    // Write the full HTML document into the iframe
    iframeDoc.open();
    iframeDoc.write(htmlString);
    iframeDoc.close();

    // Wait for rendering
    await new Promise((r) => setTimeout(r, 500));

    // Dynamically import html2canvas inside the iframe to avoid module conflicts
    // We'll use the iframe's window for rendering
    const iframeWin = iframe.contentWindow;
    if (!iframeWin) throw new Error('Could not access iframe window');

    // Use html2canvas from the main page (it works across frames)
    // But we target the iframe's document body for capture
    const { default: html2canvas } = await import('html2canvas');

    // Capture with html2canvas - high quality for A4 landscape
    const canvas = await html2canvas(iframeDoc.body, {
      scale: 2, // 2x for high quality
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: iframeDoc.body.scrollWidth || 1122, // 297mm ≈ 1122px at 96dpi
      width: iframeDoc.body.scrollWidth || 1122,
      height: iframeDoc.body.scrollHeight || 794,
      // Use onclone to fix any CSS issues in the cloned document
      onclone: (clonedDoc) => {
        // Ensure the cloned body uses simple CSS
        const body = clonedDoc.body || clonedDoc.documentElement;
        body.style.cssText = 'font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #1a1a1a; width: 297mm; background: white; margin: 0; padding: 0;';
      },
    });

    // A4 landscape dimensions in mm
    const pageWidth = 297;
    const pageHeight = 210;
    const margin = 8; // 8mm margins like the original

    // Calculate dimensions
    const contentWidth = pageWidth - (margin * 2);
    const contentHeight = pageHeight - (margin * 2);

    // Scale factor: convert pixels to mm
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // Handle multi-page content
    let heightLeft = imgHeight;
    let position = margin;

    // Add first page
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
    heightLeft -= contentHeight;

    // Add additional pages if content overflows
    while (heightLeft > 0) {
      position = margin - contentHeight + heightLeft + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= contentHeight;
    }

    // Save the PDF
    pdf.save(filename);

    // Cleanup
    document.body.removeChild(iframe);
  } catch (error) {
    console.error('Client PDF generation error:', error);
    throw error;
  }
}

/**
 * Fetches report HTML from the API and generates a client-side PDF.
 * This replaces the old server-side Chromium-based PDF generation.
 */
export async function exportReportPDF(
  startDate: string,
  endDate: string,
  filename?: string
): Promise<void> {
  const reportRes = await fetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, endDate }),
  });

  if (!reportRes.ok) {
    throw new Error('Failed to fetch report data');
  }

  const reportData = await reportRes.json();
  const pdfFilename = filename || `compte-rendu-${startDate}.pdf`;

  await generateClientPDF(reportData.html, pdfFilename);
}
