import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { format, eachDayOfInterval, eachWeekOfInterval, addWeeks, endOfWeek, differenceInCalendarDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const { startDate, endDate, pdfColor: clientPdfColor } = await request.json();
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate required' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = differenceInCalendarDays(end, start) + 1;
    const isSingleWeek = totalDays <= 7;

    // Theme colors
    const themeColor = clientPdfColor || '#1e3a5f';
    const rgb = hexToRgb(themeColor);

    // Fetch data
    const categories = await db.activityCategory.findMany({
      where: { userId: auth.user.id },
      orderBy: { sortOrder: 'asc' },
      include: { group: true },
    });
    const groups = await db.activityGroup.findMany({
      where: { userId: auth.user.id },
      orderBy: { sortOrder: 'asc' },
    });
    const profile = await db.userProfile.findUnique({ where: { userId: auth.user.id } });
    const books = await db.book.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: 'desc' } });
    const prayers = await db.prayerNeed.findMany({ where: { userId: auth.user.id, resolved: false }, orderBy: { createdAt: 'desc' } });
    const userCategoryIds = categories.map((c) => c.id);
    const entries = await db.dailyEntry.findMany({
      where: { categoryId: { in: userCategoryIds }, date: { gte: startDate, lte: endDate } },
      include: { category: true },
    });
    const bibleLogs = await db.bibleReadingLog.findMany({
      where: { userId: auth.user.id, date: { gte: startDate, lte: endDate } },
    });
    const finances = await db.financeEntry.findMany({
      where: { userId: auth.user.id, date: { gte: startDate, lte: endDate } },
    });

    // Build maps
    const entryMap: Record<string, number> = {};
    for (const e of entries) entryMap[`${e.date}_${e.categoryId}`] = e.value;

    const bibleMap: Record<string, { chapters: number; duration: number }> = {};
    for (const log of bibleLogs) {
      if (!bibleMap[log.date]) bibleMap[log.date] = { chapters: 0, duration: 0 };
      bibleMap[log.date].chapters += log.chapters || 0;
      bibleMap[log.date].duration += log.duration || 0;
    }

    const totalIncome = finances.filter((f) => f.type === 'income').reduce((s, f) => s + f.amount, 0);
    const totalExpenses = finances.filter((f) => f.type === 'expense').reduce((s, f) => s + f.amount, 0);
    const balance = totalIncome - totalExpenses;

    // Build columns
    let columnHeaders: string[];
    let columns: string[];

    if (isSingleWeek) {
      const days = eachDayOfInterval({ start, end });
      columnHeaders = days.map((d) => format(d, 'EEEE', { locale: fr }));
      columns = days.map((d) => format(d, 'yyyy-MM-dd'));
    } else {
      const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
      columnHeaders = weeks.map((w, i) => {
        const wEnd = i === weeks.length - 1 ? end : endOfWeek(addWeeks(w, 1).getTime() - 1, { weekStartsOn: 1 });
        return `Sem ${i + 1} (${format(w, 'd', { locale: fr })}-${format(wEnd, 'd MMM', { locale: fr })})`;
      });
      columns = weeks.map((w, i) => {
        const wEnd = i === weeks.length - 1 ? end : endOfWeek(addWeeks(w, 1).getTime() - 1, { weekStartsOn: 1 });
        return `${format(w, 'yyyy-MM-dd')}_${format(wEnd, 'yyyy-MM-dd')}`;
      });
    }

    // Helpers
    function getCellValues(catId: string): number[] {
      return columns.map((col) => {
        if (isSingleWeek) return entryMap[`${col}_${catId}`] || 0;
        const [wStart, wEnd] = col.split('_');
        let total = 0;
        for (const day of eachDayOfInterval({ start: new Date(wStart), end: new Date(wEnd) })) {
          total += entryMap[`${format(day, 'yyyy-MM-dd')}_${catId}`] || 0;
        }
        return total;
      });
    }

    function fmtMin(m: number): string {
      if (m === 0) return '';
      const h = Math.floor(m / 60);
      const min = m % 60;
      if (h === 0) return `${min}`;
      if (min === 0) return `${h}h`;
      return `${h}h ${min}`;
    }

    function fmtMinTotal(m: number): string {
      if (m === 0) return '';
      const h = Math.floor(m / 60);
      const min = m % 60;
      if (h === 0) return `${min} min`;
      if (min === 0) return `${h}h`;
      return `${h}h ${min}`;
    }

    function fmtCount(c: number): string {
      return c === 0 ? '' : `${c}`;
    }

    // PDF display rules
    const hiddenCats = new Set(categories.filter((c) => c.pdfDisplay === 'hidden').map((c) => c.id));
    const groupedCats = categories.filter((c) => c.groupId && !hiddenCats.has(c.id));
    const ungroupedShowCats = categories.filter((c) => !c.groupId && c.pdfDisplay !== 'hidden');
    const displayedMinuteCats = categories.filter((c) => c.unit === 'minutes' && !hiddenCats.has(c.id));

    // Personal totals
    const personalTotalPerCol: number[] = columns.map(() => 0);
    let personalGrandTotal = 0;
    for (const cat of displayedMinuteCats) {
      const values = getCellValues(cat.id);
      values.forEach((v, ci) => { personalTotalPerCol[ci] += v; });
      personalGrandTotal += values.reduce((s, v) => s + v, 0);
    }

    // Bible chapters per column
    const bibleChaptersPerCol = columns.map((col) => {
      if (isSingleWeek) return bibleMap[col]?.chapters || 0;
      const [wStart, wEnd] = col.split('_');
      let total = 0;
      for (const day of eachDayOfInterval({ start: new Date(wStart), end: new Date(wEnd) })) {
        total += bibleMap[format(day, 'yyyy-MM-dd')]?.chapters || 0;
      }
      return total;
    });
    const totalBibleChapters = bibleChaptersPerCol.reduce((s, c) => s + c, 0);

    // === Build table body ===
    const body: (string | number)[][] = [];
    let globalRowIndex = 0;

    // Grouped rows (summed)
    const groupsMap = new Map(groups.map((g) => [g.id, g]));
    const groupedByGroup = new Map<string, typeof groupedCats>();
    for (const cat of groupedCats) {
      if (!groupedByGroup.has(cat.groupId!)) groupedByGroup.set(cat.groupId!, []);
      groupedByGroup.get(cat.groupId!)!.push(cat);
    }

    const sortedGroupIds = groups
      .filter((g) => groupedByGroup.has(g.id) && groupedByGroup.get(g.id)!.length > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((g) => g.id);

    for (const gId of sortedGroupIds) {
      const cats = groupedByGroup.get(gId)!;
      const groupName = groupsMap.get(gId)?.name || 'Groupe';
      const allMinutes = cats.every((c) => c.unit === 'minutes');
      const val = allMinutes ? fmtMin : fmtCount;

      const summedValues: number[] = columns.map((col) => {
        if (isSingleWeek) {
          return cats.reduce((s, cat) => s + (entryMap[`${col}_${cat.id}`] || 0), 0);
        }
        const [wStart, wEnd] = col.split('_');
        let total = 0;
        for (const day of eachDayOfInterval({ start: new Date(wStart), end: new Date(wEnd) })) {
          for (const cat of cats) total += entryMap[`${format(day, 'yyyy-MM-dd')}_${cat.id}`] || 0;
        }
        return total;
      });
      const rowTotal = summedValues.reduce((s, v) => s + v, 0);
      const isZebra = globalRowIndex % 2 === 1;

      body.push([
        { content: groupName, styles: { fillColor: [rgb.r, rgb.g, rgb.b], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' } },
        { content: allMinutes ? 'min' : 'Part.', styles: { fillColor: [100, 116, 139], textColor: [255, 255, 255], fontSize: 6.5, halign: 'center' } },
        ...summedValues.map((v) => ({
          content: val(v),
          styles: { fillColor: isZebra ? [240, 247, 255] : [255, 255, 255], halign: 'center' },
        })),
        { content: val(rowTotal), styles: { fillColor: [224, 238, 249], fontStyle: 'bold', halign: 'center' } },
      ] as (string | number | { content: string; styles: Record<string, unknown> })[]);
      globalRowIndex++;
    }

    // Ungrouped rows
    for (const cat of ungroupedShowCats) {
      const values = getCellValues(cat.id);
      const rowTotal = values.reduce((s, v) => s + v, 0);
      const val = cat.unit === 'minutes' ? fmtMin : fmtCount;
      const isZebra = globalRowIndex % 2 === 1;

      body.push([
        { content: cat.name, styles: { fillColor: [rgb.r, rgb.g, rgb.b, 0.8], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' } },
        { content: cat.unit === 'minutes' ? 'min' : 'Part.', styles: { fillColor: [100, 116, 139], textColor: [255, 255, 255], fontSize: 6.5, halign: 'center' } },
        ...values.map((v) => ({
          content: val(v),
          styles: { fillColor: isZebra ? [240, 247, 255] : [255, 255, 255], halign: 'center' },
        })),
        { content: val(rowTotal), styles: { fillColor: [224, 238, 249], fontStyle: 'bold', halign: 'center' } },
      ] as (string | number | { content: string; styles: Record<string, unknown> })[]);
      globalRowIndex++;
    }

    // Personal total row
    body.push([
      { content: 'Total de temps passe seul avec le Seigneur', colSpan: 2, styles: { fillColor: [rgb.r, rgb.g, rgb.b], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7.5 } },
      ...personalTotalPerCol.map((t) => ({
        content: fmtMinTotal(t),
        styles: { fillColor: [rgb.r, rgb.g, rgb.b], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      })),
      { content: fmtMinTotal(personalGrandTotal), styles: { fillColor: [245, 158, 11], textColor: [26, 26, 26], fontStyle: 'bold', fontSize: 10, halign: 'center' } },
    ] as (string | number | { content: string; styles: Record<string, unknown> })[]);

    // Bible header row
    body.push([
      { content: 'Lecture biblique', colSpan: columns.length + 3, styles: { fillColor: [124, 58, 237], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7.5 } },
    ] as (string | number | { content: string; styles: Record<string, unknown> })[]);

    // Bible data row
    body.push([
      { content: 'Lecture biblique', styles: { fillColor: [139, 92, 246], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' } },
      { content: 'Ch.', styles: { fillColor: [100, 116, 139], textColor: [255, 255, 255], fontSize: 6.5, halign: 'center' } },
      ...bibleChaptersPerCol.map((v) => ({
        content: fmtCount(v),
        styles: { fillColor: [240, 247, 255], halign: 'center' },
      })),
      { content: fmtCount(totalBibleChapters), styles: { fillColor: [224, 238, 249], fontStyle: 'bold', halign: 'center' } },
    ] as (string | number | { content: string; styles: Record<string, unknown> })[]);

    // === Create PDF ===
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Title
    const periodLabel = isSingleWeek
      ? `du ${format(start, 'd', { locale: fr })} au ${format(end, 'd MMMM yyyy', { locale: fr })}`
      : `du ${format(start, 'd MMMM yyyy', { locale: fr })} au ${format(end, 'd MMMM yyyy', { locale: fr })}`;

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Compte rendu ${periodLabel}`, 148.5, 15, { align: 'center' });

    // Meta info
    const fullName = profile ? `${profile.lastName || ''} ${profile.firstName || ''}`.trim() : '-';
    const assembly = profile?.assembly || '-';
    const mentor = profile?.mentor || '-';

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const metaY = 22;
    pdf.text(`Nom: ${fullName}`, 20, metaY);
    pdf.text(`Assemblee: ${assembly}`, 105, metaY);
    pdf.text(`Faiseur de disciple: ${mentor}`, 190, metaY);

    // Build table headers
    const tableHead = [[
      { content: 'Activite', styles: { fillColor: [rgb.r, rgb.g, rgb.b], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', cellWidth: 45 } },
      { content: 'Unite', styles: { fillColor: [rgb.r, rgb.g, rgb.b], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', cellWidth: 12 } },
      ...columnHeaders.map((h) => ({
        content: h.charAt(0).toUpperCase() + h.slice(1),
        styles: { fillColor: [rgb.r, rgb.g, rgb.b], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7 },
      })),
      { content: 'Total', styles: { fillColor: [rgb.r, rgb.g, rgb.b], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', cellWidth: 18 } },
    ]];

    autoTable(pdf, {
      head: tableHead as Parameters<typeof autoTable>[1] extends { head?: infer H } ? H : never,
      body: body as Parameters<typeof autoTable>[1] extends { body?: infer B } ? B : never,
      startY: 27,
      margin: { top: 8, bottom: 8, left: 8, right: 8 },
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        lineColor: [170, 170, 170],
        lineWidth: 0.3,
        textColor: [26, 26, 26],
        valign: 'middle',
      },
      tableWidth: 'auto',
    });

    // === Finance section ===
    if (finances.length > 0) {
      const financeY = (pdf as unknown as Record<string, number>).lastAutoTable?.finalY ?? (pdf as jsPDF & { previousAutoTable: { finalY: number } }).previousAutoTable?.finalY ?? 100;
      const fY = financeY + 4;

      // Finance header
      autoTable(pdf, {
        head: [[{ content: 'Finances', styles: { fillColor: [20, 83, 45], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8 }, colSpan: columns.length + 3 }]],
        body: [
          [
            { content: 'Entrees', styles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' } },
            ...Array(columns.length + 1).fill(''),
            { content: totalIncome.toLocaleString('fr-FR'), styles: { fillColor: [224, 238, 249], fontStyle: 'bold', halign: 'center' } },
          ] as (string | { content: string; styles: Record<string, unknown> })[],
          [
            { content: 'Sorties', styles: { fillColor: [254, 202, 202], textColor: [153, 27, 27], fontStyle: 'bold', halign: 'center' } },
            ...Array(columns.length + 1).fill(''),
            { content: totalExpenses.toLocaleString('fr-FR'), styles: { fillColor: [254, 202, 202], textColor: [153, 27, 27], fontStyle: 'bold', halign: 'center' } },
          ] as (string | { content: string; styles: Record<string, unknown> })[],
          [
            { content: 'Solde', styles: { fillColor: [20, 83, 45], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' } },
            ...Array(columns.length + 1).fill(''),
            { content: balance.toLocaleString('fr-FR'), styles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 9 } },
          ] as (string | { content: string; styles: Record<string, unknown> })[],
        ],
        startY: fY,
        margin: { top: 8, bottom: 8, left: 8, right: 8 },
        theme: 'grid',
        styles: {
          fontSize: 7.5,
          cellPadding: 2.5,
          lineColor: [170, 170, 170],
          lineWidth: 0.3,
          textColor: [26, 26, 26],
          valign: 'middle',
        },
      });
    }

    // === Footer boxes ===
    const lastTableY = (pdf as unknown as Record<string, { finalY: number }>).lastAutoTable?.finalY ?? 120;
    const footerY = lastTableY + 6;
    const boxWidth = 84;
    const boxHeight = 30;
    const gap = 5;
    const boxStartX = 8;

    // Books box
    drawFooterBox(pdf, boxStartX, footerY, boxWidth, boxHeight, 'Livres lus',
      books.length > 0
        ? books.slice(0, 6).map((b) => `  ${b.title}${b.author ? ` - ${b.author}` : ''} (${b.currentChapter}/${b.totalChapters || '?'})`).join('\n')
        : 'Aucun livre',
      rgb
    );

    // Prayers box
    drawFooterBox(pdf, boxStartX + boxWidth + gap, footerY, boxWidth, boxHeight, 'Besoins de prieres',
      prayers.length > 0
        ? prayers.slice(0, 5).map((p) => `  ${p.text}`).join('\n')
        : 'Aucun besoin',
      rgb
    );

    // Notes box
    drawFooterBox(pdf, boxStartX + (boxWidth + gap) * 2, footerY, boxWidth, boxHeight, 'Conseils et appreciations', '', rgb);

    // Return PDF as base64
    const pdfBase64 = pdf.output('datauristring').split(',')[1];
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    return NextResponse.json({
      pdf: `data:application/pdf;base64,${pdfBuffer.toString('base64')}`,
      size: pdfBuffer.length,
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}

// === Helpers ===

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function drawFooterBox(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  content: string,
  rgb: { r: number; g: number; b: number },
) {
  pdf.setDrawColor(170, 170, 170);
  pdf.setLineWidth(0.3);
  pdf.rect(x, y, w, h);

  // Title
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(rgb.r, rgb.g, rgb.b);
  pdf.text(title, x + w / 2, y + 5, { align: 'center' });

  // Separator line
  pdf.setDrawColor(204, 204, 204);
  pdf.line(x + 2, y + 7, x + w - 2, y + 7);

  // Content
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(51, 51, 51);
  const lines = pdf.splitTextToSize(content, w - 6);
  pdf.text(lines, x + 3, y + 11, { maxWidth: w - 6 });
}
