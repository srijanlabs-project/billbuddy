--
-- PostgreSQL database dump
--

\restrict wf8IJYfcWoVO6J8DNFPOuGAY7ulBTDT99hmq6ejQIFdpxsN9qtZnoDhNVhvaOcp

-- Dumped from database version 18.2
-- Dumped by pg_dump version 18.2

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    name character varying(150),
    mobile character varying(15),
    firm_name character varying(200),
    address text,
    gst_number character varying(20),
    discount_percent numeric(5,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customers_id_seq OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: ledger; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ledger (
    id integer NOT NULL,
    customer_id integer,
    quotation_id integer,
    debit numeric(10,2),
    credit numeric(10,2),
    balance numeric(10,2),
    entry_date date DEFAULT CURRENT_DATE
);


ALTER TABLE public.ledger OWNER TO postgres;

--
-- Name: ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ledger_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ledger_id_seq OWNER TO postgres;

--
-- Name: ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ledger_id_seq OWNED BY public.ledger.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    quotation_id integer,
    customer_id integer,
    amount numeric(10,2),
    payment_method character varying(50),
    payment_date date DEFAULT CURRENT_DATE,
    reference_number character varying(100)
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payments_id_seq OWNER TO postgres;

--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_variants (
    id integer NOT NULL,
    product_id integer,
    variant_name character varying(150),
    size character varying(100),
    unit_price numeric(10,2)
);


ALTER TABLE public.product_variants OWNER TO postgres;

--
-- Name: product_variants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_variants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_variants_id_seq OWNER TO postgres;

--
-- Name: product_variants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_variants_id_seq OWNED BY public.product_variants.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id integer NOT NULL,
    material_name character varying(200),
    category character varying(100),
    base_price numeric(10,2),
    gst_percent numeric(5,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: quotation_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quotation_items (
    id integer NOT NULL,
    quotation_id integer,
    product_id integer,
    variant_id integer,
    size character varying(100),
    quantity numeric(10,2),
    unit_price numeric(10,2),
    total_price numeric(10,2)
);


ALTER TABLE public.quotation_items OWNER TO postgres;

--
-- Name: quotation_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.quotation_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quotation_items_id_seq OWNER TO postgres;

--
-- Name: quotation_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.quotation_items_id_seq OWNED BY public.quotation_items.id;


--
-- Name: quotations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quotations (
    id integer NOT NULL,
    quotation_number character varying(50),
    seller_quotation_serial integer,
    seller_quotation_number character varying(80),
    custom_quotation_number character varying(120),
    customer_id integer,
    created_by integer,
    subtotal numeric(10,2),
    gst_amount numeric(10,2),
    transport_charges numeric(10,2),
    design_charges numeric(10,2),
    total_amount numeric(10,2),
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.quotations OWNER TO postgres;

--
-- Name: quotations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.quotations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quotations_id_seq OWNER TO postgres;

--
-- Name: quotations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.quotations_id_seq OWNED BY public.quotations.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    role_name character varying(50)
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    mobile character varying(15) NOT NULL,
    password text,
    role_id integer,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status boolean DEFAULT true
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: ledger id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ledger ALTER COLUMN id SET DEFAULT nextval('public.ledger_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: product_variants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variants ALTER COLUMN id SET DEFAULT nextval('public.product_variants_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: quotation_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_items ALTER COLUMN id SET DEFAULT nextval('public.quotation_items_id_seq'::regclass);


--
-- Name: quotations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations ALTER COLUMN id SET DEFAULT nextval('public.quotations_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: ledger ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ledger
    ADD CONSTRAINT ledger_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: quotation_items quotation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_items
    ADD CONSTRAINT quotation_items_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_quotation_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_quotation_number_key UNIQUE (quotation_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotations_seller_serial_unique
    ON public.quotations USING btree (seller_id, seller_quotation_serial)
    WHERE (seller_quotation_serial IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotations_seller_visible_unique
    ON public.quotations USING btree (seller_id, seller_quotation_number)
    WHERE (seller_quotation_number IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotations_seller_custom_unique
    ON public.quotations USING btree (seller_id, custom_quotation_number)
    WHERE (custom_quotation_number IS NOT NULL);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: roles roles_role_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_role_name_key UNIQUE (role_name);


--
-- Name: users users_mobile_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_mobile_key UNIQUE (mobile);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_customer_mobile; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_mobile ON public.customers USING btree (mobile);


--
-- Name: idx_ledger_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ledger_customer ON public.ledger USING btree (customer_id);


--
-- Name: idx_quotation_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotation_customer ON public.quotations USING btree (customer_id);


--
-- Name: idx_quotation_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotation_date ON public.quotations USING btree (created_at);


--
-- Name: ledger ledger_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ledger
    ADD CONSTRAINT ledger_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: ledger ledger_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ledger
    ADD CONSTRAINT ledger_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id);


--
-- Name: payments payments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: payments payments_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id);


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: quotation_items quotation_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_items
    ADD CONSTRAINT quotation_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: quotation_items quotation_items_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_items
    ADD CONSTRAINT quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: quotation_items quotation_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_items
    ADD CONSTRAINT quotation_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);


--
-- Name: quotations quotations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: quotations quotations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: users users_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);

--
-- Platform SaaS alignment sync
--

ALTER TABLE public.sellers
    ADD COLUMN IF NOT EXISTS status character varying(30) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS trial_ends_at timestamp without time zone,
    ADD COLUMN IF NOT EXISTS subscription_plan character varying(50) DEFAULT 'DEMO',
    ADD COLUMN IF NOT EXISTS max_users integer,
    ADD COLUMN IF NOT EXISTS max_orders_per_month integer,
    ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS business_name character varying(200),
    ADD COLUMN IF NOT EXISTS gst_number character varying(20),
    ADD COLUMN IF NOT EXISTS business_address text,
    ADD COLUMN IF NOT EXISTS city character varying(120),
    ADD COLUMN IF NOT EXISTS state character varying(120),
    ADD COLUMN IF NOT EXISTS business_category character varying(120),
    ADD COLUMN IF NOT EXISTS last_login_at timestamp without time zone;

ALTER TABLE public.quotations
    ADD COLUMN IF NOT EXISTS watermark_text text,
    ADD COLUMN IF NOT EXISTS created_under_plan_id integer;

CREATE SEQUENCE IF NOT EXISTS public.quotation_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE IF NOT EXISTS public.plans (
    id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    plan_code character varying(50) UNIQUE NOT NULL,
    plan_name character varying(120) NOT NULL,
    price numeric(12,2) DEFAULT 0,
    billing_cycle character varying(20) NOT NULL DEFAULT 'monthly',
    is_active boolean DEFAULT true,
    is_demo_plan boolean DEFAULT false,
    trial_enabled boolean DEFAULT false,
    trial_duration_days integer,
    watermark_text text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.plan_features (
    id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    plan_id integer NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
    max_users integer,
    max_quotations integer,
    max_customers integer,
    inventory_enabled boolean DEFAULT false,
    reports_enabled boolean DEFAULT false,
    gst_enabled boolean DEFAULT false,
    exports_enabled boolean DEFAULT false,
    quotation_watermark_enabled boolean DEFAULT false,
    quotation_creation_locked_after_expiry boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (plan_id)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    seller_id integer NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    plan_id integer NOT NULL REFERENCES public.plans(id),
    status character varying(20) NOT NULL DEFAULT 'trial',
    start_date date,
    end_date date,
    trial_start_at timestamp without time zone,
    trial_end_at timestamp without time zone,
    converted_from_trial boolean DEFAULT false,
    auto_assigned boolean DEFAULT false,
    created_by integer REFERENCES public.users(id),
    updated_by integer REFERENCES public.users(id),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.seller_usage_snapshots (
    id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    seller_id integer NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    snapshot_date date NOT NULL,
    active_user_count integer DEFAULT 0,
    quotation_count integer DEFAULT 0,
    customer_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (seller_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_seller_id ON public.subscriptions USING btree (seller_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON public.subscriptions USING btree (plan_id);
CREATE INDEX IF NOT EXISTS idx_seller_usage_snapshots_seller_date ON public.seller_usage_snapshots USING btree (seller_id, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS public.seller_configuration_profiles (
    id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    seller_id integer NOT NULL UNIQUE REFERENCES public.sellers(id) ON DELETE CASCADE,
    profile_name character varying(200) NOT NULL,
    status character varying(20) NOT NULL DEFAULT 'draft',
    modules jsonb NOT NULL DEFAULT '{"products":true,"quotations":true,"customers":true,"payments":true,"reports":true}'::jsonb,
    published_at timestamp without time zone,
    created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.seller_catalogue_fields (
    id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    profile_id integer NOT NULL REFERENCES public.seller_configuration_profiles(id) ON DELETE CASCADE,
    field_key character varying(120) NOT NULL,
    label character varying(160) NOT NULL,
    field_type character varying(40) NOT NULL DEFAULT 'text',
    option_values jsonb NOT NULL DEFAULT '[]'::jsonb,
    display_order integer NOT NULL DEFAULT 0,
    required boolean DEFAULT false,
    visible_in_list boolean DEFAULT true,
    upload_enabled boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.seller_quotation_columns (
    id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    profile_id integer NOT NULL REFERENCES public.seller_configuration_profiles(id) ON DELETE CASCADE,
    column_key character varying(120) NOT NULL,
    label character varying(160) NOT NULL,
    column_type character varying(40) NOT NULL DEFAULT 'text',
    option_values jsonb NOT NULL DEFAULT '[]'::jsonb,
    definition_text text,
    formula_expression text,
      display_order integer NOT NULL DEFAULT 0,
      required boolean DEFAULT false,
      visible_in_form boolean DEFAULT true,
      visible_in_pdf boolean DEFAULT true,
      help_text_in_pdf boolean DEFAULT false,
      included_in_calculation boolean DEFAULT false,
      created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE IF NOT EXISTS public.seller_configuration_versions (
    id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    profile_id integer NOT NULL REFERENCES public.seller_configuration_profiles(id) ON DELETE CASCADE,
    version_no integer NOT NULL,
    status character varying(20) NOT NULL DEFAULT 'draft',
    snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    actor_user_id integer REFERENCES public.users(id) ON DELETE SET NULL,
    published_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (profile_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_seller_configuration_profiles_seller ON public.seller_configuration_profiles USING btree (seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_catalogue_fields_profile_order ON public.seller_catalogue_fields USING btree (profile_id, display_order, id);
CREATE INDEX IF NOT EXISTS idx_seller_quotation_columns_profile_order ON public.seller_quotation_columns USING btree (profile_id, display_order, id);
CREATE INDEX IF NOT EXISTS idx_seller_configuration_versions_profile_created ON public.seller_configuration_versions USING btree (profile_id, created_at DESC, id DESC);

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.quotation_items
    ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.quotation_templates
    ADD COLUMN IF NOT EXISTS logo_image_data text;

ALTER TABLE public.quotation_templates
    ADD COLUMN IF NOT EXISTS show_logo_only boolean DEFAULT false;

ALTER TABLE public.quotation_templates
    ADD COLUMN IF NOT EXISTS template_preset character varying(80) DEFAULT 'commercial_offer';


--
-- PostgreSQL database dump complete
--

\unrestrict wf8IJYfcWoVO6J8DNFPOuGAY7ulBTDT99hmq6ejQIFdpxsN9qtZnoDhNVhvaOcp

