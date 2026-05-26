# Audit Reports Module - Implementation Notes

- Add/upgrade `src/pages/ReportsPage.tsx` to a full report runner UI (filters/search/sort/pagination + printable/exportable tables).
- Extend `supabase/functions/reports/index.ts` with endpoints for the required report types.
- Use `jspdf` + `jspdf-autotable` for PDF; use `xlsx` for Excel.
- Implement shared helpers/components for table rendering, summary totals, cash flow formula, and pagination.

