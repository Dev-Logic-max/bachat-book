/**
 * A verbatim copy of `web/src/lib/supabase/types.ts`. That file is the authority
 * and is HAND-WRITTEN — do not run `supabase gen types` over either of them.
 *
 * The generator emits table shapes and nothing else, so the string-union aliases
 * that mirror the CHECK constraints (`TransactionType`, `AccountType`,
 * `TaskPriority`, `HouseholdRole` …) vanish and take their import sites with
 * them, and every view column comes back nullable. The banner this file used to
 * carry — "regenerate after every migration" — was itself the trap.
 *
 * To refresh: edit the web file by hand, then `cp` it here. The two must not
 * drift; the previous copy still described `quick_entries`, a table deleted when
 * the ledger was unified, and so every entry write on the phone failed.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = "super_admin" | "admin" | "user";
export type HouseholdRole = "owner" | "member" | "viewer";
export type HouseholdKind = "personal" | "family" | "business";
export type NumberFormat = "lakh" | "western";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";
export type AccountType = "checking" | "savings" | "wallet" | "cash" | "credit" | "investment";
export type TransactionType = "income" | "expense" | "transfer";
/** Mirrors transactions_payment_method_check in 0011. */
export type PaymentMethod =
  | "cash"
  | "debit_card"
  | "credit_card"
  | "bank_transfer"
  | "raast"
  | "cheque"
  | "mobile_wallet"
  | "other";
export type EventType = "general" | "bill" | "salary" | "committee" | "tax" | "holiday" | "birthday";
export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "in_progress" | "done";
/** Which way a paid task moves money. Mirrors the entry form's two buttons. */
export type MovementDirection = "expense" | "income";
export type TaskRepeatRule = "none" | "daily" | "weekly" | "monthly" | "yearly";
/**
 * What an institution IS, for grouping the catalogue.
 *
 * Separate from `kind`, which is what it CAN DO — `bank` and `wallet` are the
 * two kinds you can hold an account with, and that axis drives the Add Account
 * picker. Splitting `kind` for presentation would mean every behavioural map
 * grows a branch, and one missed branch silently drops an institution.
 */
