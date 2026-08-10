/**
 * Generated from the live schema. Regenerate after every migration:
 *   pnpm db:types
 *
 * Hand-edits here will be overwritten.
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
          city: string | null;
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
          city?: string | null;
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
          kind: HouseholdKind;
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
          price_annual_paisa: number;
          limits: Json;
          features: Json;
          sort_order: number;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          price_monthly_paisa?: number;
          price_annual_paisa?: number;
          limits?: Json;
          features?: Json;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["plans"]["Insert"]>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          household_id: string;
          plan_id: string;
          status: SubscriptionStatus;
          current_period_start: string | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          plan_id: string;
          status?: SubscriptionStatus;
          current_period_start?: string | null;
          current_period_end?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
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
      quick_entries: {
        Row: {
          id: string;
          user_id: string;
          household_id: string;
          type: "income" | "expense";
          /** UNSIGNED. Direction lives in `type`, unlike transactions.amount_paisa. */
          amount_paisa: number;
          /** Legacy free text. Display fallback only — write `category_id`. */
          category: string;
          category_id: string | null;
          note: string | null;
          entry_date: string;
          /** Null = standalone entry. Set = synced to that transaction (0011). */
          linked_transaction_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          household_id: string;
          type: "income" | "expense";
          amount_paisa: number;
          category: string;
          category_id?: string | null;
          note?: string | null;
          entry_date?: string;
          linked_transaction_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quick_entries"]["Insert"]>;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          title: string;
          is_done?: boolean;
          sort_order?: number;
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
          brand_color?: string;
          on_brand_color?: string;
          logo_path?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["institutions"]["Insert"]>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          icon: string;
          tone: number;
          parent_id: string | null;
          kind: "expense" | "income" | "transfer";
          /** NULL = system catalog row, shared by every household. */
          household_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          icon?: string;
          tone?: number;
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
          is_archived: boolean;
          /**
           * False = quick entries may never link to this account; it operates as
           * a pure bank ledger. Blocks linking only — the balance still counts
           * toward net worth. Enforced in the DB by assert_entry_link_valid().
           */
          allow_entry_link: boolean;
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
          allow_entry_link?: boolean;
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
          /** SIGNED. Income > 0, expense < 0. The balance trigger adds it directly. */
          amount_paisa: number;
          type: TransactionType;
          date: string;
          note: string | null;
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
    Views: Record<never, never>;
    Functions: {
      has_role: { Args: { _user_id: string; _role: AppRole }; Returns: boolean };
      is_household_member: { Args: { _household_id: string }; Returns: boolean };
      is_household_owner: { Args: { _household_id: string }; Returns: boolean };
      is_platform_admin: { Args: Record<never, never>; Returns: boolean };
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
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
