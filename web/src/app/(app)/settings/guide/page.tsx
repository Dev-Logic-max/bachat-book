"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Link2,
  Link2Off,
  NotebookPen,
  Trash2,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * User-facing guide: what each module does and how every figure is calculated.
 *
 * This is product documentation — a feature — not design documentation, which
 * CLAUDE.md forbids. Keep it about how the app behaves for the person using it.
 */
export default function GuidePage() {
  return (
    <div className="space-y-5">
      <Section
        icon={<Wallet size={15} />}
        title="Where your money is counted"
        lead="Net worth on the dashboard is the sum of your account balances. Nothing else."
      >
        <p>
          Every account you add — bank, wallet, cash — contributes its balance to the
          big number on the dashboard. Quick entries do not, unless they are linked
          to an account. That keeps the figure reconcilable: it should always match
          what your banks say.
        </p>

        <WorkedExample />

        <Callout tone="brass">
          An unlinked entry is money you logged but did not attribute to an account.
          It appears in <Ref href="/entries">Entries</Ref> and in the dashboard&apos;s
          Quick log card — never in net worth.
        </Callout>
      </Section>

      <Section
        icon={<NotebookPen size={15} />}
        title="Entries vs Transactions"
        lead="Two separate records, on purpose."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MiniCard title="Entries" href="/entries">
            The fast daily log: chai, kiryana, a cash gift. Amount, category, date,
            note. No account required. Every figure on that page comes from entries
            alone.
          </MiniCard>
          <MiniCard title="Transactions" href="/transactions">
            Your bank and wallet ledger. Every row belongs to an account and moves
            its balance. This page shows transactions only.
          </MiniCard>
        </div>
        <p>
          Entries are deliberately kept out of the Transactions list. The moment they
          appeared there, that page&apos;s total would stop matching the sum of your
          account balances and nothing on screen would reconcile to a bank statement.
          The dashboard is the one place both are shown together.
        </p>
      </Section>

      <Section
        icon={<Link2 size={15} />}
        title="Linking an entry to an account"
        lead="Optional. Off by default."
      >
        <p>
          When you add an entry there is a{" "}
          <strong className="text-foreground font-medium">Link to account</strong>{" "}
          field. Leave it on <em>Not linked</em> and the entry is independent. Choose
          an account and Bachat Book creates a matching transaction in that
          account&apos;s ledger.
        </p>

        <Steps
          steps={[
            "Linked pairs stay in step. Change the amount, date, category or note on either side and the other updates automatically.",
            "The account balance moves with it, because the transaction half is a real ledger row.",
            "Unlinking is the only way to break the connection. After that both records live on independently.",
            "A linked row shows a small Linked badge, naming the account it is tied to.",
          ]}
        />

        <Callout tone="muted" icon={<Link2Off size={13} />}>
          <strong className="text-foreground font-medium">
            Running an account independently.
          </strong>{" "}
          In an account&apos;s edit dialog you can switch off linking entirely. Quick
          entries will then never be able to attach to it and it behaves as a pure
          bank ledger. Its balance still counts toward your net worth — the switch
          controls linking, not ownership. Existing links are left alone.
        </Callout>
      </Section>

      <Section
        icon={<Trash2 size={15} />}
        title="Deleting things"
        lead="Every delete asks first, and tells you what else it touches."
      >
        <Steps
          steps={[
            "A confirmation always appears, and it names the record — title, amount, date.",
            "If the record is linked to anything, every linked record is listed by name.",
            "The “also delete the linked records” box is ticked by default, so the normal action removes the whole set.",
            "Untick it and only the record you are on is deleted. The others are unlinked first and kept.",
            "When a delete changes an account balance, the new balance is spelled out before you confirm.",
          ]}
        />
        <Callout tone="loss">
          Deletes cannot be undone. Balances are always recalculated by the ledger
          itself, so a deleted transaction unwinds cleanly rather than leaving your
          account balance out of step with its rows.
        </Callout>
      </Section>

      <Section
        icon={<BadgeCheck size={15} />}
        title="Tax, Zakat and FBR figures"
        lead="The app calculates. It does not advise."
      >
        <p>
          Filer status is shown as a state — <em>Filer</em> or <em>Non-filer</em> —
          never as an amount. Zakat uses the silver nisab, and the tax year follows
          the FBR&apos;s July–June cycle.
        </p>
        <Callout tone="brass">
          Every tax and Zakat figure in Bachat Book is an estimate based on what you
          have entered. Verify it with your own advisor before you file or pay.
        </Callout>
      </Section>
    </div>
  );
}

function WorkedExample() {
  return (
    <div className="border-border bg-surface-subtle rounded-card border p-4">
      <p className="text-foreground-2 mb-3 text-[12px] font-medium">
        A worked example
      </p>
      <div className="space-y-2.5 text-[12px]">
        <Line label="Entry, not linked to any account" value="Rs 10,000" muted />
        <Line label="Entry, linked to your JazzCash wallet" value="Rs 5,000" muted />
        <div className="border-border border-t pt-2.5">
          <Line label="UBL Current balance" value="Rs 2,000" />
          <Line
            label="JazzCash balance (includes the linked Rs 5,000)"
            value="Rs 13,000"
          />
        </div>
        <div className="border-border flex items-center justify-between gap-3 border-t pt-2.5">
          <span className="text-foreground font-semibold">Net worth</span>
          <span className="tnum text-foreground font-mono text-[15px] font-bold">
            Rs 15,000
          </span>
        </div>
      </div>
      <p className="text-muted mt-3 text-[11.5px] leading-snug">
        The linked Rs 5,000 is counted <strong>once</strong>, through JazzCash. The
        unlinked Rs 10,000 is shown in your Quick log but is not part of net worth,
        because it is not sitting in an account you track.
      </p>
    </div>
  );
}

function Line({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={muted ? "text-muted" : "text-foreground-2"}>{label}</span>
      <span
        className={cn(
          "tnum shrink-0 font-mono",
          muted ? "text-muted" : "text-foreground font-medium",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Section({
  icon,
  title,
  lead,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface border-border rounded-panel border p-5 shadow-sm">
      <header className="mb-3">
        <h2 className="font-display flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
          <span className="bg-brass-soft text-brass-strong flex size-7 items-center justify-center rounded-full">
            {icon}
          </span>
          {title}
        </h2>
        <p className="text-muted mt-1.5 text-[12.5px]">{lead}</p>
      </header>
      <div className="text-foreground-2 space-y-3 text-[12.5px] leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function MiniCard({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="border-border bg-surface-subtle hover:border-brass/40 rounded-card border p-3.5 transition-colors"
    >
      <p className="text-foreground flex items-center gap-1 text-[13px] font-semibold">
        {title}
        <ArrowRight size={13} className="text-brass-strong" />
      </p>
      <p className="text-muted mt-1 text-[11.5px] leading-snug">{children}</p>
    </Link>
  );
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="bg-surface-3 text-foreground-2 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold">
            {i + 1}
          </span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

function Callout({
  tone,
  icon,
  children,
}: {
  tone: "brass" | "loss" | "muted";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-card border p-3.5 text-[12px] leading-relaxed",
        tone === "brass" && "bg-brass-soft border-brass/20 text-foreground-2",
        tone === "loss" && "bg-loss-soft border-loss/20 text-foreground-2",
        tone === "muted" && "bg-surface-subtle border-border text-foreground-2",
      )}
    >
      {icon && <span className="mr-1.5 inline-flex align-[-2px]">{icon}</span>}
      {children}
    </div>
  );
}

function Ref({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-brass-strong font-medium hover:underline">
      {children}
    </Link>
  );
}
