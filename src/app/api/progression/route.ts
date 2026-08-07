import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const groupBy = searchParams.get('groupBy') || 'day'; // day | week
    const filterType = searchParams.get('filterType') || 'all'; // all | group | category | bible | time-with-god
    const filterId = searchParams.get('filterId') || '';

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate required' }, { status: 400 });
    }

    const result: Record<string, unknown> = {
      period: { startDate, endDate },
      dailyData: [] as unknown[],
      summary: {},
    };

    // 1. Activity entries (DailyEntry) progression
    if (filterType === 'all' || filterType === 'category' || filterType === 'group' || filterType === 'time-with-god') {
      let categoryWhere: Record<string, unknown> = { userId: auth.user.id };

      if (filterType === 'category' && filterId) {
        categoryWhere = { ...categoryWhere, id: filterId };
      } else if (filterType === 'group' && filterId) {
        categoryWhere = { ...categoryWhere, groupId: filterId };
      } else if (filterType === 'time-with-god') {
        // "Temps passé avec Dieu" = all personal spiritual categories (minutes-based)
        categoryWhere = { ...categoryWhere, isPersonal: true };
      }

      const categories = await db.activityCategory.findMany({
        where: categoryWhere,
        select: { id: true, name: true, unit: true, groupId: true, isPersonal: true },
        orderBy: { sortOrder: 'asc' },
      });

      const categoryIds = categories.map((c) => c.id);

      // Get all entries in the date range for these categories
      const entries = await db.dailyEntry.findMany({
        where: {
          categoryId: { in: categoryIds },
          date: { gte: startDate, lte: endDate },
        },
        orderBy: { date: 'asc' },
      });

      // Build daily breakdown
      const dailyMap: Record<string, { minutes: number; count: number; byCategory: Record<string, number> }> = {};
      
      // Helper to get all dates in range
      const start = new Date(startDate);
      const end = new Date(endDate);
      const allDates: string[] = [];
      const d = new Date(start);
      while (d <= end) {
        allDates.push(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() + 1);
      }

      for (const dateStr of allDates) {
        dailyMap[dateStr] = { minutes: 0, count: 0, byCategory: {} };
        for (const cat of categories) {
          dailyMap[dateStr].byCategory[cat.id] = 0;
        }
      }

      for (const entry of entries) {
        if (!dailyMap[entry.date]) continue;
        const cat = categories.find((c) => c.id === entry.categoryId);
        if (!cat) continue;
        if (cat.unit === 'minutes') {
          dailyMap[entry.date].minutes += entry.value;
          dailyMap[entry.date].byCategory[entry.categoryId] = (dailyMap[entry.date].byCategory[entry.categoryId] || 0) + entry.value;
        } else {
          dailyMap[entry.date].count += entry.value;
          dailyMap[entry.date].byCategory[entry.categoryId] = (dailyMap[entry.date].byCategory[entry.categoryId] || 0) + entry.value;
        }
      }

      const totalMinutes = Object.values(dailyMap).reduce((s, d) => s + d.minutes, 0);
      const totalCount = Object.values(dailyMap).reduce((s, d) => s + d.count, 0);
      const daysWithData = Object.values(dailyMap).filter((d) => d.minutes > 0 || d.count > 0).length;
      const avgMinutesPerDay = daysWithData > 0 ? Math.round(totalMinutes / daysWithData) : 0;

      result.dailyData = allDates.map((date) => ({
        date,
        minutes: dailyMap[date].minutes,
        count: dailyMap[date].count,
        byCategory: dailyMap[date].byCategory,
      }));

      result.summary = {
        totalMinutes,
        totalCount,
        totalHours: Math.round(totalMinutes / 60 * 10) / 10,
        daysWithData,
        avgMinutesPerDay,
        totalDays: allDates.length,
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          unit: c.unit,
          groupId: c.groupId,
          total: entries.filter((e) => e.categoryId === c.id).reduce((s, e) => s + e.value, 0),
        })),
      };
    }

    // 2. Bible reading progression
    if (filterType === 'all' || filterType === 'bible') {
      const bibleLogs = await db.bibleReadingLog.findMany({
        where: { userId: auth.user.id, date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'asc' },
      });

      const bibleDaily: Record<string, { chapters: number; duration: number }> = {};
      for (const log of bibleLogs) {
        if (!bibleDaily[log.date]) bibleDaily[log.date] = { chapters: 0, duration: 0 };
        bibleDaily[log.date].chapters += log.chapters || 0;
        bibleDaily[log.date].duration += log.duration || 0;
      }

      const totalBibleChapters = bibleLogs.reduce((s, l) => s + (l.chapters || 0), 0);
      const totalBibleDuration = bibleLogs.reduce((s, l) => s + (l.duration || 0), 0);
      const bibleDaysWithData = bibleLogs.filter((l) => (l.chapters || 0) > 0 || (l.duration || 0) > 0).length;

      // Merge into dailyData or set separately
      if (result.dailyData.length > 0) {
        (result.dailyData as { date: string; minutes: number; count: number; byCategory: Record<string, number>; bibleChapters?: number; bibleDuration?: number }[]).forEach((d) => {
          const bd = bibleDaily[d.date] || { chapters: 0, duration: 0 };
          d.bibleChapters = bd.chapters;
          d.bibleDuration = bd.duration;
        });
      } else {
        // Bible-only filter
        const start = new Date(startDate);
        const end = new Date(endDate);
        const allDates: string[] = [];
        const dd = new Date(start);
        while (dd <= end) {
          allDates.push(dd.toISOString().split('T')[0]);
          dd.setDate(dd.getDate() + 1);
        }
        result.dailyData = allDates.map((date) => {
          const bd = bibleDaily[date] || { chapters: 0, duration: 0 };
          return { date, chapters: bd.chapters, duration: bd.duration, minutes: 0, count: 0, byCategory: {} };
        });
      }

      const prevSummary = result.summary as Record<string, unknown>;
      prevSummary.bibleTotalChapters = totalBibleChapters;
      prevSummary.bibleTotalDuration = totalBibleDuration;
      prevSummary.bibleTotalHours = Math.round(totalBibleDuration / 60 * 10) / 10;
      prevSummary.bibleDaysWithData = bibleDaysWithData;
      prevSummary.bibleAvgPerDay = bibleDaysWithData > 0 ? Math.round(totalBibleChapters / bibleDaysWithData) : 0;
    }

    // 3. Groups data (for filter dropdown)
    const groups = await db.activityGroup.findMany({
      where: { userId: auth.user.id },
      select: { id: true, name: true },
      orderBy: { sortOrder: 'asc' },
    });

    const allCategories = await db.activityCategory.findMany({
      where: { userId: auth.user.id },
      select: { id: true, name: true, unit: true, groupId: true, isPersonal: true },
      orderBy: { sortOrder: 'asc' },
    });

    result.groups = groups;
    result.allCategories = allCategories;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Progression error:', error);
    return NextResponse.json({ error: 'Failed to fetch progression' }, { status: 500 });
  }
}