export type InstitutionSector =
  | "retail_bank"
  | "mobile_wallet"
  | "telecom"
  | "electricity"
  | "gas"
  | "water"
  | "government"
  | "other";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          avatar_url: string | null;
          locale: string;
          /** Province/territory code from lib/pk-geo.ts — PB, SD, KP, BA, IS, GB, AJ. */
          province: string | null;
          city: string | null;
          /** Picked key; 'other' means `occupation` below carries the real answer. */
          occupation_code: string | null;
          occupation: string | null;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          locale?: string;
          province?: string | null;
          city?: string | null;
          occupation_code?: string | null;
          occupation?: string | null;
          timezone?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      user_roles: {
        Row: { id: string; user_id: string; role: AppRole; created_at: string };
        Insert: { id?: string; user_id: string; role?: AppRole };
        Update: Partial<{ user_id: string; role: AppRole }>;
        Relationships: [];
      };
      households: {
        Row: {
          id: string;
          name: string;
          /** Behaviour. Three values, on purpose — every map keyed on it grows a branch. */
          kind: HouseholdKind;
          /** Content. Seeds the module set; never used for access control. */
          preset: string;
          owner_id: string;
          base_currency: string;
          city: string | null;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          kind?: HouseholdKind;
          preset?: string;
          owner_id: string;
          base_currency?: string;
          city?: string | null;
          timezone?: string;
        };
        Update: Partial<Database["public"]["Tables"]["households"]["Insert"]>;
        Relationships: [];
      };
      household_members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          role: HouseholdRole;
          joined_at: string;
        };
        Insert: { id?: string; household_id: string; user_id: string; role?: HouseholdRole };
        Update: Partial<Database["public"]["Tables"]["household_members"]["Insert"]>;
        Relationships: [];
      };
      plans: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          price_monthly_paisa: number;
          price_yearly_paisa: number;
          currency: string;
          limits: Json;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          price_monthly_paisa?: number;
          price_yearly_paisa?: number;
          currency?: string;
          limits?: Json;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["plans"]["Insert"]>;
        Relationships: [];
      };
      // A plan belongs to a PERSON, not a workspace. A workspace's effective
      // plan is its OWNER's — resolve it with household_plan_code(), never by
      // looking up the current user.
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          status: SubscriptionStatus;
          trial_ends_at: string | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          status?: SubscriptionStatus;
          trial_ends_at?: string | null;
          current_period_end?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
        Relationships: [];
      };
      platform_settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: { key: string; value?: Json; updated_by?: string | null };
        Update: Partial<Database["public"]["Tables"]["platform_settings"]["Insert"]>;
        Relationships: [];
      };
      household_invitations: {
        Row: {
          id: string;
          household_id: string;
          token: string;
          role: HouseholdRole;
          email: string | null;
          created_by: string;
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          token: string;
          role?: HouseholdRole;
          email?: string | null;
          created_by: string;
          expires_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["household_invitations"]["Insert"]> & {
          revoked_at?: string | null;
        };
        Relationships: [];
      };
      preferences: {
        Row: {
          user_id: string;
          default_household_id: string | null;
          number_format: NumberFormat;
          nisab_standard: string;
          is_filer: boolean;
          wallpaper: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          default_household_id?: string | null;
          number_format?: NumberFormat;
          nisab_standard?: string;
          is_filer?: boolean;
          wallpaper?: string;
        };
        Update: Partial<Database["public"]["Tables"]["preferences"]["Insert"]>;
        Relationships: [];
      };
      budgets: {
        Row: {
          id: string;
          household_id: string;
          category_id: string;
          period: "monthly" | "yearly";
          amount_paisa: number;
          start_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          category_id: string;
          period?: "monthly" | "yearly";
          amount_paisa: number;
          start_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["budgets"]["Insert"]>;
        Relationships: [];
      };
      committees: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          total_members: number;
          monthly_contribution_paisa: number;
          start_date: string;
          my_payout_month: number;
          payout_received: boolean;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          total_members?: number;
          monthly_contribution_paisa: number;
          start_date: string;
          my_payout_month?: number;
          payout_received?: boolean;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["committees"]["Insert"]>;
        Relationships: [];
      };
      zakat_records: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          hijri_year: number;
          gregorian_date: string;
          nisab_standard: "silver" | "gold";
          gold_rate_paisa_per_gram: number;
          silver_rate_paisa_per_gram: number;
          cash_and_bank_paisa: number;
          gold_silver_val_paisa: number;
          investments_paisa: number;
          liabilities_paisa: number;
          net_zakat_due_paisa: number;
          is_paid: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          hijri_year: number;
          gregorian_date?: string;
          nisab_standard?: "silver" | "gold";
          gold_rate_paisa_per_gram: number;
          silver_rate_paisa_per_gram: number;
          cash_and_bank_paisa: number;
          gold_silver_val_paisa: number;
          investments_paisa: number;
          liabilities_paisa: number;
          net_zakat_due_paisa: number;
          is_paid?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["zakat_records"]["Insert"]>;
        Relationships: [];
      };
      statement_imports: {
        Row: {
          id: string;
          household_id: string;
          account_id: string;
          file_name: string;
          bank_name: string;
          total_records: number;
          imported_records: number;
          status: "pending" | "processing" | "completed" | "failed";
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          account_id: string;
          file_name: string;
          bank_name: string;
          total_records?: number;
          imported_records?: number;
          status?: "pending" | "processing" | "completed" | "failed";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["statement_imports"]["Insert"]>;
        Relationships: [];
      };
      ai_chat_messages: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          sender: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          sender: "user" | "assistant";
          content: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_chat_messages"]["Insert"]>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          keys: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          keys: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Insert"]>;
        Relationships: [];
      };
      tax_profiles: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          is_filer: boolean;
          tax_year: number;
          employment_type: "salaried" | "business" | "freelancer";
          annual_taxable_income_paisa: number;
          tax_credits_paisa: number;
          wht_deducted_paisa: number;
          estimated_tax_due_paisa: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          is_filer?: boolean;
          tax_year?: number;
          employment_type?: "salaried" | "business" | "freelancer";
          annual_taxable_income_paisa?: number;
          tax_credits_paisa?: number;
          wht_deducted_paisa?: number;
          estimated_tax_due_paisa?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tax_profiles"]["Insert"]>;
        Relationships: [];
      };
      tax_deductions: {
        Row: {
          id: string;
          household_id: string;
          title: string;
          section: string;
          amount_paisa: number;
          certificate_url: string | null;
          tax_year: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          title: string;
          section: string;
          amount_paisa: number;
          certificate_url?: string | null;
          tax_year?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tax_deductions"]["Insert"]>;
        Relationships: [];
      };
      receipts: {
        Row: {
          id: string;
          household_id: string;
          transaction_id: string | null;
          merchant_name: string | null;
          total_amount_paisa: number | null;
          receipt_date: string;
          file_path: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          transaction_id?: string | null;
          merchant_name?: string | null;
          total_amount_paisa?: number | null;
          receipt_date?: string;
          file_path: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["receipts"]["Insert"]>;
        Relationships: [];
      };
      exchange_rates: {
        Row: {
          id: string;
          base_currency: string;
          target_currency: string;
          rate: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          base_currency?: string;
          target_currency: string;
          rate: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["exchange_rates"]["Insert"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          household_id: string;
          title: string;
          description: string | null;
          due_date: string;
          start_date: string | null;
          priority: TaskPriority;
          status: TaskStatus;
          is_done: boolean;
          linked_label: string | null;
          estimated_minutes: number | null;
          category: string | null;
          auto: boolean;
          /* A task that MOVES MONEY. Completing it writes a real ledger entry. */
          is_paid: boolean;
          /* UNSIGNED magnitude, like the entry form; the sign lives in
             `direction`. transactions.amount_paisa is the signed one. */
          amount_paisa: number | null;
          direction: MovementDirection | null;
          account_id: string | null;
          category_id: string | null;
          /* The ledger row this task created. Two-way synced by trigger. */
          settled_transaction_id: string | null;
          completed_at: string | null;
          repeat_rule: TaskRepeatRule;
          /* Days before the due date the next occurrence appears. Null = the
             minimum for this priority — see task_lead_days() in the DB. */
          repeat_lead_days: number | null;
          /* Groups every occurrence of one recurring task. */
          series_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          household_id: string;
          title: string;
          description?: string | null;
          due_date?: string;
          start_date?: string | null;
          priority?: TaskPriority;
          status?: TaskStatus;
          is_done?: boolean;
          linked_label?: string | null;
          estimated_minutes?: number | null;
          category?: string | null;
          auto?: boolean;
          is_paid?: boolean;
          amount_paisa?: number | null;
          direction?: MovementDirection | null;
          account_id?: string | null;
          category_id?: string | null;
          settled_transaction_id?: string | null;
          completed_at?: string | null;
          repeat_rule?: TaskRepeatRule;
          repeat_lead_days?: number | null;
          series_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: [];
      };
      task_checklist_items: {
        Row: {
          id: string;
          task_id: string;
          title: string;
          is_done: boolean;
          sort_order: number;
          /* UNSIGNED reference price, set as the subtask is ticked. Direction,
             account and category all live on the PARENT — there is one ledger
             row per task, and a subtask price never reaches it by itself. */
          amount_paisa: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          title: string;
          is_done?: boolean;
          sort_order?: number;
          amount_paisa?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["task_checklist_items"]["Insert"]>;
        Relationships: [];
      };
      calendar_events: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          title: string;
          description: string | null;
          start_at: string;
          end_at: string;
          is_all_day: boolean;
          event_type: EventType;
          color_code: string | null;
          recurrence_rule: string | null;
          linked_entity_type: string | null;
          linked_entity_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          title: string;
          description?: string | null;
          start_at: string;
          end_at: string;
          is_all_day?: boolean;
          event_type?: EventType;
          color_code?: string | null;
          recurrence_rule?: string | null;
          linked_entity_type?: string | null;
          linked_entity_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["calendar_events"]["Insert"]>;
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          relationship: string | null;
          birthday: string | null;
          notes: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          relationship?: string | null;
          birthday?: string | null;
          notes?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["contacts"]["Insert"]>;
        Relationships: [];
      };
      calendar_connections: {
        Row: {
          id: string;
          user_id: string;
          provider: "google" | "microsoft";
          account_email: string;
          access_token: string | null;
          refresh_token: string | null;
          expires_at: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: "google" | "microsoft";
          account_email: string;
          access_token?: string | null;
          refresh_token?: string | null;
          expires_at?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["calendar_connections"]["Insert"]>;
        Relationships: [];
      };
      institutions: {
        Row: {
          id: string;
          name: string;
          short_name: string;
          kind: "bank" | "wallet" | "utility" | "gov";
          /** Display grouping only — see InstitutionSector. */
          sector: InstitutionSector | null;
          brand_color: string;
          on_brand_color: string;
          logo_path: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          short_name: string;
          kind: "bank" | "wallet" | "utility" | "gov";
          sector?: InstitutionSector | null;
          brand_color?: string;
          on_brand_color?: string;
          logo_path?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["institutions"]["Insert"]>;
        Relationships: [];
      };
      household_hidden_categories: {
        Row: {
          household_id: string;
          category_id: string;
          hidden_at: string;
        };
        Insert: {
          household_id: string;
          category_id: string;
          hidden_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["household_hidden_categories"]["Insert"]
        >;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          /** Urdu label. NULL falls back to `name` — a household's own subcategory has no translation and must not render blank. */
          name_ur: string | null;
          icon: string;
          /** Path under /public to the rendered art, e.g. `/categories/food.png`. NULL renders the Lucide glyph instead. */
          art_path: string | null;
          tone: number;
          /** Ascending display priority. Pickers lead with what people actually use, not with what sorts first alphabetically. */
          sort_order: number;
          /** Retired categories stay on past transactions but leave every picker. */
          is_active: boolean;
          parent_id: string | null;
          kind: "expense" | "income" | "transfer";
          /** NULL = system catalog row, shared by every household. */
          household_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          name_ur?: string | null;
          icon?: string;
          art_path?: string | null;
          tone?: number;
          sort_order?: number;
          is_active?: boolean;
          parent_id?: string | null;
          kind?: "expense" | "income" | "transfer";
          household_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [];
      };
      merchants: {
        Row: {
          id: string;
          name: string;
          brand_color: string;
          logo_path: string | null;
          default_category_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          brand_color?: string;
          logo_path?: string | null;
          default_category_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["merchants"]["Insert"]>;
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          household_id: string;
          institution_id: string | null;
          name: string;
          type: AccountType;
          account_number_last4: string | null;
          currency: string;
          balance_paisa: number;
          /** Deactivated: reversible. Hidden everywhere, history intact. */
          is_archived: boolean;
          /**
           * Savings you may pay INTO but never spend FROM. Enforced by
           * assert_account_accepts_movement — a disabled dropdown option stops a
           * click, not an import or a REST call. Never true for `cash`.
           */
          is_locked: boolean;
          /** Soft-deleted. Rows referencing it render a "Deleted account" tag. */
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          institution_id?: string | null;
          name: string;
          type: AccountType;
          account_number_last4?: string | null;
          currency?: string;
          balance_paisa?: number;
          is_archived?: boolean;
          is_locked?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["accounts"]["Insert"]>;
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          household_id: string;
          account_id: string;
          category_id: string | null;
          merchant_id: string | null;
          transfer_account_id: string | null;
          /** Self-reference pairing the two halves of a transfer. NOT the entry link. */
          linked_transaction_id: string | null;
          /**
           * SIGNED. Income > 0, expense < 0. The balance trigger adds it directly.
           * transactions_amount_sign_check enforces the agreement with `type`;
           * transfers are exempt because their two legs carry opposite signs.
           */
          amount_paisa: number;
          type: TransactionType;
          date: string;
          note: string | null;
          /**
           * True = the balance this account STARTED with, not money earned.
           * Every "money in" figure must exclude these or the opening position is
           * counted as income for the month the account was created.
           */
          is_opening: boolean;
          /** Who logged it. Carried over from quick_entries.user_id. */
          created_by: string | null;
          is_cleared: boolean;
          reference_no: string | null;
          payment_method: PaymentMethod | null;
          attachment_path: string | null;
          original_amount: number | null;
          original_currency: string | null;
          fx_rate: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          account_id: string;
          category_id?: string | null;
          merchant_id?: string | null;
          transfer_account_id?: string | null;
          linked_transaction_id?: string | null;
          amount_paisa: number;
          type: TransactionType;
          date?: string;
          note?: string | null;
          is_opening?: boolean;
          created_by?: string | null;
          is_cleared?: boolean;
          reference_no?: string | null;
          payment_method?: PaymentMethod | null;
          attachment_path?: string | null;
          original_amount?: number | null;
          original_currency?: string | null;
          fx_rate?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
        Relationships: [];
      };
      transaction_splits: {
        Row: {
          id: string;
          transaction_id: string;
          category_id: string;
          amount_paisa: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          category_id: string;
          amount_paisa: number;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["transaction_splits"]["Insert"]>;
        Relationships: [];
      };
      rules: {
        Row: {
          id: string;
          household_id: string;
          pattern: string;
          category_id: string;
          merchant_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          pattern: string;
          category_id: string;
          merchant_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rules"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      // One row per workspace the caller can see, carrying rank, active state,
      // effective plan and seat usage — everything the switcher and the
      // workspaces page need, in one query instead of four.
      workspace_access: {
        Row: {
          id: string;
          name: string;
          kind: HouseholdKind;
          owner_id: string;
          created_at: string;
          owner_rank: number;
          is_active: boolean;
          plan_code: string;
          workspace_limit: number;
          member_limit: number;
          member_count: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      has_role: { Args: { _user_id: string; _role: AppRole }; Returns: boolean };
      is_household_member: { Args: { _household_id: string }; Returns: boolean };
      is_household_owner: { Args: { _household_id: string }; Returns: boolean };
      is_platform_admin: { Args: Record<never, never>; Returns: boolean };
      admin_set_subscription: {
        Args: {
          _user_id: string;
          _plan_code: string;
          _status?: SubscriptionStatus;
          _period_end?: string | null;
          _trial_ends_at?: string | null;
        };
        Returns: Json;
      };
      create_invitation: {
        Args: { _household_id: string; _role?: HouseholdRole; _email?: string | null };
        Returns: string;
      };
      invitation_preview: { Args: { _token: string }; Returns: Json };
      accept_invitation: { Args: { _token: string }; Returns: Json };
      add_member_by_email: {
        Args: { _household_id: string; _email: string; _role?: HouseholdRole };
        Returns: Json;
      };
      user_plan_limits: { Args: { _user_id: string }; Returns: Json };
      user_workspace_limit: { Args: { _user_id: string }; Returns: number };
      user_member_limit: { Args: { _user_id: string }; Returns: number };
      workspace_is_active: { Args: { _household_id: string }; Returns: boolean };
      household_plan_limits: { Args: { _household_id: string }; Returns: Json };
      household_plan_code: { Args: { _household_id: string }; Returns: string };
    };
    Enums: {
      app_role: AppRole;
      household_kind: HouseholdKind;
      household_role: HouseholdRole;
      number_format: NumberFormat;
      subscription_status: SubscriptionStatus;
    };
    CompositeTypes: Record<never, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
