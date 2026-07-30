---
Task ID: 1
Agent: Main
Task: Implement pending features - activity management, Bible, PDF books, floating notes

Work Log:
- Reviewed full existing codebase (10 models, 5 tabs, 16 API routes)
- Confirmed activity management (groups, delete, assign, PDF filtering) was already implemented
- Fixed critical bug: FloatingNote drag handler was clearing note content on every mouse move
- Rewrote FloatingNote with proper document-level mouse/touch event handling
- Created PdfViewerDialog component with zoom and fullscreen controls
- Enhanced Lecture tab:
  - Book chapter progress UI (+/- buttons, progress bar)
  - PDF viewer integration (embedded iframe)
  - Bible book/chapter selector for daily reading
  - Bible API updated with reference field
  - Floating add-note button
  - Note dialog with type selector (general, Bible, book)
  - Mobile touch support for note dragging
- Added reference field to BibleReadingLog schema
- Fixed all ESLint errors
- Verified via Agent Browser: all tabs render, no errors

Stage Summary:
- All requested features implemented:
  1. Activity management with groups/delete/assign/PDF-filter ✓
  2. Bible with 66-book structure and chapter selector ✓
  3. PDF books with upload, viewer, progress tracking ✓
  4. Floating draggable notes with touch support ✓
- Lint clean, compiles without errors
- Key files: lecture-tab.tsx (rewritten), pdf-viewer-dialog.tsx (new), bible/route.ts, schema.prisma
