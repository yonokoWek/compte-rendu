---
Task ID: 2
Agent: Main
Task: Fix mobile performance issues and norme real-time update bug

Work Log:
- Read worklog and analyzed both target files (page.tsx, compte-rendu-tab.tsx)
- Identified all root causes per task specification

### Bug 1 Fixes - Mobile Performance (page.tsx)
- Increased global QueryClient staleTime from 30s to 5 minutes
- Added 5-second debounce to visibilitychange handler (was firing immediately on every tab switch)
- Changed visibility handler to use `refetchQueries({ type: 'active' })` instead of nothing (previously only refreshed session)
- Added 5-second debounce to online handler (was invalidating ALL queries immediately)
- Changed online handler from `invalidateQueries()` to `refetchQueries({ type: 'active' })` to only refetch currently visible queries
- Both handlers properly clean up timers on unmount

### Bug 1 Fixes - Mobile Performance (compte-rendu-tab.tsx)
- Increased entries query staleTime from 10s to 60s
- Removed `min-w-[500px]` from table, replaced with `style={{ minWidth: 0 }}` to allow table to shrink on small screens
- Reduced activity column min-width from 100px to 70px on mobile
- Increased CellInput height from h-7 (28px) to h-11 (44px) on mobile for proper touch targets
- Added `align-middle` to all data cells for consistent vertical alignment
- Increased cell padding on mobile (`py-1.5 sm:py-1`) for better spacing with larger inputs
- Removed unused `useQueryClient` and `useMutation` imports
- Removed now-unused `queryClient` variable and its dependency in handleCellChange

### Bug 2 Fix - Norme Real-Time Update
- Removed `queryClient.invalidateQueries({ queryKey: ['entries'] })` call after successful save
- Removed the `.then()` callback that was clearing `localEntryMap` entries
- Root cause: `invalidateQueries` resolves immediately (just marks data stale), so the `.then()` cleared the optimistic local value BEFORE the refetch completed, causing values to flash back to old/empty values
- New behavior: optimistic value stays in `localEntryMap` permanently. The next natural staleTime-based refetch will bring fresh server data, and the merge in `entryMap` useMemo will naturally update
- The 800ms debounced save to backend is preserved

Stage Summary:
- Both bugs fixed with minimal, targeted changes
- All existing functionality preserved (debounced save, optimistic updates, period navigation, PDF export, etc.)
- Lint clean, no dev server errors
- Mobile: table now fits small screens, touch targets are 44px, fewer re-renders due to reduced refetch frequency
- PC: norme values now appear immediately and persist without page reload
