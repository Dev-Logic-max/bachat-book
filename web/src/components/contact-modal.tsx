"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RichSelect } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { RELATIONSHIPS, type Contact } from "@/lib/contacts";
import { todayISO } from "@/lib/ledger";
import { createClient } from "@/lib/supabase/client";

export function ContactModal({
  isOpen,
  onClose,
  onSaved,
  householdId,
  contact,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Receives the saved row, so a caller can select it straight away. */
  onSaved: (saved: Contact) => void;
  householdId: string;
  /** Null for a new person. */
  contact: Contact | null;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const isEdit = Boolean(contact);

  const [name, setName] = React.useState("");
  const [relationshipKey, setRelationshipKey] = React.useState("family");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [birthday, setBirthday] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const seedKey = `${isOpen}:${contact?.id ?? "new"}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    setName(contact?.name ?? "");
    setRelationshipKey(contact?.relationship ?? "family");
    setPhone(contact?.phone ?? "");
    setEmail(contact?.email ?? "");
    setBirthday(contact?.birthday ?? "");
    setNotes(contact?.notes ?? "");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast({ type: "error", title: "Name is needed", description: "Who is this?" });
      return;
    }

    setSubmitting(true);

    const payload = {
      household_id: householdId,
      name: name.trim(),
      relationship: relationshipKey,
      phone: phone.trim() || null,
      email: email.trim() || null,
      birthday: birthday || null,
      notes: notes.trim() || null,
    };

    const query = contact
      ? supabase.from("contacts").update(payload).eq("id", contact.id).select("*").single()
      : supabase.from("contacts").insert(payload).select("*").single();

    const { data, error } = await query;
    setSubmitting(false);

    if (error || !data) {
      showToast({
        type: "error",
        title: isEdit ? "Could not save" : "Could not add them",
        description: error?.message ?? "Something went wrong.",
      });
      return;
    }

    showToast({
      type: "success",
      title: isEdit ? "Contact updated" : "Contact added",
      description: `${data.name} is in your contacts.`,
    });
    onSaved(data as Contact);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit contact" : "Add a contact"}
      subtitle="People you pay, owe, share a committee with, or want to remember."
      icon={<UserPlus size={18} />}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            {isEdit ? "Save changes" : "Add contact"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Name"
          placeholder="e.g. Tariq Mehmood"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <RichSelect
          label="How do you know them?"
          value={relationshipKey}
          onChange={setRelationshipKey}
          options={RELATIONSHIPS.map((r) => ({
            value: r.key,
            label: r.label,
            secondaryLabel: r.labelUr,
            description: r.hint,
          }))}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Phone"
            placeholder="03001234567"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            placeholder="name@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/*
          `max` is today: a birthday in the future is a typo every time, and it
          would otherwise sit on the calendar as a permanently-upcoming event.
        */}
        <DatePicker
          label="Birthday"
          value={birthday}
          onChange={setBirthday}
          max={todayISO()}
          hint="Shows on your calendar every year, so the gift is not a surprise expense."
        />

        <Input
          label="Note"
          placeholder="e.g. runs committee #3, pays on the 5th"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  );
}
