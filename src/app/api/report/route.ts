import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { format, eachDayOfInterval, eachWeekOfInterval, addWeeks, endOfWeek, differenceInCalendarDays } from 'date-fns';
import { fr } from 'date-fns/locale';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const { startDate, endDate } = await request.json();
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = differenceInCalendarDays(end, start) + 1;
    const isSingleWeek = totalDays <= 7;

    // Fetch only grouped categories (those assigned to a group) for this user
    const categories = await db.activityCategory.findMany({
      where: { groupId: { not: null }, userId: auth.user.id },
      orderBy: { sortOrder: 'asc' },
      include: { group: true },
    });

    const profile = await db.userProfile.findUnique({ where: { userId: auth.user.id } });
    const books = await db.book.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: 'desc' } });
    const prayers = await db.prayerNeed.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: 'desc' } });
    const entries = await db.dailyEntry.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      include: { category: true },
    });

    // Filter entries to only include those belonging to this user's categories
    const userCategoryIds = categories.map((c) => c.id);
    const userEntries = entries.filter((e) => userCategoryIds.includes(e.categoryId));

    const entryMap: Record<string, number> = {};
    for (const e of userEntries) {
      entryMap[`${e.date}_${e.categoryId}`] = e.value;
    }

    // Group categories by group
    const grouped = new Map<string, typeof categories>();
    for (const cat of categories) {
      const gId = cat.groupId || '_ungrouped';
      if (!grouped.has(gId)) grouped.set(gId, []);
      grouped.get(gId)!.push(cat);
    }

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

    function getCellValues(cat: typeof categories[0]): number[] {
      return columns.map((col) => {
        if (isSingleWeek) return entryMap[`${col}_${cat.id}`] || 0;
        const [wStart, wEnd] = col.split('_');
        let total = 0;
        const days = eachDayOfInterval({ start: new Date(wStart), end: new Date(wEnd) });
        for (const day of days) total += entryMap[`${format(day, 'yyyy-MM-dd')}_${cat.id}`] || 0;
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

    function fmtCount(c: number): string {
      return c === 0 ? '' : `${c}`;
    }

    // Build grouped table rows with group headers
    let tableRows = '';
    let globalRowIndex = 0;
    const personalTotalPerCol: number[] = columns.map(() => 0);
    let personalGrandTotal = 0;

    for (const [gId, cats] of grouped) {
      const groupName = cats[0]?.group?.name || 'Autres';
      tableRows += `<tr><td class="group-label" colspan="${columns.length + 3}">${groupName}</td></tr>`;

      for (const cat of cats) {
        const values = getCellValues(cat);
        const rowTotal = values.reduce((s, v) => s + v, 0);

        if (cat.isPersonal && cat.unit === 'minutes') {
          values.forEach((v, ci) => { personalTotalPerCol[ci] += v; });
          personalGrandTotal += rowTotal;
        }

        tableRows += `
      <tr>
        <td class="row-label">${cat.name}</td>
        <td class="unit-col">${cat.unit === 'minutes' ? 'min' : 'Part.'}</td>
        ${values.map((v) => `<td class="zebra-${globalRowIndex % 2}">${cat.unit === 'minutes' ? fmtMin(v) : fmtCount(v)}</td>`).join('')}
        <td style="font-weight:bold; background-color:#fed7aa;">${cat.unit === 'minutes' ? fmtMin(rowTotal) : fmtCount(rowTotal)}</td>
      </tr>`;
        globalRowIndex++;
      }
    }

    const fullName = profile ? `${profile.lastName || ''} ${profile.firstName || ''}`.trim() : '';
    const assembly = profile?.assembly || '';
    const mentor = profile?.mentor || '';

    const periodLabel = isSingleWeek
      ? `du ${format(start, 'd', { locale: fr })} au ${format(end, 'd MMMM yyyy', { locale: fr })}`
      : `du ${format(start, 'd MMMM yyyy', { locale: fr })} au ${format(end, 'd MMMM yyyy', { locale: fr })}`;

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #1a1a1a; }
  .title { text-align: center; font-size: 14px; font-weight: bold; text-decoration: underline; margin-bottom: 6px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 8px; }
  th, td { border: 1px solid #999; padding: 3px 4px; text-align: center; }
  th { background-color: #f97316; color: white; font-weight: bold; font-size: 7.5px; }
  .row-label { background-color: #fb923c; color: white; text-align: left; font-weight: bold; white-space: nowrap; min-width: 120px; font-size: 7.5px; }
  .group-label { background-color: #ea580c; color: white; text-align: left; font-weight: bold; font-size: 8px; padding: 4px; }
  .total-label { background-color: #c2410c; color: white; text-align: left; font-weight: bold; font-size: 8px; }
  .total-cell { background-color: #c2410c; color: white; font-weight: bold; }
  .zebra-0 { background-color: #ffffff; }
  .zebra-1 { background-color: #fff7ed; }
  .unit-col { width: 35px; background-color: #fdba74; color: white; font-size: 7px; }
  .footer-boxes { display: flex; gap: 10px; margin-top: 10px; }
  .footer-box { flex: 1; border: 1px solid #999; min-height: 60px; padding: 4px; }
  .footer-box h4 { font-size: 9px; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 2px; margin-bottom: 4px; color: #ea580c; }
</style>
</head>
<body>
  <div class="title">Compte rendu ${periodLabel}</div>
  <div class="meta">
    <span><strong>Nom:</strong> ${fullName}</span>
    <span><strong>Assemblée:</strong> ${assembly}</span>
    <span><strong>Faiseur de disciple:</strong> ${mentor}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th class="row-label" style="width:140px;">Activité</th>
        <th style="width:35px;">Unité</th>
        ${columnHeaders.map((h) => `<th>${h}</th>`).join('')}
        <th style="width:50px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}

      <tr>
        <td class="total-label" colspan="2">Total de temps passé seul avec le Seigneur</td>
        ${personalTotalPerCol.map((t) => `<td class="total-cell">${fmtMin(t)}</td>`).join('')}
        <td class="total-cell" style="font-size:10px;">${fmtMin(personalGrandTotal)}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer-boxes">
    <div class="footer-box">
      <h4>Livres lus</h4>
      ${books.map((b) => `<div style="font-size:7px;margin-bottom:2px;">${b.title}${b.author ? ` - ${b.author}` : ''} (${b.currentChapter}/${b.totalChapters || '?'} ch.)</div>`).join('') || '<div style="font-size:7px;color:#999;">Aucun livre</div>'}
    </div>
    <div class="footer-box">
      <h4>Besoins de prières</h4>
      ${prayers.filter((p) => !p.resolved).slice(0, 5).map((p) => `<div style="font-size:7px;margin-bottom:2px;">• ${p.text}</div>`).join('') || '<div style="font-size:7px;color:#999;">Aucun besoin</div>'}
    </div>
    <div class="footer-box">
      <h4>Conseils et appréciations</h4>
      <div style="font-size:7px;color:#999;">&nbsp;</div>
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
