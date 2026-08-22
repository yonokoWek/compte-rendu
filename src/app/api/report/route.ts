import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { format, eachDayOfInterval, eachWeekOfInterval, addWeeks, endOfWeek, differenceInCalendarDays } from 'date-fns';
import { fr } from 'date-fns/locale';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const { startDate, endDate, pdfColor: clientPdfColor } = await request.json();
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = differenceInCalendarDays(end, start) + 1;
    const isSingleWeek = totalDays <= 7;

    // Global PDF theme color (from client localStorage, default to dark blue)
    const themeColor = clientPdfColor || '#1e3a5f';
    const themeColorLight = themeColor + 'cc'; // slightly transparent for variation

    // Fetch ALL categories (grouped AND ungrouped) for this user
    const categories = await db.activityCategory.findMany({
      where: { userId: auth.user.id },
      orderBy: { sortOrder: 'asc' },
      include: { group: true },
    });

    // Fetch groups
    const groups = await db.activityGroup.findMany({
      where: { userId: auth.user.id },
      orderBy: { sortOrder: 'asc' },
    });

    const profile = await db.userProfile.findUnique({ where: { userId: auth.user.id } });
    const books = await db.book.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: 'desc' } });
    const prayers = await db.prayerNeed.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: 'desc' } });

    // Fetch ALL entries for this user's categories in the date range
    const userCategoryIds = categories.map((c) => c.id);
    const entries = await db.dailyEntry.findMany({
      where: {
        categoryId: { in: userCategoryIds },
        date: { gte: startDate, lte: endDate },
      },
      include: { category: true },
    });

    // Fetch Bible reading logs
    const bibleLogs = await db.bibleReadingLog.findMany({
      where: { userId: auth.user.id, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
    });

    // Fetch finances
    const finances = await db.financeEntry.findMany({
      where: { userId: auth.user.id, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
    });

    // Build entry map
    const entryMap: Record<string, number> = {};
    for (const e of entries) {
      entryMap[`${e.date}_${e.categoryId}`] = e.value;
    }

    // Build bible log map
    const bibleMap: Record<string, { chapters: number; duration: number }> = {};
    for (const log of bibleLogs) {
      if (!bibleMap[log.date]) bibleMap[log.date] = { chapters: 0, duration: 0 };
      bibleMap[log.date].chapters += log.chapters || 0;
      bibleMap[log.date].duration += log.duration || 0;
    }

    // Compute finance totals
    const totalIncome = finances.filter(f => f.type === 'income').reduce((s, f) => s + f.amount, 0);
    const totalExpenses = finances.filter(f => f.type === 'expense').reduce((s, f) => s + f.amount, 0);
    const balance = totalIncome - totalExpenses;

    // Build column headers
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

    function getCellValues(catId: string): number[] {
      return columns.map((col) => {
        if (isSingleWeek) return entryMap[`${col}_${catId}`] || 0;
        const [wStart, wEnd] = col.split('_');
        let total = 0;
        const days = eachDayOfInterval({ start: new Date(wStart), end: new Date(wEnd) });
        for (const day of days) total += entryMap[`${format(day, 'yyyy-MM-dd')}_${catId}`] || 0;
        return total;
      });
    }

    // Format minutes for regular activity rows (compact: "1h 45" or "45")
    function fmtMin(m: number): string {
      if (m === 0) return '';
      const h = Math.floor(m / 60);
      const min = m % 60;
      if (h === 0) return `${min}`;
      if (min === 0) return `${h}h`;
      return `${h}h ${min}`;
    }

    // Format minutes for the TOTAL row (always include unit for clarity)
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

    function fmtMoney(n: number): string {
      return n.toLocaleString('fr-FR');
    }

    // === PDF Display Rules (Points 3, 5) ===
    // Hidden categories: never shown, never counted
    const hiddenCats = new Set(categories.filter(c => c.pdfDisplay === 'hidden').map(c => c.id));

    // Grouped categories (non-hidden): shown ONLY as group rows with summed time
    // Individual activities within a group NEVER appear on PDF
    const groupedCats = categories.filter(c => c.groupId && !hiddenCats.has(c.id));

    // Ungrouped categories shown individually (only if pdfDisplay === "show")
    const ungroupedShowCats = categories.filter(c => !c.groupId && c.pdfDisplay !== 'hidden');

    // Personal total = sum of ALL personal+minutes categories (except hidden)
    // This includes grouped activities' time
    const allPersonalCats = categories.filter(c => c.isPersonal && c.unit === 'minutes' && !hiddenCats.has(c.id));
    const personalTotalPerCol: number[] = columns.map(() => 0);
    let personalGrandTotal = 0;
    for (const cat of allPersonalCats) {
      const values = getCellValues(cat.id);
      values.forEach((v, ci) => { personalTotalPerCol[ci] += v; });
      personalGrandTotal += values.reduce((s, v) => s + v, 0);
    }

    let tableRows = '';
    let globalRowIndex = 0;

    // === Render GROUP rows only (summed) ===
    const groupsMap = new Map(groups.map(g => [g.id, g]));
    const groupedByGroup = new Map<string, typeof groupedCats>();
    for (const cat of groupedCats) {
      const gId = cat.groupId!;
      if (!groupedByGroup.has(gId)) groupedByGroup.set(gId, []);
      groupedByGroup.get(gId)!.push(cat);
    }

    // Sort groups by their sortOrder, auto-show if group has activities
    const sortedGroupIds = groups
      .filter(g => groupedByGroup.has(g.id) && groupedByGroup.get(g.id)!.length > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(g => g.id);

    for (const gId of sortedGroupIds) {
      const cats = groupedByGroup.get(gId)!;
      const group = groupsMap.get(gId);
      const groupName = group?.name || 'Groupe';

      // Sum values across all sub-categories for each column
      const summedValues: number[] = columns.map((col) => {
        if (isSingleWeek) {
          return cats.reduce((s, cat) => s + (entryMap[`${col}_${cat.id}`] || 0), 0);
        }
        const [wStart, wEnd] = col.split('_');
        let total = 0;
        const days = eachDayOfInterval({ start: new Date(wStart), end: new Date(wEnd) });
        for (const day of days) {
          for (const cat of cats) {
            total += entryMap[`${format(day, 'yyyy-MM-dd')}_${cat.id}`] || 0;
          }
        }
        return total;
      });
      const rowTotal = summedValues.reduce((s, v) => s + v, 0);

      // Determine unit: if ALL cats are minutes, use minutes; otherwise use count
      const allMinutes = cats.every(c => c.unit === 'minutes');
      const val = allMinutes ? fmtMin : fmtCount;

      const isZebra = globalRowIndex % 2 === 1;
      tableRows += `
      <tr>
        <td class="row-label" style="background-color: ${themeColor};">${groupName}</td>
        <td class="unit-col">${allMinutes ? 'min' : 'Part.'}</td>
        ${summedValues.map((v) => `<td class="${isZebra ? 'data-zebra' : ''}">${val(v)}</td>`).join('')}
        <td class="total-cell-inline">${val(rowTotal)}</td>
      </tr>`;
      globalRowIndex++;
    }

    // === Render UNGROUPED categories (individual, non-hidden) ===
    for (const cat of ungroupedShowCats) {
      const values = getCellValues(cat.id);
      const rowTotal = values.reduce((s, v) => s + v, 0);
      const val = cat.unit === 'minutes' ? fmtMin : fmtCount;

      const isZebra = globalRowIndex % 2 === 1;
      tableRows += `
      <tr>
        <td class="row-label-ungrouped" style="background-color: ${themeColor};">${cat.name}</td>
        <td class="unit-col">${cat.unit === 'minutes' ? 'min' : 'Part.'}</td>
        ${values.map((v) => `<td class="${isZebra ? 'data-zebra' : ''}">${val(v)}</td>`).join('')}
        <td class="total-cell-inline">${val(rowTotal)}</td>
      </tr>`;
      globalRowIndex++;
    }

    // Build bible reading row
    const bibleChaptersPerCol = columns.map((col) => {
      if (isSingleWeek) return bibleMap[col]?.chapters || 0;
      const [wStart, wEnd] = col.split('_');
      let total = 0;
      const days = eachDayOfInterval({ start: new Date(wStart), end: new Date(wEnd) });
      for (const day of days) total += bibleMap[format(day, 'yyyy-MM-dd')]?.chapters || 0;
      return total;
    });
    const totalBibleChapters = bibleChaptersPerCol.reduce((s, c) => s + c, 0);

    // Build daily bible rows
    let bibleRows = '';
    const bibleDays = columns.map((col) => {
      if (isSingleWeek) return bibleMap[col]?.chapters || 0;
      const [wStart, wEnd] = col.split('_');
      let total = 0;
      const days = eachDayOfInterval({ start: new Date(wStart), end: new Date(wEnd) });
      for (const day of days) total += bibleMap[format(day, 'yyyy-MM-dd')]?.chapters || 0;
      return total;
    });
    bibleRows += `
      <tr>
        <td class="row-label">Lecture biblique</td>
        <td class="unit-col">Ch.</td>
        ${bibleDays.map((v) => `<td class="data-zebra">${fmtCount(v)}</td>`).join('')}
        <td class="total-cell-inline">${fmtCount(totalBibleChapters)}</td>
      </tr>`;

    const fullName = profile ? `${profile.lastName || ''} ${profile.firstName || ''}`.trim() : '';
    const assembly = profile?.assembly || '';
    const mentor = profile?.mentor || '';

    const periodLabel = isSingleWeek
      ? `du ${format(start, 'd', { locale: fr })} au ${format(end, 'd MMMM yyyy', { locale: fr })}`
      : `du ${format(start, 'd MMMM yyyy', { locale: fr })} au ${format(end, 'd MMMM yyyy', { locale: fr })}`;

    // Build finance rows
    const financeRows = finances.length > 0 ? `
      <table class="finance-table">
        <thead>
          <tr>
            <th class="finance-header-green" colspan="${columns.length + 3}">Finances</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="finance-label">Entrées</td>
            <td colspan="${columns.length + 2}"></td>
            <td class="total-cell-inline">${fmtMoney(totalIncome)}</td>
          </tr>
          <tr>
            <td class="finance-label-expense">Sorties</td>
            <td colspan="${columns.length + 2}"></td>
            <td class="total-cell-expense">${fmtMoney(totalExpenses)}</td>
          </tr>
          <tr>
            <td class="finance-label-balance">Solde</td>
            <td colspan="${columns.length + 2}"></td>
            <td class="total-cell-balance">${fmtMoney(balance)}</td>
          </tr>
        </tbody>
      </table>` : '';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #1a1a1a; }

  /* Title */
  .title { text-align: center; font-size: 14px; font-weight: bold; text-decoration: underline; margin-bottom: 6px; color: ${themeColor}; }
  .meta { display: flex; justify-content: center; gap: 40px; margin-bottom: 8px; font-size: 10px; color: #333; text-align: center; }

  /* Main table */
  table.main-table { width: 100%; border-collapse: collapse; font-size: 8px; margin-bottom: 6px; }
  table.main-table th, table.main-table td { border: 1px solid #aaa; padding: 4px 6px; text-align: center; vertical-align: middle; }
  table.main-table th { background-color: ${themeColor}; color: white; font-weight: bold; font-size: 7.5px; text-transform: capitalize; }
  .row-label { background-color: ${themeColor}; color: white; text-align: center; font-weight: bold; white-space: nowrap; min-width: 110px; font-size: 7.5px; vertical-align: middle; }
  .row-label-ungrouped { background-color: ${themeColorLight}; color: white; text-align: center; font-weight: bold; white-space: nowrap; min-width: 110px; font-size: 7.5px; vertical-align: middle; }
  .group-label { background-color: #14532d; color: white; text-align: center; font-weight: bold; font-size: 7.5px; padding: 3px 5px !important; text-transform: uppercase; letter-spacing: 0.5px; }
  .unit-col { width: 30px; background-color: #64748b; color: white; font-size: 7px; text-align: center; vertical-align: middle; }
  .data-zebra { background-color: #f0f7ff; }
  .total-cell-inline { font-weight: bold; background-color: #e0eef9; text-align: center !important; }

  /* Total row */
  .total-label { background-color: ${themeColor}; color: white; text-align: center; font-weight: bold; font-size: 7.5px; vertical-align: middle; }
  .total-cell { background-color: ${themeColor}; color: white; font-weight: bold; font-size: 9px; text-align: center; vertical-align: middle; }
  .grand-total { background-color: #f59e0b; color: #1a1a1a; font-weight: bold; font-size: 10px; text-align: center; vertical-align: middle; }

  /* Bible section */
  .bible-header { background-color: #7c3aed; color: white; text-align: center; font-weight: bold; font-size: 7.5px; padding: 3px 5px !important; }
  .bible-row-label { background-color: #8b5cf6; color: white; text-align: center; font-weight: bold; white-space: nowrap; font-size: 7.5px; vertical-align: middle; }
  .bible-unit { background-color: #64748b; color: white; font-size: 7px; text-align: center; vertical-align: middle; }

  /* Finance table */
  table.finance-table { width: 100%; border-collapse: collapse; font-size: 8px; margin-bottom: 6px; }
  table.finance-table th, table.finance-table td { border: 1px solid #aaa; padding: 4px 6px; text-align: center; vertical-align: middle; }
  .finance-header-green { background-color: #14532d; color: white; font-weight: bold; font-size: 8px; text-align: center; }
  .finance-label { background-color: #166534; color: white; font-weight: bold; font-size: 7.5px; text-align: center; }
  .finance-label-expense { background-color: #fecaca; color: #991b1b; font-weight: bold; font-size: 7.5px; text-align: center; }
  .finance-label-balance { background-color: #14532d; color: white; font-weight: bold; font-size: 8px; text-align: center; }
  .total-cell-expense { background-color: #fecaca; color: #991b1b; font-weight: bold; text-align: center !important; }
  .total-cell-balance { background-color: #22c55e; color: white; font-weight: bold; text-align: center !important; font-size: 9px; }

  /* Footer boxes */
  .footer-boxes { display: flex; gap: 8px; margin-top: 8px; }
  .footer-box { flex: 1; border: 1px solid #aaa; min-height: 50px; padding: 4px; }
  .footer-box h4 { font-size: 8px; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 2px; margin-bottom: 3px; color: ${themeColor}; text-align: center; }
  .footer-box .item { font-size: 7px; margin-bottom: 2px; color: #333; text-align: center; }
  .footer-box .empty { font-size: 7px; color: #999; font-style: italic; text-align: center; }
</style>
</head>
<body>
  <div class="title">Compte rendu ${periodLabel}</div>
  <div class="meta">
    <span><strong>Nom:</strong> ${fullName || '-'}</span>
    <span><strong>Assemblée:</strong> ${assembly || '-'}</span>
    <span><strong>Faiseur de disciple:</strong> ${mentor || '-'}</span>
  </div>

  <!-- Main Activities Table -->
  <table class="main-table">
    <thead>
      <tr>
        <th class="row-label" style="width:140px;">Activité</th>
        <th style="width:30px;">Unité</th>
        ${columnHeaders.map((h) => `<th>${h}</th>`).join('')}
        <th style="width:45px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}

      <tr>
        <td class="total-label" colspan="2">Total de temps passé seul avec le Seigneur</td>
        ${personalTotalPerCol.map((t) => `<td class="total-cell">${fmtMinTotal(t)}</td>`).join('')}
        <td class="grand-total">${fmtMinTotal(personalGrandTotal)}</td>
      </tr>

      <!-- Bible reading -->
      <tr><td class="bible-header" colspan="${columns.length + 3}">Lecture biblique</td></tr>
      ${bibleRows}
    </tbody>
  </table>

  <!-- Finances -->
  ${financeRows}

  <!-- Footer boxes -->
  <div class="footer-boxes">
    <div class="footer-box">
      <h4>Livres lus</h4>
      ${books.map((b) => `<div class="item">• ${b.title}${b.author ? ` - ${b.author}` : ''} (${b.currentChapter}/${b.totalChapters || '?'} ch.)</div>`).join('') || '<div class="empty">Aucun livre</div>'}
    </div>
    <div class="footer-box">
      <h4>Besoins de prières</h4>
      ${prayers.filter((p) => !p.resolved).slice(0, 5).map((p) => `<div class="item">• ${p.text}</div>`).join('') || '<div class="empty">Aucun besoin</div>'}
    </div>
    <div class="footer-box">
      <h4>Conseils et appréciations</h4>
      <div class="empty">&nbsp;</div>
    </div>
  </div>
</body>
</html>`;

    return NextResponse.json({ html, periodLabel });
  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
