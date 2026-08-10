"use client";

import * as React from "react";
import { Users, Plus, Cake, Phone, Mail, Trash2 } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

export default function ContactsPage() {
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const householdId = session.household?.id || "";

  const [contacts, setContacts] = React.useState<Tables<"contacts">[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addModalOpen, setAddModalOpen] = React.useState(false);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [relationship, setRelationship] = React.useState("family");
  const [birthday, setBirthday] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function loadContacts() {
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .eq("household_id", householdId)
        .order("name", { ascending: true });

      if (active && data) {
        setContacts(data);
        setLoading(false);
      }
    }

    loadContacts();
    return () => {
      active = false;
    };
  }, [householdId, supabase]);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast({ type: "error", title: "Missing Name", description: "Please enter contact name." });
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("contacts").insert({
      household_id: householdId,
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      relationship,
      birthday: birthday || null,
      notes: notes.trim() || null,
    });

    setSubmitting(false);

    if (error) {
      showToast({ type: "error", title: "Could not add contact", description: error.message });
      return;
    }

    showToast({ type: "success", title: "Contact Added", description: `"${name}" added to household contacts.` });
    setName("");
    setEmail("");
    setPhone("");
    setBirthday("");
    setNotes("");
    setAddModalOpen(false);

    // Refresh
    const { data } = await supabase.from("contacts").select("*").eq("household_id", householdId).order("name", { ascending: true });
    if (data) setContacts(data);
  };

  const handleDeleteContact = async (id: string) => {
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) {
      showToast({ type: "error", title: "Delete Failed", description: error.message });
      return;
    }
    showToast({ type: "success", title: "Contact Removed", description: "Contact deleted." });
    setContacts(contacts.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Contacts & Birthdays Directory</h1>
          <p className="text-muted text-xs">
            Manage household contacts, family members, committee participants, and birthday reminders.
          </p>
        </div>

        <Button variant="primary" onClick={() => setAddModalOpen(true)} className="flex items-center gap-1.5 self-start sm:self-auto">
          <Plus size={16} />
          <span>Add Contact</span>
        </Button>
      </div>

      {loading ? (
        <div className="bg-surface border-border rounded-panel border p-8 text-center text-muted text-xs">
          Loading contacts directory...
        </div>
      ) : contacts.length === 0 ? (
        <div className="bg-surface border-border rounded-panel border p-12 text-center">
          <Users size={40} className="text-muted mx-auto mb-3" />
          <h3 className="font-display text-base font-semibold">No Contacts Saved</h3>
          <p className="text-muted text-xs mt-1 max-w-sm mx-auto">
            Save family members, committee participants, or service providers.
          </p>
          <Button variant="primary" onClick={() => setAddModalOpen(true)} className="mt-4">
            + Add First Contact
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((contact) => (
            <div key={contact.id} className="bg-surface border border-border rounded-panel p-5 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-brass/10 text-brass font-bold text-xs flex items-center justify-center">
                      {contact.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-semibold">{contact.name}</h3>
                      <span className="text-muted text-[11px] capitalize">{contact.relationship || "contact"}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteContact(contact.id)}
                    className="p-1 text-muted hover:text-loss rounded-full transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-muted">
                  {contact.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-brass shrink-0" />
                      <span>{contact.phone}</span>
                    </div>
                  )}

                  {contact.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-brass shrink-0" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                  )}

                  {contact.birthday && (
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <Cake size={14} className="text-brass shrink-0" />
                      <span>Birthday: {contact.birthday}</span>
                    </div>
                  )}

                  {contact.notes && (
                    <p className="text-[11px] text-muted-foreground pt-1 italic">{contact.notes}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Contact Modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Contact">
        <form onSubmit={handleAddContact} className="space-y-4">
          <Input
            label="Contact Name"
            placeholder="e.g. Tariq Mehmood"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Relationship"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              options={[
                { value: "family", label: "Family Member" },
                { value: "friend", label: "Friend" },
                { value: "colleague", label: "Colleague / Work" },
                { value: "committee_member", label: "Committee Participant" },
              ]}
            />

            <Input
              label="Birthday"
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone Number"
              placeholder="03001234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="name@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <Input
            label="Notes"
            placeholder="e.g. Committee #3 participant, Electrician"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Save Contact
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
