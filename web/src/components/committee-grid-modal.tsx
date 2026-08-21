"use client";

import * as React from "react";
import { Check, Grid3x3, Plus, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { RowActions } from "@/components/ui/row-actions";
import {
  committeeTotals,
  contributionsByCell,
  currentMonthIndex,
  isComplete,
  monthIndexes,
  myMember,
  paymentKey,
  payoutStance,
  STANCE_LABEL,
  type CommitteeFull,
  type CommitteeMember,
  type CommitteePayment,
} from "@/lib/committees";
import { formatPKR, formatPKRCompact } from "@/lib/format";

/**
 * The payment grid — who has paid, for which round.
 *
 * A committee is a table by nature: members down, rounds across. Every other
 * shape hides the one question people actually ask, which is "who still owes
 * this month". The grid answers it at a glance and each square is one payment,
 * so the unique index on (committee, member, month, kind) maps exactly onto
 * what you can click.
 *
 * MY row is pinned to the top and tinted, because it is the only row whose
 * squares move real money.
 */
export function CommitteeGridModal({
  isOpen,
  onClose,
  committee,
  readOnly,
  onAddMember,
  onEditMember,
  onDeleteMember,
  onCell,
  onEditPayment,
  onRecordPayout,
}: {
  isOpen: boolean;
  onClose: () => void;
  committee: CommitteeFull | null;
  readOnly: boolean;
  onAddMember: () => void;
  onEditMember: (member: CommitteeMember) => void;
  onDeleteMember: (member: CommitteeMember) => void;
  /** An empty square was clicked — record an instalment. */
  onCell: (member: CommitteeMember, monthIndex: number) => void;
  /** A filled square was clicked — edit or remove that instalment. */
  onEditPayment: (member: CommitteeMember, payment: CommitteePayment) => void;
  onRecordPayout: () => void;
}) {
  if (!committee) return null;

  const months = monthIndexes(committee);
  const cells = contributionsByCell(committee.payments);
  const totals = committeeTotals(committee);
  const me = myMember(committee.members);
  const thisMonth = currentMonthIndex(committee);
  const complete = isComplete(committee);

  // Me first — the only row whose squares reach the ledger.
  const ordered = [...committee.members].sort((a, b) =>
    a.is_me === b.is_me ? a.member_name.localeCompare(b.member_name) : a.is_me ? -1 : 1,
  );

  const payout = committee.payments.find((p) => p.kind === "payout") ?? null;
  const stance = me?.payout_month
    ? payoutStance(me.payout_month, committee.total_members)
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={committee.name}
      subtitle={`${committee.total_members} rounds · ${formatPKR(Number(committee.monthly_contribution_paisa))} each`}
      icon={<Grid3x3 size={18} />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          {!readOnly && (
            <Button type="button" variant="secondary" onClick={onAddMember}>
              <UserPlus size={14} />
              Add member
            </Button>
          )}
          {!readOnly && me && !payout && (
            <Button type="button" variant="primary" onClick={onRecordPayout}>
              <Plus size={14} />
              Record my payout
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* ---- Where I stand ------------------------------------------------ */}
        <div className="border-border bg-surface-subtle rounded-control grid grid-cols-2 gap-2 border p-3 sm:grid-cols-4">
          <Figure label="I have paid in" value={formatPKR(totals.paidInPaisa)} />
          <Figure
            label="I have taken out"
            value={totals.takenOutPaisa > 0 ? formatPKR(totals.takenOutPaisa) : "—"}
            tone={totals.takenOutPaisa > 0 ? "gain" : "muted"}
          />
          <Figure label="One turn is worth" value={formatPKRCompact(totals.poolPaisa)} />
          <Figure
            label="My instalments"
            value={`${totals.myPaidCount} of ${committee.total_members}`}
          />
        </div>

        {stance && (
          <p
            className={`rounded-control border px-3 py-2 text-[11.5px] leading-snug ${
              stance === "borrow"
                ? "border-brass/30 bg-brass/8 text-brass-strong"
                : stance === "save"
                  ? "border-gain/25 bg-gain/8 text-gain"
                  : "border-border bg-surface-subtle text-muted"
            }`}
          >
            {STANCE_LABEL[stance]}
          </p>
        )}

        {complete && (
          <p className="border-gain/25 bg-gain/8 text-gain rounded-control flex items-center gap-2 border px-3 py-2 text-[11.5px]">
            <Check size={14} />
            Every member has paid every round — this committee is finished.
          </p>
        )}

        {/* ---- The grid ------------------------------------------------------
          Scrolls INSIDE its own box. A 20-round committee is 20 columns wide and
          must never make the modal itself scroll sideways.
        */}
        {committee.members.length === 0 ? (
          <div className="border-border text-muted rounded-control border border-dashed p-6 text-center text-[11.5px]">
            <p>No members yet.</p>
            <p className="mt-1">
              Add everyone in the committee — including yourself — and the grid
              appears here.
            </p>
          </div>
        ) : (
          <div className="border-border overflow-x-auto rounded-control border">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-surface-subtle">
                  <th className="text-muted sticky start-0 z-10 bg-surface-subtle px-2 py-2 text-start font-semibold uppercase tracking-widest">
                    Member
                  </th>
                  {months.map((m) => (
                    <th
                      key={m}
                      className={`px-1 py-2 text-center font-semibold ${
                        m === thisMonth ? "text-brass-strong" : "text-muted"
                      }`}
                      title={m === thisMonth ? "This round" : `Round ${m}`}
                    >
                      {m}
                    </th>
                  ))}
                  <th className="text-muted px-2 py-2 text-end font-semibold">Paid</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((member) => {
                  const paidCount = months.filter((m) =>
                    cells.has(paymentKey(member.id, m)),
                  ).length;

                  return (
                    <tr
                      key={member.id}
                      className={`group border-border border-t ${member.is_me ? "bg-brass/[0.06]" : ""}`}
                    >
                      <td className="sticky start-0 z-10 bg-inherit px-2 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="min-w-0">
                            <p className="text-foreground truncate text-[11.5px] font-medium">
                              {member.member_name}
                              {member.is_me && (
                                <span className="text-brass-strong ms-1 font-semibold">(me)</span>
                              )}
                            </p>
                            {member.payout_month && (
                              <p className="text-faint text-[10px]">
                                turn {member.payout_month}
                              </p>
                            )}
                          </div>
                          {!readOnly && (
                            <RowActions
                              onEdit={() => onEditMember(member)}
                              onDelete={() => onDeleteMember(member)}
                              editLabel="Edit member"
                              deleteLabel="Remove member"
                              reveal="hover"
                            />
                          )}
                        </div>
                      </td>

                      {months.map((m) => {
                        const payment = cells.get(paymentKey(member.id, m));
                        const isTurn = member.payout_month === m;
                        return (
                          <td key={m} className="px-0.5 py-1 text-center">
                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={() =>
                                payment
                                  ? onEditPayment(member, payment)
                                  : onCell(member, m)
                              }
                              title={
                                payment
                                  ? `${formatPKR(Number(payment.amount_paisa))} on ${payment.paid_on}`
                                  : `Record round ${m} for ${member.member_name}`
                              }
                              className={`mx-auto flex size-6 items-center justify-center rounded-md border text-[10px] transition-colors disabled:cursor-default ${
                                payment
                                  ? "border-gain/30 bg-gain/15 text-gain"
                                  : isTurn
                                    ? "border-brass/40 bg-brass/10 text-brass-strong hover:bg-brass/20"
                                    : "border-border text-faint hover:border-brass/40 hover:bg-surface-subtle"
                              }`}
                            >
                              {payment ? <Check size={12} /> : isTurn ? "★" : ""}
                            </button>
                          </td>
                        );
                      })}

                      <td className="tnum text-foreground-2 px-2 py-1.5 text-end font-medium">
                        {paidCount}/{committee.total_members}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-faint text-[10.5px] leading-snug">
          ★ marks whose turn that round is. Only <strong>your own</strong> squares
          move money — your instalments are logged as expenses and your payout as
          income. Everyone else&apos;s squares are tracked here only, because their
          money never passes through your accounts.
        </p>
      </div>
    </Modal>
  );
}

function Figure({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "gain" | "muted";
}) {
  const toneClass =
    tone === "gain" ? "text-gain" : tone === "muted" ? "text-muted" : "text-foreground";
  return (
    <div className="min-w-0">
      <p className="text-muted text-[10px] font-semibold uppercase tracking-widest">{label}</p>
      <p className={`tnum mt-0.5 truncate text-[13px] font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
