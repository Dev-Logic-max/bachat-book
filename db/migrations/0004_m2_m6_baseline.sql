--
-- PostgreSQL database dump
--

\restrict rdAYVHBTgvH4zXywPB02a4nvpVYegaeSuKVq4qnynIKtD4XjdRTv5T8nT86jMLm

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'super_admin',
    'admin',
    'user'
);


--
-- Name: household_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.household_kind AS ENUM (
    'personal',
    'family',
    'business'
);


--
-- Name: household_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.household_role AS ENUM (
    'owner',
    'member',
    'viewer'
);


--
-- Name: number_format; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.number_format AS ENUM (
    'lakh',
    'western'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'trialing',
    'active',
    'past_due',
    'canceled'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_household_id uuid;
  v_free_plan_id uuid;
  v_first text;
  v_last text;
BEGIN
  v_first := coalesce(new.raw_user_meta_data ->> 'first_name', '');
  v_last  := coalesce(new.raw_user_meta_data ->> 'last_name', '');

  INSERT INTO public.profiles (id, first_name, last_name, email)
  VALUES (new.id, v_first, v_last, new.email);

  INSERT INTO public.preferences (user_id) VALUES (new.id);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.households (name, kind, owner_id, base_currency, city)
  VALUES (
    coalesce(nullif(trim(v_first || ' ' || coalesce(v_last, '')), ''), 'My Finance') || '''s Finances',
    'personal',
    new.id,
    'PKR',
    NULL
  )
  RETURNING id INTO v_household_id;

  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (v_household_id, new.id, 'owner');

  SELECT id INTO v_free_plan_id FROM public.plans WHERE code = 'free' LIMIT 1;
  IF v_free_plan_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (household_id, plan_id, status)
    VALUES (v_household_id, v_free_plan_id, 'active');
  END IF;

  UPDATE public.preferences
  SET default_household_id = v_household_id
  WHERE user_id = new.id;

  RETURN new;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;


--
-- Name: is_household_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_household_member(_household_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from public.household_members
    where household_id = _household_id and user_id = auth.uid()
  );
$$;


--
-- Name: is_household_owner(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_household_owner(_household_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from public.household_members
    where household_id = _household_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;


--
-- Name: is_platform_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_platform_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('super_admin','admin')
  );
$$;


--
-- Name: sync_account_balance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_account_balance() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if TG_OP = 'INSERT' then
    update public.accounts
       set balance_paisa = balance_paisa + NEW.amount_paisa, updated_at = now()
     where id = NEW.account_id;

  elsif TG_OP = 'DELETE' then
    update public.accounts
       set balance_paisa = balance_paisa - OLD.amount_paisa, updated_at = now()
     where id = OLD.account_id;

  elsif TG_OP = 'UPDATE' then
    if OLD.account_id is not distinct from NEW.account_id then
      update public.accounts
         set balance_paisa = balance_paisa - OLD.amount_paisa + NEW.amount_paisa,
             updated_at = now()
       where id = NEW.account_id;
    else
      -- Transaction moved accounts: unwind the old, apply to the new.
      update public.accounts
         set balance_paisa = balance_paisa - OLD.amount_paisa, updated_at = now()
       where id = OLD.account_id;
      update public.accounts
         set balance_paisa = balance_paisa + NEW.amount_paisa, updated_at = now()
       where id = NEW.account_id;
    end if;
  end if;
  return null;
end;
$$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    institution_id text,
    name text NOT NULL,
    type text NOT NULL,
    account_number_last4 text,
    currency text DEFAULT 'PKR'::text NOT NULL,
    balance_paisa bigint DEFAULT 0 NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT accounts_type_check CHECK ((type = ANY (ARRAY['checking'::text, 'savings'::text, 'wallet'::text, 'cash'::text, 'credit'::text, 'investment'::text])))
);


--
-- Name: ai_chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    user_id uuid NOT NULL,
    sender text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_chat_messages_sender_check CHECK ((sender = ANY (ARRAY['user'::text, 'assistant'::text])))
);


--
-- Name: budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    category_id text NOT NULL,
    period text DEFAULT 'monthly'::text NOT NULL,
    amount_paisa bigint NOT NULL,
    start_date date DEFAULT (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT budgets_period_check CHECK ((period = ANY (ARRAY['monthly'::text, 'yearly'::text])))
);


--
-- Name: calendar_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider text NOT NULL,
    account_email text NOT NULL,
    access_token text,
    refresh_token text,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calendar_connections_provider_check CHECK ((provider = ANY (ARRAY['google'::text, 'microsoft'::text])))
);


--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    is_all_day boolean DEFAULT false NOT NULL,
    event_type text NOT NULL,
    color_code text DEFAULT '#C6A15B'::text,
    recurrence_rule text,
    linked_entity_type text,
    linked_entity_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calendar_events_event_type_check CHECK ((event_type = ANY (ARRAY['general'::text, 'bill'::text, 'salary'::text, 'committee'::text, 'tax'::text, 'holiday'::text, 'birthday'::text])))
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id text NOT NULL,
    name text NOT NULL,
    icon text DEFAULT 'Tag'::text NOT NULL,
    tone integer DEFAULT 1 NOT NULL,
    parent_id text,
    kind text DEFAULT 'expense'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    household_id uuid,
    CONSTRAINT categories_kind_check CHECK ((kind = ANY (ARRAY['expense'::text, 'income'::text, 'transfer'::text])))
);


--
-- Name: committees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.committees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    name text NOT NULL,
    total_members integer DEFAULT 10 NOT NULL,
    monthly_contribution_paisa bigint NOT NULL,
    start_date date NOT NULL,
    my_payout_month integer DEFAULT 1 NOT NULL,
    payout_received boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    relationship text DEFAULT 'friend'::text,
    birthday date,
    notes text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: exchange_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exchange_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    base_currency text DEFAULT 'PKR'::text NOT NULL,
    target_currency text NOT NULL,
    rate numeric(14,6) NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: household_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.household_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.household_role DEFAULT 'member'::public.household_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: households; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.households (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    kind public.household_kind DEFAULT 'family'::public.household_kind NOT NULL,
    owner_id uuid NOT NULL,
    base_currency text DEFAULT 'PKR'::text NOT NULL,
    city text,
    timezone text DEFAULT 'Asia/Karachi'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: institutions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institutions (
    id text NOT NULL,
    name text NOT NULL,
    short_name text NOT NULL,
    kind text NOT NULL,
    brand_color text DEFAULT '#0B1A33'::text NOT NULL,
    on_brand_color text DEFAULT '#ffffff'::text NOT NULL,
    logo_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT institutions_kind_check CHECK ((kind = ANY (ARRAY['bank'::text, 'wallet'::text, 'utility'::text, 'gov'::text])))
);


--
-- Name: merchants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.merchants (
    id text NOT NULL,
    name text NOT NULL,
    brand_color text DEFAULT '#6e6a62'::text NOT NULL,
    logo_path text,
    default_category_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    price_monthly_paisa bigint DEFAULT 0 NOT NULL,
    price_yearly_paisa bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'PKR'::text NOT NULL,
    limits jsonb DEFAULT '{}'::jsonb NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.preferences (
    user_id uuid NOT NULL,
    number_format public.number_format DEFAULT 'lakh'::public.number_format NOT NULL,
    theme text DEFAULT 'system'::text NOT NULL,
    default_household_id uuid,
    nisab_standard text DEFAULT 'silver'::text NOT NULL,
    is_filer boolean DEFAULT false NOT NULL,
    notifications jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    phone text,
    avatar_url text,
    locale text DEFAULT 'en'::text NOT NULL,
    city text,
    occupation text,
    timezone text DEFAULT 'Asia/Karachi'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    first_name text,
    last_name text
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    keys jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quick_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quick_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    household_id uuid NOT NULL,
    type text NOT NULL,
    amount_paisa bigint NOT NULL,
    category text NOT NULL,
    note text,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quick_entries_type_check CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text])))
);


--
-- Name: receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    transaction_id uuid,
    merchant_name text,
    total_amount_paisa bigint,
    receipt_date date DEFAULT CURRENT_DATE NOT NULL,
    file_path text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    pattern text NOT NULL,
    category_id text NOT NULL,
    merchant_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: statement_imports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.statement_imports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    account_id uuid NOT NULL,
    file_name text NOT NULL,
    bank_name text NOT NULL,
    total_records integer DEFAULT 0 NOT NULL,
    imported_records integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'completed'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT statement_imports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    status public.subscription_status DEFAULT 'active'::public.subscription_status NOT NULL,
    trial_ends_at timestamp with time zone,
    current_period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_checklist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_checklist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    title text NOT NULL,
    is_done boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    household_id uuid NOT NULL,
    title text NOT NULL,
    due_date date DEFAULT CURRENT_DATE NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    is_done boolean DEFAULT false NOT NULL,
    linked_label text,
    auto boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'todo'::text NOT NULL,
    description text,
    start_date date,
    estimated_minutes integer,
    category text DEFAULT 'general'::text,
    CONSTRAINT tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'done'::text])))
);


--
-- Name: tax_deductions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_deductions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    title text NOT NULL,
    section text NOT NULL,
    amount_paisa bigint NOT NULL,
    certificate_url text,
    tax_year integer DEFAULT 2026 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tax_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    user_id uuid NOT NULL,
    is_filer boolean DEFAULT true NOT NULL,
    tax_year integer DEFAULT 2026 NOT NULL,
    employment_type text DEFAULT 'salaried'::text NOT NULL,
    annual_taxable_income_paisa bigint DEFAULT 0 NOT NULL,
    tax_credits_paisa bigint DEFAULT 0 NOT NULL,
    wht_deducted_paisa bigint DEFAULT 0 NOT NULL,
    estimated_tax_due_paisa bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tax_profiles_employment_type_check CHECK ((employment_type = ANY (ARRAY['salaried'::text, 'business'::text, 'freelancer'::text])))
);


--
-- Name: transaction_splits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transaction_splits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id uuid NOT NULL,
    category_id text NOT NULL,
    amount_paisa bigint NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    account_id uuid NOT NULL,
    category_id text,
    merchant_id text,
    transfer_account_id uuid,
    linked_transaction_id uuid,
    amount_paisa bigint NOT NULL,
    type text NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    note text,
    is_cleared boolean DEFAULT true NOT NULL,
    original_amount numeric,
    original_currency text,
    fx_rate numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT transactions_type_check CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text, 'transfer'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: zakat_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zakat_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    user_id uuid NOT NULL,
    hijri_year integer NOT NULL,
    gregorian_date date DEFAULT CURRENT_DATE NOT NULL,
    nisab_standard text DEFAULT 'silver'::text NOT NULL,
    gold_rate_paisa_per_gram bigint NOT NULL,
    silver_rate_paisa_per_gram bigint NOT NULL,
    cash_and_bank_paisa bigint NOT NULL,
    gold_silver_val_paisa bigint NOT NULL,
    investments_paisa bigint NOT NULL,
    liabilities_paisa bigint NOT NULL,
    net_zakat_due_paisa bigint NOT NULL,
    is_paid boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT zakat_records_nisab_standard_check CHECK ((nisab_standard = ANY (ARRAY['silver'::text, 'gold'::text])))
);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: ai_chat_messages ai_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_messages
    ADD CONSTRAINT ai_chat_messages_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_household_id_category_id_start_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_household_id_category_id_start_date_key UNIQUE (household_id, category_id, start_date);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: calendar_connections calendar_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_connections
    ADD CONSTRAINT calendar_connections_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: committees committees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.committees
    ADD CONSTRAINT committees_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: exchange_rates exchange_rates_base_currency_target_currency_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_base_currency_target_currency_key UNIQUE (base_currency, target_currency);


--
-- Name: exchange_rates exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);


--
-- Name: household_members household_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household_members
    ADD CONSTRAINT household_members_pkey PRIMARY KEY (id);


--
-- Name: household_members household_members_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household_members
    ADD CONSTRAINT household_members_unique UNIQUE (household_id, user_id);


--
-- Name: households households_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.households
    ADD CONSTRAINT households_pkey PRIMARY KEY (id);


--
-- Name: institutions institutions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institutions
    ADD CONSTRAINT institutions_pkey PRIMARY KEY (id);


--
-- Name: merchants merchants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.merchants
    ADD CONSTRAINT merchants_pkey PRIMARY KEY (id);


--
-- Name: plans plans_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_code_key UNIQUE (code);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: preferences preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preferences
    ADD CONSTRAINT preferences_pkey PRIMARY KEY (user_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: quick_entries quick_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_entries
    ADD CONSTRAINT quick_entries_pkey PRIMARY KEY (id);


--
-- Name: receipts receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_pkey PRIMARY KEY (id);


--
-- Name: rules rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rules
    ADD CONSTRAINT rules_pkey PRIMARY KEY (id);


--
-- Name: statement_imports statement_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statement_imports
    ADD CONSTRAINT statement_imports_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_household_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_household_unique UNIQUE (household_id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: task_checklist_items task_checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_checklist_items
    ADD CONSTRAINT task_checklist_items_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: tax_deductions tax_deductions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_deductions
    ADD CONSTRAINT tax_deductions_pkey PRIMARY KEY (id);


--
-- Name: tax_profiles tax_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_profiles
    ADD CONSTRAINT tax_profiles_pkey PRIMARY KEY (id);


--
-- Name: tax_profiles tax_profiles_user_id_tax_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_profiles
    ADD CONSTRAINT tax_profiles_user_id_tax_year_key UNIQUE (user_id, tax_year);


--
-- Name: transaction_splits transaction_splits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_splits
    ADD CONSTRAINT transaction_splits_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_role_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_role_unique UNIQUE (user_id, role);


--
-- Name: zakat_records zakat_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zakat_records
    ADD CONSTRAINT zakat_records_pkey PRIMARY KEY (id);


--
-- Name: categories_household_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX categories_household_id_idx ON public.categories USING btree (household_id);


--
-- Name: household_members_household_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX household_members_household_id_idx ON public.household_members USING btree (household_id);


--
-- Name: household_members_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX household_members_user_id_idx ON public.household_members USING btree (user_id);


--
-- Name: households_owner_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX households_owner_id_idx ON public.households USING btree (owner_id);


--
-- Name: user_roles_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_roles_user_id_idx ON public.user_roles USING btree (user_id);


--
-- Name: households households_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER households_touch BEFORE UPDATE ON public.households FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: preferences preferences_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER preferences_touch BEFORE UPDATE ON public.preferences FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: profiles profiles_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: subscriptions subscriptions_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER subscriptions_touch BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: transactions sync_account_balance_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_account_balance_trigger AFTER INSERT OR DELETE OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.sync_account_balance();


--
-- Name: accounts accounts_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: accounts accounts_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE SET NULL;


--
-- Name: ai_chat_messages ai_chat_messages_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_messages
    ADD CONSTRAINT ai_chat_messages_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: ai_chat_messages ai_chat_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_messages
    ADD CONSTRAINT ai_chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: budgets budgets_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: budgets budgets_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: calendar_connections calendar_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_connections
    ADD CONSTRAINT calendar_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: categories categories_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: committees committees_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.committees
    ADD CONSTRAINT committees_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: household_members household_members_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household_members
    ADD CONSTRAINT household_members_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: household_members household_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household_members
    ADD CONSTRAINT household_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: households households_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.households
    ADD CONSTRAINT households_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: merchants merchants_default_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.merchants
    ADD CONSTRAINT merchants_default_category_id_fkey FOREIGN KEY (default_category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: preferences preferences_default_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preferences
    ADD CONSTRAINT preferences_default_household_id_fkey FOREIGN KEY (default_household_id) REFERENCES public.households(id) ON DELETE SET NULL;


--
-- Name: preferences preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preferences
    ADD CONSTRAINT preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: quick_entries quick_entries_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_entries
    ADD CONSTRAINT quick_entries_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: quick_entries quick_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_entries
    ADD CONSTRAINT quick_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: receipts receipts_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: receipts receipts_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;


--
-- Name: rules rules_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rules
    ADD CONSTRAINT rules_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: rules rules_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rules
    ADD CONSTRAINT rules_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: rules rules_merchant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rules
    ADD CONSTRAINT rules_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE SET NULL;


--
-- Name: statement_imports statement_imports_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statement_imports
    ADD CONSTRAINT statement_imports_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: statement_imports statement_imports_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statement_imports
    ADD CONSTRAINT statement_imports_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: task_checklist_items task_checklist_items_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_checklist_items
    ADD CONSTRAINT task_checklist_items_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tax_deductions tax_deductions_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_deductions
    ADD CONSTRAINT tax_deductions_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: tax_profiles tax_profiles_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_profiles
    ADD CONSTRAINT tax_profiles_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: tax_profiles tax_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_profiles
    ADD CONSTRAINT tax_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: transaction_splits transaction_splits_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_splits
    ADD CONSTRAINT transaction_splits_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: transaction_splits transaction_splits_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_splits
    ADD CONSTRAINT transaction_splits_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_linked_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_linked_transaction_id_fkey FOREIGN KEY (linked_transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_merchant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_transfer_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_transfer_account_id_fkey FOREIGN KEY (transfer_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: zakat_records zakat_records_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zakat_records
    ADD CONSTRAINT zakat_records_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;


--
-- Name: zakat_records zakat_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zakat_records
    ADD CONSTRAINT zakat_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: accounts accounts_household_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY accounts_household_member ON public.accounts TO authenticated USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));


--
-- Name: ai_chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_chat_messages ai_chat_messages_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_chat_messages_user ON public.ai_chat_messages TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: budgets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

--
-- Name: budgets budgets_household_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY budgets_household_member ON public.budgets TO authenticated USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));


--
-- Name: calendar_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_connections calendar_connections_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_connections_user ON public.calendar_connections TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: calendar_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_events calendar_events_household_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_events_household_member ON public.calendar_events TO authenticated USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));


--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: categories categories_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_delete ON public.categories FOR DELETE TO authenticated USING ((((household_id IS NOT NULL) AND public.is_household_member(household_id)) OR public.is_platform_admin()));


--
-- Name: categories categories_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_insert ON public.categories FOR INSERT TO authenticated WITH CHECK ((((household_id IS NOT NULL) AND public.is_household_member(household_id)) OR ((household_id IS NULL) AND public.is_platform_admin())));


--
-- Name: categories categories_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_select ON public.categories FOR SELECT TO authenticated USING (((household_id IS NULL) OR public.is_household_member(household_id)));


--
-- Name: categories categories_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_update ON public.categories FOR UPDATE TO authenticated USING ((((household_id IS NOT NULL) AND public.is_household_member(household_id)) OR public.is_platform_admin())) WITH CHECK ((((household_id IS NOT NULL) AND public.is_household_member(household_id)) OR public.is_platform_admin()));


--
-- Name: committees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.committees ENABLE ROW LEVEL SECURITY;

--
-- Name: committees committees_household_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY committees_household_member ON public.committees TO authenticated USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));


--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts contacts_household_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contacts_household_member ON public.contacts TO authenticated USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));


--
-- Name: exchange_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: exchange_rates exchange_rates_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exchange_rates_read ON public.exchange_rates FOR SELECT TO authenticated USING (true);


--
-- Name: household_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

--
-- Name: household_members household_members_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY household_members_select ON public.household_members FOR SELECT TO authenticated USING ((public.is_household_member(household_id) OR public.is_platform_admin()));


--
-- Name: household_members household_members_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY household_members_write ON public.household_members TO authenticated USING ((public.is_household_owner(household_id) OR public.is_platform_admin())) WITH CHECK ((public.is_household_owner(household_id) OR public.is_platform_admin()));


--
-- Name: households; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

--
-- Name: households households_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY households_delete ON public.households FOR DELETE TO authenticated USING ((public.is_household_owner(id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: households households_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY households_insert ON public.households FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid()));


--
-- Name: households households_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY households_select ON public.households FOR SELECT TO authenticated USING ((public.is_household_member(id) OR public.is_platform_admin()));


--
-- Name: households households_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY households_update ON public.households FOR UPDATE TO authenticated USING ((public.is_household_owner(id) OR public.is_platform_admin())) WITH CHECK ((public.is_household_owner(id) OR public.is_platform_admin()));


--
-- Name: institutions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

--
-- Name: institutions institutions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY institutions_select ON public.institutions FOR SELECT TO authenticated USING (true);


--
-- Name: institutions institutions_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY institutions_write ON public.institutions TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: merchants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;

--
-- Name: merchants merchants_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY merchants_select ON public.merchants FOR SELECT TO authenticated USING (true);


--
-- Name: merchants merchants_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY merchants_write ON public.merchants TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

--
-- Name: plans plans_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plans_select ON public.plans FOR SELECT TO authenticated USING (true);


--
-- Name: plans plans_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plans_write ON public.plans TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: preferences preferences_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY preferences_all ON public.preferences TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR public.is_platform_admin() OR (EXISTS ( SELECT 1
   FROM (public.household_members mine
     JOIN public.household_members theirs ON ((theirs.household_id = mine.household_id)))
  WHERE ((mine.user_id = auth.uid()) AND (theirs.user_id = profiles.id))))));


--
-- Name: profiles profiles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated USING (((id = auth.uid()) OR public.is_platform_admin())) WITH CHECK (((id = auth.uid()) OR public.is_platform_admin()));


--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions push_subscriptions_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_subscriptions_user ON public.push_subscriptions TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: quick_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quick_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: quick_entries quick_entries_household_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quick_entries_household_member ON public.quick_entries TO authenticated USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));


--
-- Name: receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: receipts receipts_household_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY receipts_household_member ON public.receipts TO authenticated USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));


--
-- Name: rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;

--
-- Name: rules rules_household_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rules_household_member ON public.rules TO authenticated USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));


--
-- Name: transaction_splits splits_household_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY splits_household_member ON public.transaction_splits TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.transactions t
  WHERE ((t.id = transaction_splits.transaction_id) AND public.is_household_member(t.household_id)))));


--
-- Name: statement_imports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.statement_imports ENABLE ROW LEVEL SECURITY;

--
-- Name: statement_imports statement_imports_household_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY statement_imports_household_member ON public.statement_imports TO authenticated USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));


--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions subscriptions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subscriptions_select ON public.subscriptions FOR SELECT TO authenticated USING ((public.is_household_member(household_id) OR public.is_platform_admin()));


--
-- Name: subscriptions subscriptions_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subscriptions_write ON public.subscriptions TO authenticated USING ((public.is_household_owner(household_id) OR public.is_platform_admin())) WITH CHECK ((public.is_household_owner(household_id) OR public.is_platform_admin()));


--
-- Name: task_checklist_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;

--
-- Name: task_checklist_items task_items_household_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_items_household_member ON public.task_checklist_items TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.tasks t
  WHERE ((t.id = task_checklist_items.task_id) AND public.is_household_member(t.household_id)))));


--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks tasks_household_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_household_member ON public.tasks TO authenticated USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));


--
-- Name: tax_deductions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tax_deductions ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_deductions tax_deductions_household_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tax_deductions_household_member ON public.tax_deductions TO authenticated USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));


--
-- Name: tax_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tax_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_profiles tax_profiles_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tax_profiles_user ON public.tax_profiles TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: transaction_splits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions transactions_household_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transactions_household_member ON public.transactions TO authenticated USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_platform_admin()));


--
-- Name: user_roles user_roles_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_write ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: zakat_records zakat_household_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zakat_household_member ON public.zakat_records TO authenticated USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));


--
-- Name: zakat_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zakat_records ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict rdAYVHBTgvH4zXywPB02a4nvpVYegaeSuKVq4qnynIKtD4XjdRTv5T8nT86jMLm

