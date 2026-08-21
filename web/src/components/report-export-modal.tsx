"use client";

import * as React from "react";
import { Download, Eye, FileSpreadsheet, FileText, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatPKR } from "@/lib/format";
import {
  csvAmount,
  toCsv,
  type CategorySlice,
  type DateRange,
  type MonthPoint,
  type ReportMovement,
  type ReportTotals,
} from "@/lib/reports";

/**
 * What goes in the export.
 *
 * A picker rather than "everything", because the three sections answer
 * different questions and a shopkeeper printing a category breakdown for their
 * accountant does not want 400 raw rows behind it.
 */
export type ExportSection = "summary" | "categories" | "monthly" | "transactions";

const SECTIONS: { key: ExportSection; label: string; hint: string }[] = [
  { key: "summary", label: "Summary", hint: "Money in, money out, and what you kept" },
  { key: "categories", label: "Category breakdown", hint: "Where the money went, largest first" },
  { key: "monthly", label: "Month by month", hint: "The trend across the whole range" },
  { key: "transactions", label: "Every transaction", hint: "The full list — the long one" },
];

export type ReportData = {
  range: DateRange;
  totals: ReportTotals;
  categories: CategorySlice[];
  monthly: MonthPoint[];
  movements: ReportMovement[];
  categoryNameById: Map<string, string>;
  accountNameById: Map<string, string>;
  householdName: string;
};

