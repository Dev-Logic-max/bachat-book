"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Briefcase,
  Cake,
  Coins,
  KeyRound,
  Mail,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Smile,
  Truck,
  User,
  Users,
  Wrench,
} from "lucide-react";

import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { ContactModal } from "@/components/contact-modal";
import { EmptyState } from "@/components/empty-state";
import { PageActions } from "@/components/page-actions";
import { Reveal } from "@/components/reveal";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichSelect } from "@/components/ui/select";
import { RowActions } from "@/components/ui/row-actions";
import { useToast } from "@/components/ui/toast";
import {
  RELATIONSHIPS,
  daysUntilBirthday,
  matchesContact,
  relationship,
  summariseContact,
  turningAge,
  type Contact,
  type ContactMovement,
} from "@/lib/contacts";
import { contactBalancePaisa, withPayments, type DebtWithPayments } from "@/lib/debts";
import { formatPKR, formatPKRCompact } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

/** Lucide name → component, so `lib/contacts.ts` stays JSX-free. */
const REL_ICON: Record<string, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>> = {
  Users, Smile, Briefcase, Coins, Wrench, KeyRound, ShoppingBag, Truck, User,
};

export default function ContactsPage() {
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const householdId = session.household?.id || "";
  const readOnly = session.workspace ? !session.workspace.is_active : false;

  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [movements, setMovements] = React.useState<ContactMovement[]>([]);
  const [debts, setDebts] = React.useState<DebtWithPayments[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [query, setQuery] = React.useState("");
  const [relFilter, setRelFilter] = React.useState("all");

  const [addOpen, setAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Contact | null>(null);
  const [deleting, setDeleting] = React.useState<Contact | null>(null);

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function load() {
      const [contactRes, movementRes, debtRes, paymentRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("*")
          .eq("household_id", householdId)
          .order("name"),
        // Only movements that NAME somebody. Pulling the whole ledger to filter
        // it client-side would grow without bound on a real household.
        supabase
          .from("transactions")
          .select("id, date, amount_paisa, contact_id, type, is_opening, note")
          .eq("household_id", householdId)
          .not("contact_id", "is", null),
        // Only OPEN debts reach a contact card — a settled one is not a balance.
        supabase
          .from("debts")
          .select("*")
          .eq("household_id", householdId)
          .eq("status", "open")
          .not("contact_id", "is", null),
        supabase.from("debt_payments").select("*").eq("household_id", householdId),
      ]);

      if (!active) return;

      const firstError =
        contactRes.error || movementRes.error || debtRes.error || paymentRes.error;
      if (firstError) {
        setLoadError(firstError.message);
        setLoading(false);
        return;
      }

      setContacts(contactRes.data ?? []);
      setMovements((movementRes.data ?? []) as ContactMovement[]);
      setDebts(withPayments(debtRes.data ?? [], paymentRes.data ?? []));
      setLoadError(null);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [householdId, refreshKey, supabase]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const visible = React.useMemo(
    () =>
      contacts.filter(
        (c) =>
          (relFilter === "all" || c.relationship === relFilter) && matchesContact(c, query),
      ),
    [contacts, relFilter, query],
  );

  /* The next three birthdays, so the calendar is not the only place they live. */
  const upcoming = React.useMemo(() => {
    return contacts
      .filter((c) => c.birthday)
      .map((c) => ({ contact: c, days: daysUntilBirthday(c.birthday!) ?? 9999 }))
      .filter((row) => row.days <= 45)
      .sort((a, b) => a.days - b.days)
      .slice(0, 3);
  }, [contacts]);

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("contacts").delete().eq("id", deleting.id);
    if (error) {
      showToast({ type: "error", title: "Could not remove them", description: error.message });
      return;
    }
    showToast({
      type: "success",
      title: "Contact removed",
      description: "Their entries stay in your ledger — they just stop naming anyone.",
    });
    setDeleting(null);
    refresh();
  };

  const deletingCount = deleting
    ? movements.filter((m) => m.contact_id === deleting.id).length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
            Contacts
          </h1>
          <p className="text-muted mt-0.5 text-[12.5px]">
            The people behind your money — who you pay, who pays you, and whose
            birthday is coming.
          </p>
        </div>

        <PageActions
          title="Contacts"
          actions={[
            {
              label: "Add contact",
              shortLabel: "Contact",
              hint: "Someone you pay, owe, or share a committee with",
              icon: Plus,
              tone: "primary",
              disabled: readOnly,
              onClick: () => {
                setEditing(null);
                setAddOpen(true);
              },
            },
          ]}
        />
      </div>

      {loadError && (
        <div className="border-loss/25 bg-loss/8 text-loss rounded-panel border px-4 py-3 text-[12.5px]">
          Could not load your contacts: {loadError}
        </div>
      )}

      {/* ---- Birthdays worth knowing about --------------------------------- */}
      {upcoming.length > 0 && (
        <Reveal>
          <div className="border-brass/25 bg-brass/8 rounded-panel border p-4">
            <p className="text-brass-strong mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest">
              <Cake size={13} />
              Coming up
            </p>
            <ul className="flex flex-wrap gap-x-6 gap-y-1.5">
              {upcoming.map(({ contact, days }) => {
                const age = turningAge(contact.birthday!);
                return (
                  <li key={contact.id} className="text-[12.5px]">
                    <span className="text-foreground font-medium">{contact.name}</span>
                    <span className="text-muted">
                      {" — "}
                      {days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}
                      {age !== null && `, turning ${age}`}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-muted mt-2 text-[11px]">
              These also appear on your{" "}
              <Link href="/calendar" className="text-brass-strong underline underline-offset-2">
                calendar
              </Link>
              , so gift spending stops arriving as a surprise.
            </p>
          </div>
        </Reveal>
      )}

      {/* ---- Search and filter --------------------------------------------- */}
      {contacts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
          <Input
            placeholder="Search by name, phone, note…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            prefixIcon={<Search size={15} />}
            aria-label="Search contacts"
          />
          <RichSelect
            value={relFilter}
            onChange={setRelFilter}
            options={[
              { value: "all", label: "Everyone" },
              ...RELATIONSHIPS.map((r) => ({
                value: r.key,
                label: r.label,
                secondaryLabel: r.labelUr,
              })),
            ]}
          />
        </div>
      )}

      {/* ---- People --------------------------------------------------------- */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-surface border-border rounded-panel shimmer h-40 border" />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          title="No one saved yet"
          /* No contacts-specific art yet — the generic empty shelf, deliberately,
             rather than a person illustration that would be the wrong subject. */
          imageSrc="/art/empty-contacts.webp"
          description="Add the people your money actually moves between — the committee organiser, your plumber, the cousin you lend to. You can then name them on an entry and see everything that passed between you."
          action={
            <Button variant="primary" onClick={() => setAddOpen(true)} disabled={readOnly}>
              Add your first contact
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <div className="bg-surface border-border rounded-panel text-muted border p-8 text-center text-xs">
          Nobody matches that.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((contact, i) => (
            <Reveal key={contact.id} index={i}>
              <ContactCard
                contact={contact}
                summary={summariseContact(contact.id, movements)}
                udhaarPaisa={contactBalancePaisa(contact.id, debts)}
                readOnly={readOnly}
                onEdit={() => setEditing(contact)}
                onDelete={() => setDeleting(contact)}
              />
            </Reveal>
          ))}
        </div>
      )}

      <ContactModal
        isOpen={addOpen || editing !== null}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        onSaved={refresh}
        householdId={householdId}
        contact={editing}
      />

      <ConfirmDeleteModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Remove this contact?"
        recordLabel={deleting?.name ?? ""}
        recordMeta={deleting ? relationship(deleting.relationship).label : undefined}
        cascadeHint={
          deletingCount > 0
            ? `${deletingCount} ${deletingCount === 1 ? "entry names" : "entries name"} them. Those entries stay exactly as they are and simply stop naming anyone — no amount or balance changes.`
            : "Nothing in your ledger names them, so this removes the contact only."
        }
        confirmLabel="Remove contact"
      />
    </div>
  );
}

/* ========================================================================== */

function ContactCard({
  contact,
  summary,
  udhaarPaisa,
  readOnly,
  onEdit,
  onDelete,
}: {
  contact: Contact;
  summary: ReturnType<typeof summariseContact>;
  /** Positive = they owe you. Negative = you owe them. 0 = nothing open. */
  udhaarPaisa: number;
  readOnly: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const rel = relationship(contact.relationship);
  const Icon = REL_ICON[rel.icon] ?? User;
  const days = contact.birthday ? daysUntilBirthday(contact.birthday) : null;

  return (
    <div className="group bg-surface border-border rounded-panel focus-within:border-brass/40 flex h-full flex-col border p-5 shadow-xs transition-colors">
      <div className="flex items-start gap-3">
        <span className="bg-brass/10 text-brass-strong flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
          {contact.name.slice(0, 2).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-foreground truncate text-[13.5px] font-semibold">
            {contact.name}
          </h3>
          <p className="text-muted flex items-center gap-1 truncate text-[11px]">
            <Icon size={11} strokeWidth={1.9} />
            {rel.label}
          </p>
        </div>

        {!readOnly && (
          <RowActions
            onEdit={onEdit}
            onDelete={onDelete}
            editLabel="Edit contact"
            deleteLabel="Remove contact"
            reveal="always"
          />
        )}
      </div>

      <div className="text-muted mt-3 space-y-1 text-[11.5px]">
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className="hover:text-foreground flex items-center gap-2 transition-colors"
          >
            <Phone size={12} className="text-brass-strong shrink-0" />
            <span className="ltr tnum">{contact.phone}</span>
          </a>
        )}
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="hover:text-foreground flex items-center gap-2 truncate transition-colors"
          >
            <Mail size={12} className="text-brass-strong shrink-0" />
            <span className="ltr truncate">{contact.email}</span>
          </a>
        )}
        {contact.birthday && (
          <p className="flex items-center gap-2">
            <Cake size={12} className="text-brass-strong shrink-0" />
            <span className="ltr">{contact.birthday}</span>
            {days !== null && days <= 45 && (
              <span className="text-brass-strong font-medium">
                {days === 0 ? "· today" : `· in ${days}d`}
              </span>
            )}
          </p>
        )}
      </div>

      {/*
        What this person actually owes, or is owed.

        This is the ONE figure on the card that is a real debt, and it comes
        from `debts` rather than from the ledger — which is why it is separated
        from the two below it by more than a line. The paid/received pair is the
        net of ordinary movements and must never be read as a balance.
      */}
      {udhaarPaisa !== 0 && (
        <Link
          href="/debts"
          className={`mt-3 flex items-center justify-between gap-2 rounded-control border px-2.5 py-2 transition-colors ${
            udhaarPaisa > 0
              ? "border-gain/25 bg-gain/8 hover:border-gain/40"
              : "border-loss/25 bg-loss/8 hover:border-loss/40"
          }`}
        >
          <span className="text-muted text-[10px] font-semibold uppercase tracking-widest">
            {udhaarPaisa > 0 ? "Owes you" : "You owe"}
          </span>
          <span
            className={`tnum text-[13px] font-semibold ${udhaarPaisa > 0 ? "text-gain" : "text-loss"}`}
          >
            {formatPKR(Math.abs(udhaarPaisa))}
          </span>
        </Link>
      )}

      {/*
        What has actually passed between you.

        Deliberately two figures rather than one "balance": a single net number
        would read as "Ahmed owes you Rs 30,000" when all it means is that more
        came in than went out. Paid and received state only what was recorded.
      */}
      <div className="border-border mt-auto grid grid-cols-2 gap-2 border-t pt-3">
        <div>
          <p className="text-muted flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest">
            <ArrowUpRight size={10} /> You paid
          </p>
          <p className="tnum text-foreground-2 mt-0.5 text-[12.5px] font-semibold">
            {summary.paidPaisa > 0 ? formatPKRCompact(summary.paidPaisa) : "—"}
          </p>
        </div>
        <div>
          <p className="text-muted flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest">
            <ArrowDownLeft size={10} /> They paid
          </p>
          <p className="tnum text-foreground-2 mt-0.5 text-[12.5px] font-semibold">
            {summary.receivedPaisa > 0 ? formatPKRCompact(summary.receivedPaisa) : "—"}
          </p>
        </div>
      </div>

      <p className="text-faint mt-2 text-[10.5px]">
        {summary.count === 0 ? (
          "Nothing logged against them yet — name them on an entry to start."
        ) : (
          <>
            <span className="tnum">{summary.count}</span>{" "}
            {summary.count === 1 ? "entry" : "entries"}
            {summary.lastDate && (
              <>
                {" · last on "}
                <span className="ltr">{summary.lastDate}</span>
              </>
            )}
            {summary.netPaisa !== 0 && (
              <>
                {" · net "}
                <span className="tnum">{formatPKR(Math.abs(summary.netPaisa))}</span>
                {summary.netPaisa > 0 ? " their way in" : " your way out"}
              </>
            )}
          </>
        )}
      </p>

      {contact.notes && (
        <p className="text-muted border-border mt-2 border-t pt-2 text-[11px] italic">
          {contact.notes}
        </p>
      )}
    </div>
  );
}
