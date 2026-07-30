---
Task ID: 2
Agent: Main Developer
Task: Enhancement - Activity groups, Bible, PDF books, floating notes

Work Log:
- Added ActivityGroup model to Prisma schema with relation to ActivityCategory
- Added ReadingNote model (bookId, bibleRef, content, positionX, positionY)
- Added pdfUrl field to Book model for PDF uploads
- Updated categories API to support full CRUD: create/delete groups, create/delete/assign categories
- Updated report API to only show categories assigned to a group on PDF, with group headers
- Added /api/notes route for CRUD on floating reading notes
- Added /api/upload route for PDF file uploads (stores in public/uploads/books/)
- Rewrote Compte Rendu tab with management dialog (gear icon):
  - Create/delete groups
  - Add/delete activities
  - Assign activities to groups via dropdown
  - Group headers shown in table
  - Ungrouped activities shown in separate section
- Rewrote Lecture tab with:
  - Full Bible structure (66 books, AT/NT with chapter counts)
  - Collapsible testament browser with search
  - PDF upload for books (attach during creation or after)
  - PDF viewer link on each book
  - Floating draggable notes (yellow sticky notes)
  - Note creation dialog for Bible references and books
- Verified all APIs work correctly
- Lint passes

Stage Summary:
- Activity management: full CRUD + grouping via settings dialog
- PDF export: only grouped activities appear, with group header rows
- Lecture: complete Bible structure + PDF book support
- Notes: floating, draggable sticky notes for Bible and books