export function ReportExportModal({
  isOpen,
  onClose,
  data,
}: {
  isOpen: boolean;
  onClose: () => void;
  data: ReportData | null;
}) {
  const { showToast } = useToast();

  const [format, setFormat] = React.useState<"csv" | "pdf">("pdf");
  const [chosen, setChosen] = React.useState<Set<ExportSection>>(
    new Set<ExportSection>(["summary", "categories", "monthly"]),
  );
  const [previewing, setPreviewing] = React.useState(false);

  const seedKey = String(isOpen);
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    if (isOpen) setPreviewing(false);
  }

  if (!data) return null;

  const toggle = (key: ExportSection) => {
    const next = new Set(chosen);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setChosen(next);
  };

  const buildCsv = (): string => {
    const rows: (string | number | null)[][] = [];
    rows.push([`Bachat Book — ${data.householdName}`]);
    rows.push([data.range.label, `${data.range.from} to ${data.range.to}`]);
    rows.push([]);

    if (chosen.has("summary")) {
      rows.push(["SUMMARY"]);
      rows.push(["Money in (PKR)", csvAmount(data.totals.incomePaisa)]);
      rows.push(["Money out (PKR)", csvAmount(data.totals.expensePaisa)]);
      rows.push(["Net (PKR)", csvAmount(data.totals.netPaisa)]);
      if (data.totals.savingsRate !== null) {
        rows.push(["Kept (%)", (data.totals.savingsRate * 100).toFixed(1)]);
      }
      rows.push([]);
    }

    if (chosen.has("categories")) {
      rows.push(["CATEGORY BREAKDOWN"]);
      rows.push(["Category", "Amount (PKR)", "Share (%)", "Entries"]);
      for (const slice of data.categories) {
        rows.push([
          slice.name,
          csvAmount(slice.amountPaisa),
          (slice.share * 100).toFixed(1),
          slice.count,
        ]);
      }
      rows.push([]);
    }

    if (chosen.has("monthly")) {
      rows.push(["MONTH BY MONTH"]);
      rows.push(["Month", "Money in (PKR)", "Money out (PKR)", "Net (PKR)"]);
      for (const point of data.monthly) {
        rows.push([
          point.label,
          csvAmount(point.incomePaisa),
          csvAmount(point.expensePaisa),
          csvAmount(point.netPaisa),
        ]);
      }
      rows.push([]);
    }

    if (chosen.has("transactions")) {
      rows.push(["TRANSACTIONS"]);
      rows.push(["Date", "Note", "Category", "Account", "Amount (PKR)"]);
      const inRange = data.movements
        .filter(
          (m) =>
            !m.is_opening &&
            m.type !== "transfer" &&
            m.date >= data.range.from &&
            m.date <= data.range.to,
        )
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      for (const m of inRange) {
        rows.push([
          m.date,
          m.note ?? "",
          m.category_id ? (data.categoryNameById.get(m.category_id) ?? "") : "Uncategorised",
          data.accountNameById.get(m.account_id) ?? "",
          csvAmount(Number(m.amount_paisa)),
        ]);
      }
    }

    return toCsv(rows);
  };

  const downloadCsv = () => {
    if (chosen.size === 0) {
      showToast({ type: "error", title: "Nothing selected", description: "Pick at least one section." });
      return;
    }
    const blob = new Blob([buildCsv()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bachat-book-${data.range.from}-to-${data.range.to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revoked on the next tick, not immediately — Safari cancels an in-flight
    // download if the object URL disappears in the same frame as the click.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast({ type: "success", title: "CSV downloaded", description: "Opens in Excel." });
  };

  /**
   * "PDF" is the browser's own print-to-PDF, driven by a print stylesheet.
   *
   * Deliberately not a PDF library. Adding one costs ~300KB to every page load
   * of an app used on cheap Android handsets, to reproduce a renderer the
   * browser already ships — and its output would be worse, because print CSS
   * gets real font hinting and selectable text.
   */
  const printPdf = () => {
    if (chosen.size === 0) {
      showToast({ type: "error", title: "Nothing selected", description: "Pick at least one section." });
      return;
    }
    setPreviewing(true);
    // Let the preview paint before handing over to the print dialog.
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export this report"
      subtitle={`${data.range.label} · ${data.range.from} to ${data.range.to}`}
      icon={<Download size={18} />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="secondary" onClick={() => setPreviewing((v) => !v)}>
            <Eye size={14} />
            {previewing ? "Hide preview" : "Preview"}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={format === "csv" ? downloadCsv : printPdf}
          >
            {format === "csv" ? <FileSpreadsheet size={14} /> : <Printer size={14} />}
            {format === "csv" ? "Download CSV" : "Save as PDF"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* ---- Format ------------------------------------------------------- */}
        <div>
          <span className="text-foreground-2 mb-1.5 block text-xs font-medium">Format</span>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { key: "pdf", icon: FileText, label: "PDF", hint: "For printing or sending" },
                { key: "csv", icon: FileSpreadsheet, label: "CSV", hint: "For Excel" },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setFormat(option.key)}
                aria-pressed={format === option.key}
                className={
                  format === option.key
                    ? "border-navy-900 bg-navy-900 text-on-navy rounded-control flex items-center gap-2 border px-3 py-2.5 text-start text-[12.5px] font-semibold"
                    : "border-border bg-surface-subtle text-foreground-2 hover:border-navy-900/30 rounded-control flex items-center gap-2 border px-3 py-2.5 text-start text-[12.5px] font-medium transition-colors"
                }
              >
                <option.icon size={16} className="shrink-0" />
                <span className="min-w-0">
                  {option.label}
                  <span className="block text-[10.5px] font-normal opacity-70">{option.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ---- What goes in -------------------------------------------------- */}
        <div>
          <span className="text-foreground-2 mb-1.5 block text-xs font-medium">What to include</span>
          <ul className="border-border divide-border divide-y rounded-control border">
            {SECTIONS.map((section) => (
              <li key={section.key}>
                <label className="hover:bg-surface-subtle flex cursor-pointer items-start gap-2.5 px-3 py-2 transition-colors">
                  <input
                    type="checkbox"
                    checked={chosen.has(section.key)}
                    onChange={() => toggle(section.key)}
                    className="accent-navy-900 mt-0.5 size-3.5 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="text-foreground block text-[12.5px] font-medium">
                      {section.label}
                    </span>
                    <span className="text-faint block text-[10.5px]">{section.hint}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        {format === "pdf" && (
          <p className="text-faint text-[11px] leading-snug">
            Save as PDF opens your browser&apos;s print dialog — choose
            &quot;Save as PDF&quot; as the destination. Only the report is
            printed; the sidebar, header and buttons are hidden.
          </p>
        )}

        {/* ---- Preview -------------------------------------------------------
          The SAME markup that prints, so what you see is what you get. It is
          also what `@media print` targets, which is why it stays mounted while
          the print dialog runs.
        */}
        {previewing && (
          <div className="border-border rounded-control max-h-[45vh] overflow-auto border p-3">
            <ReportPrintable data={data} sections={chosen} />
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ========================================================================== *
 * The printable document
 * ========================================================================== */

/**
 * Plain, typographic, and deliberately not the app's UI.
 *
 * A printed report goes to an accountant or into a file; the brass and navy
 * that make the screen feel premium cost ink and read as decoration on paper.
 */
export function ReportPrintable({
  data,
  sections,
}: {
  data: ReportData;
  sections: Set<ExportSection>;
}) {
  const inRange = React.useMemo(
    () =>
      data.movements
        .filter(
          (m) =>
            !m.is_opening &&
            m.type !== "transfer" &&
            m.date >= data.range.from &&
            m.date <= data.range.to,
        )
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [data],
  );

  return (
    <div id="report-print-area" className="text-foreground space-y-5 text-[11px]">
      <header className="border-border border-b pb-2">
        <h1 className="font-display text-[15px] font-bold">{data.householdName}</h1>
        <p className="text-muted text-[11px]">
          {data.range.label} · <span className="ltr">{data.range.from}</span> to{" "}
          <span className="ltr">{data.range.to}</span>
        </p>
      </header>

      {sections.has("summary") && (
        <section>
          <h2 className="mb-1.5 text-[10px] font-bold uppercase tracking-widest">Summary</h2>
          <table className="w-full border-collapse">
            <tbody>
              <PrintRow label="Money in" value={formatPKR(data.totals.incomePaisa)} />
              <PrintRow label="Money out" value={formatPKR(data.totals.expensePaisa)} />
              <PrintRow
                label="Net"
                value={formatPKR(data.totals.netPaisa)}
                strong
              />
              {data.totals.savingsRate !== null && (
                <PrintRow
                  label="Kept"
                  value={`${(data.totals.savingsRate * 100).toFixed(1)}%`}
                />
              )}
            </tbody>
          </table>
          <p className="text-faint mt-1.5 text-[9.5px] italic">
            Transfers between your own accounts, money lent, and opening
            balances are excluded — none of them is income or spending.
          </p>
        </section>
      )}

      {sections.has("categories") && data.categories.length > 0 && (
        <section>
          <h2 className="mb-1.5 text-[10px] font-bold uppercase tracking-widest">
            Where the money went
          </h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-border border-b text-start">
                <th className="py-1 text-start font-semibold">Category</th>
                <th className="py-1 text-end font-semibold">Amount</th>
                <th className="py-1 text-end font-semibold">Share</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((slice) => (
                <tr key={slice.categoryId ?? "none"} className="border-border border-b">
                  <td className="py-1">{slice.name}</td>
                  <td className="tnum py-1 text-end">{formatPKR(slice.amountPaisa)}</td>
                  <td className="tnum py-1 text-end">{(slice.share * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {sections.has("monthly") && (
        <section>
          <h2 className="mb-1.5 text-[10px] font-bold uppercase tracking-widest">Month by month</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-border border-b">
                <th className="py-1 text-start font-semibold">Month</th>
                <th className="py-1 text-end font-semibold">In</th>
                <th className="py-1 text-end font-semibold">Out</th>
                <th className="py-1 text-end font-semibold">Net</th>
              </tr>
            </thead>
            <tbody>
              {data.monthly.map((point) => (
                <tr key={point.key} className="border-border border-b">
                  <td className="py-1">{point.label}</td>
                  <td className="tnum py-1 text-end">{formatPKR(point.incomePaisa)}</td>
                  <td className="tnum py-1 text-end">{formatPKR(point.expensePaisa)}</td>
                  <td className="tnum py-1 text-end">{formatPKR(point.netPaisa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {sections.has("transactions") && (
        <section>
          <h2 className="mb-1.5 text-[10px] font-bold uppercase tracking-widest">
            Transactions ({inRange.length})
          </h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-border border-b">
                <th className="py-1 text-start font-semibold">Date</th>
                <th className="py-1 text-start font-semibold">Detail</th>
                <th className="py-1 text-start font-semibold">Category</th>
                <th className="py-1 text-end font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inRange.map((m) => (
                <tr key={m.id} className="border-border border-b">
                  <td className="ltr py-1">{m.date}</td>
                  <td className="py-1">{m.note ?? "—"}</td>
                  <td className="py-1">
                    {m.category_id
                      ? (data.categoryNameById.get(m.category_id) ?? "—")
                      : "Uncategorised"}
                  </td>
                  <td className="tnum py-1 text-end">
                    {formatPKR(Math.abs(Number(m.amount_paisa)))}
                    {Number(m.amount_paisa) < 0 ? " out" : " in"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <footer className="border-border text-faint border-t pt-2 text-[9.5px]">
        Generated by Bachat Book. Figures are a record of what you entered, not
        financial advice — verify anything tax-related with your own advisor.
      </footer>
    </div>
  );
}

function PrintRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <tr className="border-border border-b">
      <td className={`py-1 ${strong ? "font-bold" : ""}`}>{label}</td>
      <td className={`tnum py-1 text-end ${strong ? "font-bold" : ""}`}>{value}</td>
    </tr>
  );
}
