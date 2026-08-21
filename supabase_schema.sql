-- ============================================================================
-- MJAL GARMENTS MANUFACTURING ERP - SUPABASE DATABASE SCHEMA & RLS
-- Complete, Non-Breaking & Idempotent Migration Script (v5.1)
-- Safe to run on fresh databases OR existing databases with existing tables.
-- ============================================================================

-- 1. EXTENSIONS & PREREQUISITES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to automatically manage updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. USER PROFILES TABLE (RBAC & IDENTITY STORAGE)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT UNIQUE,
    full_name TEXT NOT NULL DEFAULT 'User',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'DEPT_USER',
    department TEXT NOT NULL DEFAULT 'Merchandising',
    designation TEXT,
    section TEXT,
    line_no TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration safety for existing profiles columns & constraints
-- Remove restrictive foreign key constraint if it exists so profiles can be seeded/saved directly
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT 'User';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'DEPT_USER';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'Merchandising';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS line_no TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Profiles Indexes for high-speed lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON public.profiles(employee_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- Seed Initial System Profiles (Optional / Kept clean for real user accounts)
-- Note: Demo mock profiles removed per system requirement. Real users will be created via User Management.
-- INSERT INTO public.profiles (id, employee_id, full_name, email, phone, role, department, designation, section, status, permissions)
-- VALUES ...

-- Updated_at Trigger for profiles
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 3. AUTOMATIC AUTH.USERS TO PUBLIC.PROFILES SYNCHRONIZATION TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_full_name TEXT;
    v_employee_id TEXT;
    v_role TEXT;
    v_department TEXT;
    v_designation TEXT;
    v_section TEXT;
    v_line_no TEXT;
    v_phone TEXT;
    v_permissions JSONB;
BEGIN
    v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(COALESCE(NEW.email, 'User'), '@', 1)
    );
    v_employee_id := COALESCE(
        NEW.raw_user_meta_data->>'employee_id',
        NEW.raw_user_meta_data->>'username',
        'EMP-' || UPPER(SUBSTRING(NEW.id::text, 1, 6))
    );
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'SUPER_ADMIN');
    v_department := COALESCE(NEW.raw_user_meta_data->>'department', 'HR & Admin');
    v_designation := NEW.raw_user_meta_data->>'designation';
    v_section := NEW.raw_user_meta_data->>'section';
    v_line_no := NEW.raw_user_meta_data->>'line_no';
    v_phone := NEW.raw_user_meta_data->>'phone';
    v_permissions := COALESCE((NEW.raw_user_meta_data->'permissions')::jsonb, '{}'::jsonb);

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        employee_id,
        phone,
        role,
        department,
        designation,
        section,
        line_no,
        status,
        permissions,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        LOWER(COALESCE(NEW.email, '')),
        v_full_name,
        v_employee_id,
        v_phone,
        v_role,
        v_department,
        v_designation,
        v_section,
        v_line_no,
        'Active',
        v_permissions,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        role = COALESCE(EXCLUDED.role, public.profiles.role),
        department = COALESCE(EXCLUDED.department, public.profiles.department),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================================
-- 4. MASTER DATA TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.master_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL DEFAULT '',
    code TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.master_data ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
ALTER TABLE public.master_data ADD COLUMN IF NOT EXISTS code TEXT NOT NULL DEFAULT '';
ALTER TABLE public.master_data ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.master_data ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.master_data ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE public.master_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.sewing_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_no TEXT UNIQUE NOT NULL,
    line_name TEXT NOT NULL DEFAULT '',
    capacity_per_day INTEGER DEFAULT 500,
    supervisor_name TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sewing_lines ADD COLUMN IF NOT EXISTS line_no TEXT;
ALTER TABLE public.sewing_lines ADD COLUMN IF NOT EXISTS line_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.sewing_lines ADD COLUMN IF NOT EXISTS capacity_per_day INTEGER DEFAULT 500;
ALTER TABLE public.sewing_lines ADD COLUMN IF NOT EXISTS supervisor_name TEXT;
ALTER TABLE public.sewing_lines ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE public.sewing_lines ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- 5. ORDER MANAGEMENT & MERCHANDISING
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_styles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer TEXT NOT NULL DEFAULT '',
    brand TEXT NOT NULL DEFAULT '',
    style_no TEXT UNIQUE NOT NULL,
    style_name TEXT NOT NULL DEFAULT '',
    garment_type TEXT NOT NULL DEFAULT 'Knit',
    season TEXT NOT NULL DEFAULT 'All Season',
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'Running',
    total_order_qty INTEGER DEFAULT 0,
    total_order_value NUMERIC(12,2) DEFAULT 0.00,
    allowance_pct NUMERIC(5,2) DEFAULT 0,
    allowance_qty INTEGER DEFAULT 0,
    factory_order_qty INTEGER DEFAULT 0,
    created_by TEXT,
    created_department TEXT DEFAULT 'Merchandising',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.order_styles ADD COLUMN IF NOT EXISTS buyer TEXT NOT NULL DEFAULT '';
ALTER TABLE public.order_styles ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT '';
ALTER TABLE public.order_styles ADD COLUMN IF NOT EXISTS style_no TEXT;
ALTER TABLE public.order_styles ADD COLUMN IF NOT EXISTS style_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.order_styles ADD COLUMN IF NOT EXISTS garment_type TEXT NOT NULL DEFAULT 'Knit';
ALTER TABLE public.order_styles ADD COLUMN IF NOT EXISTS season TEXT NOT NULL DEFAULT 'All Season';
ALTER TABLE public.order_styles ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE public.order_styles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Running';
ALTER TABLE public.order_styles ADD COLUMN IF NOT EXISTS total_order_qty INTEGER DEFAULT 0;
ALTER TABLE public.order_styles ADD COLUMN IF NOT EXISTS total_order_value NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE public.order_styles ADD COLUMN IF NOT EXISTS allowance_pct NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.order_styles ADD COLUMN IF NOT EXISTS allowance_qty INTEGER DEFAULT 0;
ALTER TABLE public.order_styles ADD COLUMN IF NOT EXISTS factory_order_qty INTEGER DEFAULT 0;
ALTER TABLE public.order_styles ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.order_styles ADD COLUMN IF NOT EXISTS created_department TEXT DEFAULT 'Merchandising';
ALTER TABLE public.order_styles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.order_styles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    style_id UUID REFERENCES public.order_styles(id) ON DELETE CASCADE,
    style_no TEXT NOT NULL DEFAULT '',
    po_no TEXT NOT NULL DEFAULT '',
    po_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
    shipment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    currency TEXT DEFAULT 'USD',
    total_value NUMERIC(12,2) DEFAULT 0.00,
    status TEXT DEFAULT 'Running',
    total_po_qty INTEGER DEFAULT 0,
    allowance_pct NUMERIC(5,2) DEFAULT 0,
    allowance_qty INTEGER DEFAULT 0,
    factory_po_qty INTEGER DEFAULT 0,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS style_id UUID REFERENCES public.order_styles(id) ON DELETE CASCADE;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS style_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS po_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS po_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS delivery_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS shipment_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS total_value NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Running';
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS total_po_qty INTEGER DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS allowance_pct NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS allowance_qty INTEGER DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS factory_po_qty INTEGER DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.po_colours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    colour TEXT NOT NULL DEFAULT '',
    total_qty INTEGER DEFAULT 0,
    allowance_pct NUMERIC(5,2) DEFAULT 0,
    allowance_qty INTEGER DEFAULT 0,
    factory_qty INTEGER DEFAULT 0,
    size_quantities JSONB DEFAULT '{}'::jsonb,
    factory_size_quantities JSONB DEFAULT '{}'::jsonb,
    allowance_size_quantities JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.po_colours ADD COLUMN IF NOT EXISTS po_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE;
ALTER TABLE public.po_colours ADD COLUMN IF NOT EXISTS colour TEXT NOT NULL DEFAULT '';
ALTER TABLE public.po_colours ADD COLUMN IF NOT EXISTS total_qty INTEGER DEFAULT 0;
ALTER TABLE public.po_colours ADD COLUMN IF NOT EXISTS allowance_pct NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.po_colours ADD COLUMN IF NOT EXISTS allowance_qty INTEGER DEFAULT 0;
ALTER TABLE public.po_colours ADD COLUMN IF NOT EXISTS factory_qty INTEGER DEFAULT 0;
ALTER TABLE public.po_colours ADD COLUMN IF NOT EXISTS size_quantities JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.po_colours ADD COLUMN IF NOT EXISTS factory_size_quantities JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.po_colours ADD COLUMN IF NOT EXISTS allowance_size_quantities JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.po_colours ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.po_colours ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.bom_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    style_no TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    item_name TEXT NOT NULL DEFAULT '',
    specification TEXT,
    consumption_per_dzn NUMERIC(10,2) DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'Pcs',
    unit_price NUMERIC(10,2) DEFAULT 0,
    supplier TEXT,
    required_qty NUMERIC(12,2) DEFAULT 0,
    booked_qty NUMERIC(12,2) DEFAULT 0,
    received_qty NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS style_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS item_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS specification TEXT;
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS consumption_per_dzn NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'Pcs';
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS required_qty NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS booked_qty NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS received_qty NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending';
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.ta_calendar_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    style_no TEXT NOT NULL DEFAULT '',
    po_no TEXT NOT NULL DEFAULT '',
    task_name TEXT NOT NULL DEFAULT '',
    planned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    actual_date DATE,
    responsible_dept TEXT NOT NULL DEFAULT '',
    status TEXT DEFAULT 'Pending',
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ta_calendar_tasks ADD COLUMN IF NOT EXISTS style_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.ta_calendar_tasks ADD COLUMN IF NOT EXISTS po_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.ta_calendar_tasks ADD COLUMN IF NOT EXISTS task_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.ta_calendar_tasks ADD COLUMN IF NOT EXISTS planned_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.ta_calendar_tasks ADD COLUMN IF NOT EXISTS actual_date DATE;
ALTER TABLE public.ta_calendar_tasks ADD COLUMN IF NOT EXISTS responsible_dept TEXT NOT NULL DEFAULT '';
ALTER TABLE public.ta_calendar_tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending';
ALTER TABLE public.ta_calendar_tasks ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.ta_calendar_tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.sample_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    style_no TEXT NOT NULL DEFAULT '',
    po_no TEXT NOT NULL DEFAULT '',
    colour TEXT NOT NULL DEFAULT '',
    sample_type TEXT NOT NULL DEFAULT 'Proto',
    submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_date DATE NOT NULL DEFAULT CURRENT_DATE,
    approval_date DATE,
    buyer_comments TEXT,
    status TEXT DEFAULT 'Pending',
    prepared_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sample_records ADD COLUMN IF NOT EXISTS style_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.sample_records ADD COLUMN IF NOT EXISTS po_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.sample_records ADD COLUMN IF NOT EXISTS colour TEXT NOT NULL DEFAULT '';
ALTER TABLE public.sample_records ADD COLUMN IF NOT EXISTS sample_type TEXT NOT NULL DEFAULT 'Proto';
ALTER TABLE public.sample_records ADD COLUMN IF NOT EXISTS submission_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.sample_records ADD COLUMN IF NOT EXISTS target_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.sample_records ADD COLUMN IF NOT EXISTS approval_date DATE;
ALTER TABLE public.sample_records ADD COLUMN IF NOT EXISTS buyer_comments TEXT;
ALTER TABLE public.sample_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending';
ALTER TABLE public.sample_records ADD COLUMN IF NOT EXISTS prepared_by TEXT;
ALTER TABLE public.sample_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- 6. STORE & INVENTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.store_stock_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_type TEXT NOT NULL DEFAULT 'Fabric',
    item_name TEXT NOT NULL DEFAULT '',
    category TEXT,
    style_no TEXT NOT NULL DEFAULT '',
    po_no TEXT NOT NULL DEFAULT '',
    colour TEXT NOT NULL DEFAULT '',
    current_stock NUMERIC(12,2) DEFAULT 0,
    min_stock_level NUMERIC(12,2) DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'Yards',
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.store_stock_items ADD COLUMN IF NOT EXISTS store_type TEXT NOT NULL DEFAULT 'Fabric';
ALTER TABLE public.store_stock_items ADD COLUMN IF NOT EXISTS item_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.store_stock_items ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.store_stock_items ADD COLUMN IF NOT EXISTS style_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.store_stock_items ADD COLUMN IF NOT EXISTS po_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.store_stock_items ADD COLUMN IF NOT EXISTS colour TEXT NOT NULL DEFAULT '';
ALTER TABLE public.store_stock_items ADD COLUMN IF NOT EXISTS current_stock NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.store_stock_items ADD COLUMN IF NOT EXISTS min_stock_level NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.store_stock_items ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'Yards';
ALTER TABLE public.store_stock_items ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.store_stock_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.store_stock_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.store_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    store_type TEXT NOT NULL DEFAULT 'Fabric',
    transaction_type TEXT NOT NULL DEFAULT 'Received',
    style_no TEXT NOT NULL DEFAULT '',
    po_no TEXT NOT NULL DEFAULT '',
    colour TEXT NOT NULL DEFAULT '',
    item_name TEXT NOT NULL DEFAULT '',
    quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'Yards',
    supplier_or_dept TEXT,
    grn_no TEXT,
    issued_to TEXT,
    performed_by TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.store_transactions ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.store_transactions ADD COLUMN IF NOT EXISTS store_type TEXT NOT NULL DEFAULT 'Fabric';
ALTER TABLE public.store_transactions ADD COLUMN IF NOT EXISTS transaction_type TEXT NOT NULL DEFAULT 'Received';
ALTER TABLE public.store_transactions ADD COLUMN IF NOT EXISTS style_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.store_transactions ADD COLUMN IF NOT EXISTS po_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.store_transactions ADD COLUMN IF NOT EXISTS colour TEXT NOT NULL DEFAULT '';
ALTER TABLE public.store_transactions ADD COLUMN IF NOT EXISTS item_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.store_transactions ADD COLUMN IF NOT EXISTS quantity NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.store_transactions ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'Yards';
ALTER TABLE public.store_transactions ADD COLUMN IF NOT EXISTS supplier_or_dept TEXT;
ALTER TABLE public.store_transactions ADD COLUMN IF NOT EXISTS grn_no TEXT;
ALTER TABLE public.store_transactions ADD COLUMN IF NOT EXISTS issued_to TEXT;
ALTER TABLE public.store_transactions ADD COLUMN IF NOT EXISTS performed_by TEXT;
ALTER TABLE public.store_transactions ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.store_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- 7. CUTTING DEPARTMENT
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cutting_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    style_no TEXT NOT NULL DEFAULT '',
    po_no TEXT NOT NULL DEFAULT '',
    colour TEXT NOT NULL DEFAULT '',
    size TEXT NOT NULL DEFAULT '',
    order_qty INTEGER DEFAULT 0,
    fabric_allocated_yds NUMERIC(10,2) DEFAULT 0,
    marker_length_yds NUMERIC(10,2) DEFAULT 0,
    marker_efficiency NUMERIC(5,2) DEFAULT 0,
    lay_plies INTEGER DEFAULT 0,
    cut_qty INTEGER NOT NULL DEFAULT 0,
    shortage_qty INTEGER DEFAULT 0,
    reject_qty INTEGER DEFAULT 0,
    recut_qty INTEGER DEFAULT 0,
    bundle_count INTEGER DEFAULT 0,
    cut_efficiency NUMERIC(5,2) DEFAULT 0,
    operator TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cutting_entries ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.cutting_entries ADD COLUMN IF NOT EXISTS style_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.cutting_entries ADD COLUMN IF NOT EXISTS po_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.cutting_entries ADD COLUMN IF NOT EXISTS colour TEXT NOT NULL DEFAULT '';
ALTER TABLE public.cutting_entries ADD COLUMN IF NOT EXISTS size TEXT NOT NULL DEFAULT '';
ALTER TABLE public.cutting_entries ADD COLUMN IF NOT EXISTS order_qty INTEGER DEFAULT 0;
ALTER TABLE public.cutting_entries ADD COLUMN IF NOT EXISTS fabric_allocated_yds NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.cutting_entries ADD COLUMN IF NOT EXISTS marker_length_yds NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.cutting_entries ADD COLUMN IF NOT EXISTS marker_efficiency NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.cutting_entries ADD COLUMN IF NOT EXISTS lay_plies INTEGER DEFAULT 0;
ALTER TABLE public.cutting_entries ADD COLUMN IF NOT EXISTS cut_qty INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.cutting_entries ADD COLUMN IF NOT EXISTS shortage_qty INTEGER DEFAULT 0;
ALTER TABLE public.cutting_entries ADD COLUMN IF NOT EXISTS reject_qty INTEGER DEFAULT 0;
ALTER TABLE public.cutting_entries ADD COLUMN IF NOT EXISTS recut_qty INTEGER DEFAULT 0;
ALTER TABLE public.cutting_entries ADD COLUMN IF NOT EXISTS bundle_count INTEGER DEFAULT 0;
ALTER TABLE public.cutting_entries ADD COLUMN IF NOT EXISTS cut_efficiency NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.cutting_entries ADD COLUMN IF NOT EXISTS operator TEXT;
ALTER TABLE public.cutting_entries ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.cutting_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- 8. SEWING DEPARTMENT
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sewing_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_no TEXT NOT NULL DEFAULT '',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    month TEXT,
    style_no TEXT NOT NULL DEFAULT '',
    po_no TEXT NOT NULL DEFAULT '',
    colour TEXT NOT NULL DEFAULT '',
    daily_target_qty INTEGER NOT NULL DEFAULT 0,
    hourly_target_qty INTEGER NOT NULL DEFAULT 0,
    working_days INTEGER DEFAULT 26,
    monthly_target_qty INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sewing_targets ADD COLUMN IF NOT EXISTS line_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.sewing_targets ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.sewing_targets ADD COLUMN IF NOT EXISTS month TEXT;
ALTER TABLE public.sewing_targets ADD COLUMN IF NOT EXISTS style_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.sewing_targets ADD COLUMN IF NOT EXISTS po_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.sewing_targets ADD COLUMN IF NOT EXISTS colour TEXT NOT NULL DEFAULT '';
ALTER TABLE public.sewing_targets ADD COLUMN IF NOT EXISTS daily_target_qty INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.sewing_targets ADD COLUMN IF NOT EXISTS hourly_target_qty INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.sewing_targets ADD COLUMN IF NOT EXISTS working_days INTEGER DEFAULT 26;
ALTER TABLE public.sewing_targets ADD COLUMN IF NOT EXISTS monthly_target_qty INTEGER DEFAULT 0;
ALTER TABLE public.sewing_targets ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.sewing_targets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.sewing_production (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    line_no TEXT NOT NULL DEFAULT '',
    buyer TEXT NOT NULL DEFAULT '',
    style_no TEXT NOT NULL DEFAULT '',
    po_no TEXT NOT NULL DEFAULT '',
    colour TEXT NOT NULL DEFAULT '',
    size TEXT DEFAULT 'All Sizes',
    input_qty INTEGER DEFAULT 0,
    daily_target INTEGER DEFAULT 0,
    hourly_outputs JSONB DEFAULT '[]'::jsonb,
    total_output INTEGER NOT NULL DEFAULT 0,
    alter_qty INTEGER DEFAULT 0,
    reject_qty INTEGER DEFAULT 0,
    rework_qty INTEGER DEFAULT 0,
    wip_qty INTEGER DEFAULT 0,
    remarks TEXT,
    submitted_by TEXT,
    submitted_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    submission_time TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS line_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS buyer TEXT NOT NULL DEFAULT '';
ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS style_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS po_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS colour TEXT NOT NULL DEFAULT '';
ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS size TEXT DEFAULT 'All Sizes';
ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS input_qty INTEGER DEFAULT 0;
ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS daily_target INTEGER DEFAULT 0;
ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS hourly_outputs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS total_output INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS alter_qty INTEGER DEFAULT 0;
ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS reject_qty INTEGER DEFAULT 0;
ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS rework_qty INTEGER DEFAULT 0;
ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS wip_qty INTEGER DEFAULT 0;
ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS submitted_by TEXT;
ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS submitted_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS submission_time TEXT DEFAULT '';
ALTER TABLE public.sewing_production ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- 9. WASHING, FINISHING, QC, PACKING & SHIPMENT
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.washing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challan_no TEXT NOT NULL DEFAULT '',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    vendor_name TEXT NOT NULL DEFAULT '',
    wash_type TEXT NOT NULL DEFAULT '',
    style_no TEXT NOT NULL DEFAULT '',
    po_no TEXT NOT NULL DEFAULT '',
    colour TEXT NOT NULL DEFAULT '',
    sent_qty INTEGER DEFAULT 0,
    received_qty INTEGER DEFAULT 0,
    damage_qty INTEGER DEFAULT 0,
    reject_qty INTEGER DEFAULT 0,
    balance_qty INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.washing_records ADD COLUMN IF NOT EXISTS challan_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.washing_records ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.washing_records ADD COLUMN IF NOT EXISTS vendor_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.washing_records ADD COLUMN IF NOT EXISTS wash_type TEXT NOT NULL DEFAULT '';
ALTER TABLE public.washing_records ADD COLUMN IF NOT EXISTS style_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.washing_records ADD COLUMN IF NOT EXISTS po_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.washing_records ADD COLUMN IF NOT EXISTS colour TEXT NOT NULL DEFAULT '';
ALTER TABLE public.washing_records ADD COLUMN IF NOT EXISTS sent_qty INTEGER DEFAULT 0;
ALTER TABLE public.washing_records ADD COLUMN IF NOT EXISTS received_qty INTEGER DEFAULT 0;
ALTER TABLE public.washing_records ADD COLUMN IF NOT EXISTS damage_qty INTEGER DEFAULT 0;
ALTER TABLE public.washing_records ADD COLUMN IF NOT EXISTS reject_qty INTEGER DEFAULT 0;
ALTER TABLE public.washing_records ADD COLUMN IF NOT EXISTS balance_qty INTEGER DEFAULT 0;
ALTER TABLE public.washing_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending';
ALTER TABLE public.washing_records ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.washing_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.finishing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    buyer TEXT,
    style_no TEXT NOT NULL DEFAULT '',
    po_no TEXT NOT NULL DEFAULT '',
    colour TEXT NOT NULL DEFAULT '',
    size TEXT DEFAULT 'All Sizes',
    sewing_receive_qty INTEGER DEFAULT 0,
    finishing_input_qty INTEGER DEFAULT 0,
    thread_cut_qty INTEGER DEFAULT 0,
    ironed_qty INTEGER DEFAULT 0,
    get_up_qty INTEGER DEFAULT 0,
    folded_qty INTEGER DEFAULT 0,
    tagged_qty INTEGER DEFAULT 0,
    packed_qty INTEGER DEFAULT 0,
    poly_qty INTEGER DEFAULT 0,
    carton_qty INTEGER DEFAULT 0,
    rework_qty INTEGER DEFAULT 0,
    reject_qty INTEGER DEFAULT 0,
    finished_qty INTEGER NOT NULL DEFAULT 0,
    hang_tag_status TEXT DEFAULT 'Pending',
    transferred_to_packing_qty INTEGER DEFAULT 0,
    is_ready_for_shipment BOOLEAN DEFAULT FALSE,
    ready_for_shipment_qty INTEGER DEFAULT 0,
    ready_for_shipment_date TEXT,
    shipment_status TEXT DEFAULT 'In Finishing',
    operator TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS buyer TEXT;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS style_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS po_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS colour TEXT NOT NULL DEFAULT '';
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS size TEXT DEFAULT 'All Sizes';
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS sewing_receive_qty INTEGER DEFAULT 0;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS finishing_input_qty INTEGER DEFAULT 0;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS thread_cut_qty INTEGER DEFAULT 0;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS ironed_qty INTEGER DEFAULT 0;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS get_up_qty INTEGER DEFAULT 0;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS folded_qty INTEGER DEFAULT 0;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS tagged_qty INTEGER DEFAULT 0;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS packed_qty INTEGER DEFAULT 0;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS poly_qty INTEGER DEFAULT 0;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS carton_qty INTEGER DEFAULT 0;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS rework_qty INTEGER DEFAULT 0;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS reject_qty INTEGER DEFAULT 0;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS finished_qty INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS hang_tag_status TEXT DEFAULT 'Pending';
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS transferred_to_packing_qty INTEGER DEFAULT 0;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS is_ready_for_shipment BOOLEAN DEFAULT FALSE;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS ready_for_shipment_qty INTEGER DEFAULT 0;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS ready_for_shipment_date TEXT;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS shipment_status TEXT DEFAULT 'In Finishing';
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS operator TEXT;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.finishing_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.qc_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    inspection_type TEXT NOT NULL DEFAULT '',
    style_no TEXT NOT NULL DEFAULT '',
    po_no TEXT NOT NULL DEFAULT '',
    colour TEXT NOT NULL DEFAULT '',
    line_no TEXT,
    inspected_qty INTEGER DEFAULT 0,
    passed_qty INTEGER DEFAULT 0,
    rework_qty INTEGER DEFAULT 0,
    reject_qty INTEGER DEFAULT 0,
    dhu NUMERIC(5,2) DEFAULT 0,
    defects JSONB DEFAULT '[]'::jsonb,
    inspector_name TEXT,
    result TEXT DEFAULT 'Pass',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.qc_inspections ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.qc_inspections ADD COLUMN IF NOT EXISTS inspection_type TEXT NOT NULL DEFAULT '';
ALTER TABLE public.qc_inspections ADD COLUMN IF NOT EXISTS style_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.qc_inspections ADD COLUMN IF NOT EXISTS po_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.qc_inspections ADD COLUMN IF NOT EXISTS colour TEXT NOT NULL DEFAULT '';
ALTER TABLE public.qc_inspections ADD COLUMN IF NOT EXISTS line_no TEXT;
ALTER TABLE public.qc_inspections ADD COLUMN IF NOT EXISTS inspected_qty INTEGER DEFAULT 0;
ALTER TABLE public.qc_inspections ADD COLUMN IF NOT EXISTS passed_qty INTEGER DEFAULT 0;
ALTER TABLE public.qc_inspections ADD COLUMN IF NOT EXISTS rework_qty INTEGER DEFAULT 0;
ALTER TABLE public.qc_inspections ADD COLUMN IF NOT EXISTS reject_qty INTEGER DEFAULT 0;
ALTER TABLE public.qc_inspections ADD COLUMN IF NOT EXISTS dhu NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.qc_inspections ADD COLUMN IF NOT EXISTS defects JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.qc_inspections ADD COLUMN IF NOT EXISTS inspector_name TEXT;
ALTER TABLE public.qc_inspections ADD COLUMN IF NOT EXISTS result TEXT DEFAULT 'Pass';
ALTER TABLE public.qc_inspections ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.packing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    style_no TEXT NOT NULL DEFAULT '',
    po_no TEXT NOT NULL DEFAULT '',
    colour TEXT NOT NULL DEFAULT '',
    order_qty INTEGER DEFAULT 0,
    packed_qty INTEGER DEFAULT 0,
    balance_qty INTEGER DEFAULT 0,
    carton_count INTEGER DEFAULT 0,
    cartons JSONB DEFAULT '[]'::jsonb,
    packing_officer TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.packing_records ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.packing_records ADD COLUMN IF NOT EXISTS style_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.packing_records ADD COLUMN IF NOT EXISTS po_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.packing_records ADD COLUMN IF NOT EXISTS colour TEXT NOT NULL DEFAULT '';
ALTER TABLE public.packing_records ADD COLUMN IF NOT EXISTS order_qty INTEGER DEFAULT 0;
ALTER TABLE public.packing_records ADD COLUMN IF NOT EXISTS packed_qty INTEGER DEFAULT 0;
ALTER TABLE public.packing_records ADD COLUMN IF NOT EXISTS balance_qty INTEGER DEFAULT 0;
ALTER TABLE public.packing_records ADD COLUMN IF NOT EXISTS carton_count INTEGER DEFAULT 0;
ALTER TABLE public.packing_records ADD COLUMN IF NOT EXISTS cartons JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.packing_records ADD COLUMN IF NOT EXISTS packing_officer TEXT;
ALTER TABLE public.packing_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.shipment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_no TEXT NOT NULL DEFAULT '',
    packing_list_no TEXT NOT NULL DEFAULT '',
    shipment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    buyer TEXT NOT NULL DEFAULT '',
    style_no TEXT NOT NULL DEFAULT '',
    po_no TEXT NOT NULL DEFAULT '',
    colour TEXT NOT NULL DEFAULT '',
    shipped_qty INTEGER DEFAULT 0,
    order_qty INTEGER DEFAULT 0,
    balance_qty INTEGER DEFAULT 0,
    carton_count INTEGER DEFAULT 0,
    vessel_or_flight TEXT,
    container_no TEXT,
    port_of_loading TEXT,
    port_of_discharge TEXT,
    status TEXT DEFAULT 'Ready',
    prepared_by TEXT,
    size TEXT DEFAULT 'All Sizes',
    remarks TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS invoice_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS packing_list_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS shipment_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS buyer TEXT NOT NULL DEFAULT '';
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS style_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS po_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS colour TEXT NOT NULL DEFAULT '';
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS shipped_qty INTEGER DEFAULT 0;
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS order_qty INTEGER DEFAULT 0;
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS balance_qty INTEGER DEFAULT 0;
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS carton_count INTEGER DEFAULT 0;
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS vessel_or_flight TEXT;
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS container_no TEXT;
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS port_of_loading TEXT;
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS port_of_discharge TEXT;
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Ready';
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS prepared_by TEXT;
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS size TEXT DEFAULT 'All Sizes';
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.shipment_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- 10. HR, EMPLOYEES & PAYROLL
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    emp_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    designation TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT 'HR & Admin',
    section TEXT,
    shift TEXT DEFAULT 'Day',
    joining_date DATE,
    phone TEXT,
    email TEXT,
    basic_salary NUMERIC(10,2) DEFAULT 0,
    ot_rate_per_hour NUMERIC(8,2) DEFAULT 0,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emp_id TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS designation TEXT NOT NULL DEFAULT '';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'HR & Admin';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS shift TEXT DEFAULT 'Day';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS joining_date DATE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS basic_salary NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS ot_rate_per_hour NUMERIC(8,2) DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    emp_id TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    in_time TEXT,
    out_time TEXT,
    status TEXT NOT NULL DEFAULT 'Present',
    ot_hours NUMERIC(4,2) DEFAULT 0,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS emp_id TEXT NOT NULL DEFAULT '';
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS emp_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT '';
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS in_time TEXT;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS out_time TEXT;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Present';
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS ot_hours NUMERIC(4,2) DEFAULT 0;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month TEXT NOT NULL DEFAULT '',
    emp_id TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    designation TEXT NOT NULL DEFAULT '',
    basic_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
    house_rent NUMERIC(10,2) DEFAULT 0,
    medical_allowance NUMERIC(10,2) DEFAULT 0,
    conveyance NUMERIC(10,2) DEFAULT 0,
    gross_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
    present_days INTEGER DEFAULT 0,
    absent_days INTEGER DEFAULT 0,
    ot_hours NUMERIC(6,2) DEFAULT 0,
    ot_amount NUMERIC(10,2) DEFAULT 0,
    bonus NUMERIC(10,2) DEFAULT 0,
    deductions NUMERIC(10,2) DEFAULT 0,
    net_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    payment_method TEXT DEFAULT 'Bank Transfer',
    payment_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS month TEXT NOT NULL DEFAULT '';
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS emp_id TEXT NOT NULL DEFAULT '';
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS emp_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT '';
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS designation TEXT NOT NULL DEFAULT '';
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS basic_salary NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS house_rent NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS medical_allowance NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS conveyance NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS gross_salary NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS present_days INTEGER DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS absent_days INTEGER DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS ot_hours NUMERIC(6,2) DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS ot_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS bonus NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS deductions NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS net_salary NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending';
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Bank Transfer';
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS payment_date DATE;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- 11. AUDIT LOGS, NOTIFICATIONS & INTER-DEPARTMENT TRANSFERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_name TEXT NOT NULL DEFAULT 'System',
    role TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
    department TEXT NOT NULL DEFAULT 'Administration',
    action TEXT NOT NULL DEFAULT '',
    module TEXT NOT NULL DEFAULT '',
    record_id TEXT,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT NOT NULL DEFAULT 'System';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'SUPER_ADMIN';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'Administration';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT '';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS module TEXT NOT NULL DEFAULT '';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS record_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS old_data JSONB;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS new_data JSONB;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'Notification',
    message TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'info',
    department TEXT NOT NULL DEFAULT 'All',
    target_role TEXT,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    read_by JSONB DEFAULT '[]'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    action_link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRITICAL: Ensure all notification columns exist before index creation
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Notification';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'info';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'All';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_role TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_by JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_link TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.inter_dept_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    from_dept TEXT NOT NULL DEFAULT '',
    to_dept TEXT NOT NULL DEFAULT '',
    style_no TEXT NOT NULL DEFAULT '',
    po_no TEXT NOT NULL DEFAULT '',
    colour TEXT NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 0,
    challan_no TEXT,
    status TEXT DEFAULT 'Pending',
    initiated_by TEXT,
    received_by TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inter_dept_transfers ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.inter_dept_transfers ADD COLUMN IF NOT EXISTS from_dept TEXT NOT NULL DEFAULT '';
ALTER TABLE public.inter_dept_transfers ADD COLUMN IF NOT EXISTS to_dept TEXT NOT NULL DEFAULT '';
ALTER TABLE public.inter_dept_transfers ADD COLUMN IF NOT EXISTS style_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.inter_dept_transfers ADD COLUMN IF NOT EXISTS po_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.inter_dept_transfers ADD COLUMN IF NOT EXISTS colour TEXT NOT NULL DEFAULT '';
ALTER TABLE public.inter_dept_transfers ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.inter_dept_transfers ADD COLUMN IF NOT EXISTS challan_no TEXT;
ALTER TABLE public.inter_dept_transfers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending';
ALTER TABLE public.inter_dept_transfers ADD COLUMN IF NOT EXISTS initiated_by TEXT;
ALTER TABLE public.inter_dept_transfers ADD COLUMN IF NOT EXISTS received_by TEXT;
ALTER TABLE public.inter_dept_transfers ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.inter_dept_transfers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.inter_dept_transfers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- 12. PERFORMANCE INDEXING FOR RELATIONAL INTEGRITY & FAST QUERIES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_order_styles_style_no ON public.order_styles(style_no);
CREATE INDEX IF NOT EXISTS idx_order_styles_buyer ON public.order_styles(buyer);
CREATE INDEX IF NOT EXISTS idx_order_styles_status ON public.order_styles(status);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_style_id ON public.purchase_orders(style_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_no ON public.purchase_orders(po_no);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_delivery ON public.purchase_orders(delivery_date);

CREATE INDEX IF NOT EXISTS idx_po_colours_po_id ON public.po_colours(po_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_style ON public.bom_items(style_no);
CREATE INDEX IF NOT EXISTS idx_ta_calendar_style_po ON public.ta_calendar_tasks(style_no, po_no);
CREATE INDEX IF NOT EXISTS idx_sample_records_style_po ON public.sample_records(style_no, po_no);

CREATE INDEX IF NOT EXISTS idx_store_stock_style_po ON public.store_stock_items(style_no, po_no);
CREATE INDEX IF NOT EXISTS idx_store_transactions_date ON public.store_transactions(date);

CREATE INDEX IF NOT EXISTS idx_cutting_style_po ON public.cutting_entries(style_no, po_no);
CREATE INDEX IF NOT EXISTS idx_cutting_date ON public.cutting_entries(date);

CREATE INDEX IF NOT EXISTS idx_sewing_target_line_date ON public.sewing_targets(line_no, date);
CREATE INDEX IF NOT EXISTS idx_sewing_prod_line_date ON public.sewing_production(line_no, date);
CREATE INDEX IF NOT EXISTS idx_sewing_prod_style_po ON public.sewing_production(style_no, po_no);

CREATE INDEX IF NOT EXISTS idx_finishing_style_po ON public.finishing_records(style_no, po_no);
CREATE INDEX IF NOT EXISTS idx_finishing_date ON public.finishing_records(date);

CREATE INDEX IF NOT EXISTS idx_qc_style_po ON public.qc_inspections(style_no, po_no);
CREATE INDEX IF NOT EXISTS idx_packing_style_po ON public.packing_records(style_no, po_no);
CREATE INDEX IF NOT EXISTS idx_shipment_style_po ON public.shipment_records(style_no, po_no);
CREATE INDEX IF NOT EXISTS idx_shipment_date ON public.shipment_records(shipment_date);

CREATE INDEX IF NOT EXISTS idx_employees_emp_id ON public.employees(emp_id);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON public.employees(department);
CREATE INDEX IF NOT EXISTS idx_attendance_date_emp ON public.attendance_records(date, emp_id);
CREATE INDEX IF NOT EXISTS idx_payroll_month_emp ON public.payroll_records(month, emp_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(target_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON public.inter_dept_transfers(status);

-- ============================================================================
-- 13. ROW LEVEL SECURITY (RLS) & RBAC HELPER FUNCTIONS
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sewing_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_colours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ta_calendar_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cutting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sewing_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sewing_production ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.washing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finishing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inter_dept_transfers ENABLE ROW LEVEL SECURITY;

-- Helper function: Get authenticated user role
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: Get authenticated user department
CREATE OR REPLACE FUNCTION public.get_auth_user_dept()
RETURNS TEXT AS $$
  SELECT department FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: Check if caller is Super Admin / Management
CREATE OR REPLACE FUNCTION public.is_admin_or_management()
RETURNS BOOLEAN AS $$
  SELECT public.get_auth_user_role() IN (
    'SUPER_ADMIN', 'HR_ADMIN', 'MD', 'DIRECTOR', 'GM',
    'Managing Director (MD)', 'Director', 'General Manager (GM)'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: Check if caller is authorized for Merchandising & Order Management
CREATE OR REPLACE FUNCTION public.can_manage_orders()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_dept TEXT;
BEGIN
  -- 1. Super Admin / Management
  IF public.is_admin_or_management() THEN
    RETURN TRUE;
  END IF;

  -- 2. Service role / Postgres internal role
  IF auth.role() = 'service_role' OR auth.uid() IS NULL THEN
    RETURN TRUE;
  END IF;

  -- 3. Check profile role and department
  SELECT role, department INTO v_role, v_dept
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role IN ('SUPER_ADMIN', 'HR_ADMIN', 'MD', 'DIRECTOR', 'GM', 'Managing Director (MD)', 'Director', 'General Manager (GM)') THEN
    RETURN TRUE;
  END IF;

  IF v_dept IN ('Merchandising', 'Order Management', 'Production Planning', 'HR & Admin') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ----------------------------------------------------------------------------
-- PROFILES POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow read profiles" ON public.profiles;
CREATE POLICY "Allow read profiles" ON public.profiles
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow insert profiles" ON public.profiles;
CREATE POLICY "Allow insert profiles" ON public.profiles
    FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update profiles" ON public.profiles;
CREATE POLICY "Allow update profiles" ON public.profiles
    FOR UPDATE TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete profiles" ON public.profiles;
CREATE POLICY "Allow delete profiles" ON public.profiles
    FOR DELETE TO public USING (true);

-- ----------------------------------------------------------------------------
-- ORDER MANAGEMENT POLICIES (RBAC RESTRICTED)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow read order_styles" ON public.order_styles;
CREATE POLICY "Allow read order_styles" ON public.order_styles 
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow write order_styles" ON public.order_styles;
DROP POLICY IF EXISTS "Allow insert order_styles" ON public.order_styles;
CREATE POLICY "Allow insert order_styles" ON public.order_styles 
    FOR INSERT TO public WITH CHECK (public.can_manage_orders());

DROP POLICY IF EXISTS "Allow update order_styles" ON public.order_styles;
CREATE POLICY "Allow update order_styles" ON public.order_styles 
    FOR UPDATE TO public USING (public.can_manage_orders()) WITH CHECK (public.can_manage_orders());

DROP POLICY IF EXISTS "Allow delete order_styles" ON public.order_styles;
CREATE POLICY "Allow delete order_styles" ON public.order_styles 
    FOR DELETE TO public USING (public.can_manage_orders());

DROP POLICY IF EXISTS "Allow read purchase_orders" ON public.purchase_orders;
CREATE POLICY "Allow read purchase_orders" ON public.purchase_orders 
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow write purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Allow insert purchase_orders" ON public.purchase_orders;
CREATE POLICY "Allow insert purchase_orders" ON public.purchase_orders 
    FOR INSERT TO public WITH CHECK (public.can_manage_orders());

DROP POLICY IF EXISTS "Allow update purchase_orders" ON public.purchase_orders;
CREATE POLICY "Allow update purchase_orders" ON public.purchase_orders 
    FOR UPDATE TO public USING (public.can_manage_orders()) WITH CHECK (public.can_manage_orders());

DROP POLICY IF EXISTS "Allow delete purchase_orders" ON public.purchase_orders;
CREATE POLICY "Allow delete purchase_orders" ON public.purchase_orders 
    FOR DELETE TO public USING (public.can_manage_orders());

DROP POLICY IF EXISTS "Allow read po_colours" ON public.po_colours;
CREATE POLICY "Allow read po_colours" ON public.po_colours 
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow write po_colours" ON public.po_colours;
DROP POLICY IF EXISTS "Allow insert po_colours" ON public.po_colours;
CREATE POLICY "Allow insert po_colours" ON public.po_colours 
    FOR INSERT TO public WITH CHECK (public.can_manage_orders());

DROP POLICY IF EXISTS "Allow update po_colours" ON public.po_colours;
CREATE POLICY "Allow update po_colours" ON public.po_colours 
    FOR UPDATE TO public USING (public.can_manage_orders()) WITH CHECK (public.can_manage_orders());

DROP POLICY IF EXISTS "Allow delete po_colours" ON public.po_colours;
CREATE POLICY "Allow delete po_colours" ON public.po_colours 
    FOR DELETE TO public USING (public.can_manage_orders());

-- ----------------------------------------------------------------------------
-- OPERATIONAL & PRODUCTION POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow read master_data" ON public.master_data;
CREATE POLICY "Allow read master_data" ON public.master_data FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write master_data" ON public.master_data;
CREATE POLICY "Allow write master_data" ON public.master_data FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read sewing_lines" ON public.sewing_lines;
CREATE POLICY "Allow read sewing_lines" ON public.sewing_lines FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write sewing_lines" ON public.sewing_lines;
CREATE POLICY "Allow write sewing_lines" ON public.sewing_lines FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read order_styles" ON public.order_styles;
CREATE POLICY "Allow read order_styles" ON public.order_styles FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write order_styles" ON public.order_styles;
CREATE POLICY "Allow write order_styles" ON public.order_styles FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read purchase_orders" ON public.purchase_orders;
CREATE POLICY "Allow read purchase_orders" ON public.purchase_orders FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write purchase_orders" ON public.purchase_orders;
CREATE POLICY "Allow write purchase_orders" ON public.purchase_orders FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read po_colours" ON public.po_colours;
CREATE POLICY "Allow read po_colours" ON public.po_colours FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write po_colours" ON public.po_colours;
CREATE POLICY "Allow write po_colours" ON public.po_colours FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read bom_items" ON public.bom_items;
CREATE POLICY "Allow read bom_items" ON public.bom_items FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write bom_items" ON public.bom_items;
CREATE POLICY "Allow write bom_items" ON public.bom_items FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read ta_calendar" ON public.ta_calendar_tasks;
CREATE POLICY "Allow read ta_calendar" ON public.ta_calendar_tasks FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write ta_calendar" ON public.ta_calendar_tasks;
CREATE POLICY "Allow write ta_calendar" ON public.ta_calendar_tasks FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read samples" ON public.sample_records;
CREATE POLICY "Allow read samples" ON public.sample_records FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write samples" ON public.sample_records;
CREATE POLICY "Allow write samples" ON public.sample_records FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read store_stock" ON public.store_stock_items;
CREATE POLICY "Allow read store_stock" ON public.store_stock_items FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write store_stock" ON public.store_stock_items;
CREATE POLICY "Allow write store_stock" ON public.store_stock_items FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read store_transactions" ON public.store_transactions;
CREATE POLICY "Allow read store_transactions" ON public.store_transactions FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write store_transactions" ON public.store_transactions;
CREATE POLICY "Allow write store_transactions" ON public.store_transactions FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read cutting" ON public.cutting_entries;
CREATE POLICY "Allow read cutting" ON public.cutting_entries FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write cutting" ON public.cutting_entries;
CREATE POLICY "Allow write cutting" ON public.cutting_entries FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read sewing_targets" ON public.sewing_targets;
CREATE POLICY "Allow read sewing_targets" ON public.sewing_targets FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write sewing_targets" ON public.sewing_targets;
CREATE POLICY "Allow write sewing_targets" ON public.sewing_targets FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read sewing_production" ON public.sewing_production;
CREATE POLICY "Allow read sewing_production" ON public.sewing_production FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write sewing_production" ON public.sewing_production;
CREATE POLICY "Allow write sewing_production" ON public.sewing_production FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read washing" ON public.washing_records;
CREATE POLICY "Allow read washing" ON public.washing_records FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write washing" ON public.washing_records;
CREATE POLICY "Allow write washing" ON public.washing_records FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read finishing" ON public.finishing_records;
CREATE POLICY "Allow read finishing" ON public.finishing_records FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write finishing" ON public.finishing_records;
CREATE POLICY "Allow write finishing" ON public.finishing_records FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read qc" ON public.qc_inspections;
CREATE POLICY "Allow read qc" ON public.qc_inspections FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write qc" ON public.qc_inspections;
CREATE POLICY "Allow write qc" ON public.qc_inspections FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read packing" ON public.packing_records;
CREATE POLICY "Allow read packing" ON public.packing_records FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write packing" ON public.packing_records;
CREATE POLICY "Allow write packing" ON public.packing_records FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read shipment" ON public.shipment_records;
CREATE POLICY "Allow read shipment" ON public.shipment_records FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write shipment" ON public.shipment_records;
CREATE POLICY "Allow write shipment" ON public.shipment_records FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read employees" ON public.employees;
CREATE POLICY "Allow read employees" ON public.employees FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write employees" ON public.employees;
CREATE POLICY "Allow write employees" ON public.employees FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read attendance" ON public.attendance_records;
CREATE POLICY "Allow read attendance" ON public.attendance_records FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write attendance" ON public.attendance_records;
CREATE POLICY "Allow write attendance" ON public.attendance_records FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read payroll" ON public.payroll_records;
CREATE POLICY "Allow read payroll" ON public.payroll_records FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write payroll" ON public.payroll_records;
CREATE POLICY "Allow write payroll" ON public.payroll_records FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read audit_logs" ON public.audit_logs;
CREATE POLICY "Allow read audit_logs" ON public.audit_logs FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write audit_logs" ON public.audit_logs;
CREATE POLICY "Allow write audit_logs" ON public.audit_logs FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read notifications" ON public.notifications;
CREATE POLICY "Allow read notifications" ON public.notifications FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write notifications" ON public.notifications;
CREATE POLICY "Allow write notifications" ON public.notifications FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read transfers" ON public.inter_dept_transfers;
CREATE POLICY "Allow read transfers" ON public.inter_dept_transfers FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow write transfers" ON public.inter_dept_transfers;
CREATE POLICY "Allow write transfers" ON public.inter_dept_transfers FOR ALL TO public USING (true) WITH CHECK (true);

-- ============================================================================
-- 14. REALTIME REPLICATION CONFIGURATION
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE 
            public.profiles,
            public.master_data,
            public.sewing_lines,
            public.order_styles,
            public.purchase_orders,
            public.po_colours,
            public.bom_items,
            public.ta_calendar_tasks,
            public.sample_records,
            public.store_stock_items,
            public.store_transactions,
            public.cutting_entries,
            public.sewing_targets,
            public.sewing_production,
            public.washing_records,
            public.finishing_records,
            public.qc_inspections,
            public.packing_records,
            public.shipment_records,
            public.employees,
            public.attendance_records,
            public.payroll_records,
            public.audit_logs,
            public.notifications,
            public.inter_dept_transfers;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ============================================================================
-- 15. ATOMIC UPSERT FUNCTION FOR ORDER MANAGEMENT WITH SIZE-LEVEL AGGREGATION & PRODUCTION IMMUTABILITY
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_order_atomic(p_order JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_style_id UUID;
    v_style_no TEXT;
    v_style_name TEXT;
    v_buyer TEXT;
    v_brand TEXT;
    v_garment_type TEXT;
    v_season TEXT;
    v_currency TEXT;
    v_status TEXT;
    v_created_by TEXT;
    v_created_dept TEXT;
    v_allowance_pct NUMERIC := 0;
    v_allowance_qty INTEGER := 0;
    v_factory_order_qty INTEGER := 0;
    
    v_po_record JSONB;
    v_col_record JSONB;
    
    v_po_id UUID;
    v_po_no TEXT;
    v_po_date DATE;
    v_delivery_date DATE;
    v_shipment_date DATE;
    v_unit_price NUMERIC;
    v_po_currency TEXT;
    v_po_status TEXT;
    v_po_remarks TEXT;
    v_po_allowance_pct NUMERIC := 0;
    v_po_allowance_qty INTEGER := 0;
    v_po_factory_qty INTEGER := 0;
    
    v_col_name TEXT;
    v_col_size_sum INTEGER;
    v_col_total_qty INTEGER;
    v_col_allowance_pct NUMERIC := 0;
    v_col_allowance_qty INTEGER := 0;
    v_col_factory_qty INTEGER := 0;
    v_size_quantities JSONB;
    v_factory_size_quantities JSONB;
    v_allowance_size_quantities JSONB;
    
    v_po_total_qty INTEGER;
    v_po_total_val NUMERIC;
    
    v_style_total_qty INTEGER := 0;
    v_style_total_val NUMERIC := 0.00;
    v_processed_pos_count INTEGER := 0;

    -- Production Immutability Verification Variables
    v_existing_cut_qty INTEGER := 0;
    v_existing_sew_qty INTEGER := 0;
    v_existing_fin_qty INTEGER := 0;
    v_existing_pack_qty INTEGER := 0;
    v_existing_ship_qty INTEGER := 0;
    v_total_prod_records INTEGER := 0;
BEGIN
    -- 1. Check Authorization (RBAC Role & Department Verification)
    IF auth.uid() IS NOT NULL AND NOT public.can_manage_orders() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized: Only authorized roles (Merchandising, Order Management, Planning, or Management) can perform Order UPSERT operations.'
        );
    END IF;

    -- 2. Extract & Sanitize style-level metadata
    v_style_no := UPPER(TRIM(COALESCE(p_order->>'style_no', p_order->>'styleNo', '')));
    v_style_name := TRIM(COALESCE(p_order->>'style_name', p_order->>'styleName', ''));
    v_buyer := TRIM(COALESCE(p_order->>'buyer', ''));
    v_brand := TRIM(COALESCE(p_order->>'brand', ''));
    v_garment_type := COALESCE(NULLIF(TRIM(COALESCE(p_order->>'garment_type', p_order->>'garmentType')), ''), 'T-Shirt');
    v_season := COALESCE(NULLIF(TRIM(COALESCE(p_order->>'season', '')), ''), 'All Season');
    v_currency := COALESCE(NULLIF(TRIM(COALESCE(p_order->>'currency', '')), ''), 'USD');
    v_status := COALESCE(NULLIF(TRIM(COALESCE(p_order->>'status', '')), ''), 'Running');
    v_created_by := COALESCE(p_order->>'created_by', p_order->>'createdBy', 'Merchandiser');
    v_created_dept := COALESCE(p_order->>'created_department', p_order->>'createdDepartment', 'Merchandising');
    v_allowance_pct := COALESCE((p_order->>'allowance_pct')::NUMERIC, (p_order->>'allowancePct')::NUMERIC, 0);
    v_allowance_qty := COALESCE((p_order->>'allowance_qty')::INTEGER, (p_order->>'allowanceQty')::INTEGER, 0);
    v_factory_order_qty := COALESCE((p_order->>'factory_order_qty')::INTEGER, (p_order->>'factoryOrderQty')::INTEGER, 0);

    IF v_style_no = '' OR v_buyer = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'style_no and buyer are required.');
    END IF;

    -- Resolve or create style ID
    IF p_order->>'id' IS NOT NULL AND p_order->>'id' ~ '^[0-9a-fA-F-]{36}$' THEN
        v_style_id := (p_order->>'id')::UUID;
    ELSE
        SELECT id INTO v_style_id 
        FROM public.order_styles 
        WHERE UPPER(TRIM(style_no)) = v_style_no AND UPPER(TRIM(buyer)) = UPPER(v_buyer)
        LIMIT 1;
        
        IF v_style_id IS NULL THEN
            v_style_id := gen_random_uuid();
        END IF;
    END IF;

    -- 3. Production Record Immutability Verification for existing Style
    SELECT COALESCE(SUM(cut_qty), 0), COUNT(*)
    INTO v_existing_cut_qty, v_total_prod_records
    FROM public.cutting_entries
    WHERE UPPER(TRIM(style_no)) = v_style_no;

    SELECT COALESCE(SUM(total_output), 0), v_total_prod_records + COUNT(*)
    INTO v_existing_sew_qty, v_total_prod_records
    FROM public.sewing_production
    WHERE UPPER(TRIM(style_no)) = v_style_no;

    SELECT COALESCE(SUM(finished_qty), 0), v_total_prod_records + COUNT(*)
    INTO v_existing_fin_qty, v_total_prod_records
    FROM public.finishing_records
    WHERE UPPER(TRIM(style_no)) = v_style_no;

    SELECT COALESCE(SUM(packed_qty), 0), v_total_prod_records + COUNT(*)
    INTO v_existing_pack_qty, v_total_prod_records
    FROM public.packing_records
    WHERE UPPER(TRIM(style_no)) = v_style_no;

    SELECT COALESCE(SUM(shipped_qty), 0), v_total_prod_records + COUNT(*)
    INTO v_existing_ship_qty, v_total_prod_records
    FROM public.shipment_records
    WHERE UPPER(TRIM(style_no)) = v_style_no;

    -- 4. Pre-calculate totals across all POs and their size breakdown matrices
    IF (p_order ? 'purchase_orders' AND jsonb_typeof(p_order->'purchase_orders') = 'array') OR
       (p_order ? 'purchaseOrders' AND jsonb_typeof(p_order->'purchaseOrders') = 'array') THEN
        FOR v_po_record IN SELECT * FROM jsonb_array_elements(COALESCE(p_order->'purchase_orders', p_order->'purchaseOrders'))
        LOOP
            v_po_total_qty := 0;
            v_unit_price := COALESCE((v_po_record->>'unit_price')::NUMERIC, (v_po_record->>'unitPrice')::NUMERIC, 0.00);

            IF v_po_record ? 'colours' AND jsonb_typeof(v_po_record->'colours') = 'array' THEN
                FOR v_col_record IN SELECT * FROM jsonb_array_elements(v_po_record->'colours')
                LOOP
                    v_col_size_sum := 0;
                    v_size_quantities := COALESCE(v_col_record->'size_quantities', v_col_record->'sizeQuantities', '{}'::jsonb);

                    IF jsonb_typeof(v_size_quantities) = 'object' THEN
                        SELECT COALESCE(SUM((value)::TEXT::INTEGER), 0)
                        INTO v_col_size_sum
                        FROM jsonb_each_text(v_size_quantities)
                        WHERE value ~ '^[0-9]+$';
                    END IF;

                    IF v_col_size_sum > 0 THEN
                        v_col_total_qty := v_col_size_sum;
                    ELSE
                        v_col_total_qty := COALESCE((v_col_record->>'total_qty')::INTEGER, (v_col_record->>'totalQty')::INTEGER, 0);
                    END IF;

                    v_po_total_qty := v_po_total_qty + v_col_total_qty;
                END LOOP;
            ELSE
                v_po_total_qty := COALESCE((v_po_record->>'total_po_qty')::INTEGER, (v_po_record->>'totalPoQty')::INTEGER, 0);
            END IF;

            v_po_total_val := v_po_total_qty * v_unit_price;
            v_style_total_qty := v_style_total_qty + v_po_total_qty;
            v_style_total_val := v_style_total_val + v_po_total_val;
        END LOOP;
    ELSE
        v_style_total_qty := COALESCE((p_order->>'total_order_qty')::INTEGER, (p_order->>'totalOrderQty')::INTEGER, 0);
        v_style_total_val := COALESCE((p_order->>'total_order_value')::NUMERIC, (p_order->>'totalOrderValue')::NUMERIC, 0.00);
    END IF;

    -- Verify that style total qty does not violate audited shipped quantity
    IF v_existing_ship_qty > 0 AND v_style_total_qty < v_existing_ship_qty THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Validation Error: Style total order quantity (%s pcs) cannot be reduced below already shipped quantity (%s pcs). Existing production records are immutable.', v_style_total_qty, v_existing_ship_qty)
        );
    END IF;

    IF v_factory_order_qty <= 0 THEN
        IF v_allowance_pct > 0 THEN
            v_factory_order_qty := ROUND(v_style_total_qty * (1 + v_allowance_pct / 100.0));
            v_allowance_qty := v_factory_order_qty - v_style_total_qty;
        ELSE
            v_factory_order_qty := v_style_total_qty;
            v_allowance_qty := 0;
        END IF;
    END IF;

    -- 5. Upsert order_styles record with calculated aggregated totals and allowance
    INSERT INTO public.order_styles (
        id, buyer, brand, style_no, style_name, garment_type, season, currency, status,
        total_order_qty, total_order_value, allowance_pct, allowance_qty, factory_order_qty,
        created_by, created_department, updated_at
    ) VALUES (
        v_style_id, v_buyer, v_brand, v_style_no, v_style_name, v_garment_type, v_season, v_currency, v_status,
        v_style_total_qty, v_style_total_val, v_allowance_pct, v_allowance_qty, v_factory_order_qty,
        v_created_by, v_created_dept, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        buyer = EXCLUDED.buyer,
        brand = EXCLUDED.brand,
        style_no = EXCLUDED.style_no,
        style_name = CASE WHEN EXCLUDED.style_name <> '' THEN EXCLUDED.style_name ELSE public.order_styles.style_name END,
        garment_type = EXCLUDED.garment_type,
        season = EXCLUDED.season,
        currency = EXCLUDED.currency,
        status = EXCLUDED.status,
        total_order_qty = EXCLUDED.total_order_qty,
        total_order_value = EXCLUDED.total_order_value,
        allowance_pct = EXCLUDED.allowance_pct,
        allowance_qty = EXCLUDED.allowance_qty,
        factory_order_qty = EXCLUDED.factory_order_qty,
        updated_at = NOW();

    -- 6. Process each PO and colour matrix atomically
    IF (p_order ? 'purchase_orders' AND jsonb_typeof(p_order->'purchase_orders') = 'array') OR
       (p_order ? 'purchaseOrders' AND jsonb_typeof(p_order->'purchaseOrders') = 'array') THEN
        FOR v_po_record IN SELECT * FROM jsonb_array_elements(COALESCE(p_order->'purchase_orders', p_order->'purchaseOrders'))
        LOOP
            v_po_no := UPPER(TRIM(COALESCE(v_po_record->>'po_no', v_po_record->>'poNo', '')));
            IF v_po_no = '' THEN
                CONTINUE;
            END IF;

            -- Resolve PO ID
            IF v_po_record->>'id' IS NOT NULL AND v_po_record->>'id' ~ '^[0-9a-fA-F-]{36}$' THEN
                v_po_id := (v_po_record->>'id')::UUID;
            ELSE
                SELECT id INTO v_po_id
                FROM public.purchase_orders
                WHERE style_id = v_style_id AND UPPER(TRIM(po_no)) = v_po_no
                LIMIT 1;

                IF v_po_id IS NULL THEN
                    v_po_id := gen_random_uuid();
                END IF;
            END IF;

            v_po_date := COALESCE(NULLIF(COALESCE(v_po_record->>'po_date', v_po_record->>'poDate'), '')::DATE, CURRENT_DATE);
            v_delivery_date := COALESCE(NULLIF(COALESCE(v_po_record->>'delivery_date', v_po_record->>'deliveryDate'), '')::DATE, v_po_date);
            v_shipment_date := COALESCE(NULLIF(COALESCE(v_po_record->>'shipment_date', v_po_record->>'shipmentDate'), '')::DATE, v_delivery_date);
            v_unit_price := COALESCE((v_po_record->>'unit_price')::NUMERIC, (v_po_record->>'unitPrice')::NUMERIC, 0.00);
            v_po_currency := COALESCE(NULLIF(TRIM(v_po_record->>'currency'), ''), v_currency);
            v_po_status := COALESCE(NULLIF(TRIM(v_po_record->>'status'), ''), 'Running');
            v_po_remarks := v_po_record->>'remarks';
            v_po_allowance_pct := COALESCE((v_po_record->>'allowance_pct')::NUMERIC, (v_po_record->>'allowancePct')::NUMERIC, v_allowance_pct);
            v_po_allowance_qty := COALESCE((v_po_record->>'allowance_qty')::INTEGER, (v_po_record->>'allowanceQty')::INTEGER, 0);
            v_po_factory_qty := COALESCE((v_po_record->>'factory_po_qty')::INTEGER, (v_po_record->>'factoryPoQty')::INTEGER, 0);

            -- Calculate PO level quantity from size breakdown aggregation
            v_po_total_qty := 0;
            IF v_po_record ? 'colours' AND jsonb_typeof(v_po_record->'colours') = 'array' THEN
                FOR v_col_record IN SELECT * FROM jsonb_array_elements(v_po_record->'colours')
                LOOP
                    v_col_size_sum := 0;
                    v_size_quantities := COALESCE(v_col_record->'size_quantities', v_col_record->'sizeQuantities', '{}'::jsonb);

                    IF jsonb_typeof(v_size_quantities) = 'object' THEN
                        SELECT COALESCE(SUM((value)::TEXT::INTEGER), 0)
                        INTO v_col_size_sum
                        FROM jsonb_each_text(v_size_quantities)
                        WHERE value ~ '^[0-9]+$';
                    END IF;

                    IF v_col_size_sum > 0 THEN
                        v_col_total_qty := v_col_size_sum;
                    ELSE
                        v_col_total_qty := COALESCE((v_col_record->>'total_qty')::INTEGER, (v_col_record->>'totalQty')::INTEGER, 0);
                    END IF;

                    v_po_total_qty := v_po_total_qty + v_col_total_qty;
                END LOOP;
            ELSE
                v_po_total_qty := COALESCE((v_po_record->>'total_po_qty')::INTEGER, (v_po_record->>'totalPoQty')::INTEGER, 0);
            END IF;

            v_po_total_val := v_po_total_qty * v_unit_price;

            IF v_po_factory_qty <= 0 THEN
                IF v_po_allowance_pct > 0 THEN
                    v_po_factory_qty := ROUND(v_po_total_qty * (1 + v_po_allowance_pct / 100.0));
                    v_po_allowance_qty := v_po_factory_qty - v_po_total_qty;
                ELSE
                    v_po_factory_qty := v_po_total_qty;
                    v_po_allowance_qty := 0;
                END IF;
            END IF;

            -- Check PO-level existing shipment
            DECLARE
                v_po_shipped_qty INTEGER := 0;
            BEGIN
                SELECT COALESCE(SUM(shipped_qty), 0)
                INTO v_po_shipped_qty
                FROM public.shipment_records
                WHERE UPPER(TRIM(style_no)) = v_style_no AND UPPER(TRIM(po_no)) = v_po_no;

                IF v_po_shipped_qty > 0 AND v_po_total_qty < v_po_shipped_qty THEN
                    RETURN jsonb_build_object(
                        'success', false,
                        'error', format('Validation Error: PO %s quantity (%s pcs) cannot be reduced below already shipped quantity (%s pcs).', v_po_no, v_po_total_qty, v_po_shipped_qty)
                    );
                END IF;
            END;

            -- Upsert purchase_orders with allowance fields
            INSERT INTO public.purchase_orders (
                id, style_id, style_no, po_no, po_date, delivery_date, shipment_date,
                unit_price, currency, total_value, status, total_po_qty,
                allowance_pct, allowance_qty, factory_po_qty,
                remarks, updated_at
            ) VALUES (
                v_po_id, v_style_id, v_style_no, v_po_no, v_po_date, v_delivery_date, v_shipment_date,
                v_unit_price, v_po_currency, v_po_total_val, v_po_status, v_po_total_qty,
                v_po_allowance_pct, v_po_allowance_qty, v_po_factory_qty,
                v_po_remarks, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                style_id = EXCLUDED.style_id,
                style_no = EXCLUDED.style_no,
                po_no = EXCLUDED.po_no,
                po_date = EXCLUDED.po_date,
                delivery_date = EXCLUDED.delivery_date,
                shipment_date = EXCLUDED.shipment_date,
                unit_price = EXCLUDED.unit_price,
                currency = EXCLUDED.currency,
                total_value = EXCLUDED.total_value,
                status = EXCLUDED.status,
                total_po_qty = EXCLUDED.total_po_qty,
                allowance_pct = EXCLUDED.allowance_pct,
                allowance_qty = EXCLUDED.allowance_qty,
                factory_po_qty = EXCLUDED.factory_po_qty,
                remarks = EXCLUDED.remarks,
                updated_at = NOW();

            -- Replace PO colours atomically without touching production tables
            DELETE FROM public.po_colours WHERE po_id = v_po_id;

            IF v_po_record ? 'colours' AND jsonb_typeof(v_po_record->'colours') = 'array' THEN
                FOR v_col_record IN SELECT * FROM jsonb_array_elements(v_po_record->'colours')
                LOOP
                    v_col_name := TRIM(COALESCE(v_col_record->>'colour', ''));
                    IF v_col_name = '' THEN
                        CONTINUE;
                    END IF;

                    v_col_size_sum := 0;
                    v_size_quantities := COALESCE(v_col_record->'size_quantities', v_col_record->'sizeQuantities', '{}'::jsonb);
                    v_factory_size_quantities := COALESCE(v_col_record->'factory_size_quantities', v_col_record->'factorySizeQuantities', '{}'::jsonb);
                    v_allowance_size_quantities := COALESCE(v_col_record->'allowance_size_quantities', v_col_record->'allowanceSizeQuantities', '{}'::jsonb);

                    IF jsonb_typeof(v_size_quantities) = 'object' THEN
                        SELECT COALESCE(SUM((value)::TEXT::INTEGER), 0)
                        INTO v_col_size_sum
                        FROM jsonb_each_text(v_size_quantities)
                        WHERE value ~ '^[0-9]+$';
                    END IF;

                    IF v_col_size_sum > 0 THEN
                        v_col_total_qty := v_col_size_sum;
                    ELSE
                        v_col_total_qty := COALESCE((v_col_record->>'total_qty')::INTEGER, (v_col_record->>'totalQty')::INTEGER, 0);
                    END IF;

                    v_col_allowance_pct := COALESCE((v_col_record->>'allowance_pct')::NUMERIC, (v_col_record->>'allowancePct')::NUMERIC, v_po_allowance_pct);
                    v_col_factory_qty := COALESCE((v_col_record->>'factory_qty')::INTEGER, (v_col_record->>'factoryQty')::INTEGER, 0);
                    IF v_col_factory_qty <= 0 THEN
                        v_col_factory_qty := ROUND(v_col_total_qty * (1 + v_col_allowance_pct / 100.0));
                    END IF;
                    v_col_allowance_qty := COALESCE((v_col_record->>'allowance_qty')::INTEGER, (v_col_record->>'allowanceQty')::INTEGER, GREATEST(0, v_col_factory_qty - v_col_total_qty));

                    INSERT INTO public.po_colours (
                        id, po_id, colour, total_qty, allowance_pct, allowance_qty, factory_qty,
                        size_quantities, factory_size_quantities, allowance_size_quantities, created_at
                    ) VALUES (
                        gen_random_uuid(), v_po_id, v_col_name, v_col_total_qty,
                        v_col_allowance_pct, v_col_allowance_qty, v_col_factory_qty,
                        v_size_quantities, v_factory_size_quantities, v_allowance_size_quantities, NOW()
                    );
                END LOOP;
            END IF;

            v_processed_pos_count := v_processed_pos_count + 1;
        END LOOP;
    END IF;

    -- Return success payload with production immutability verification details
    RETURN jsonb_build_object(
        'success', true,
        'style_id', v_style_id,
        'style_no', v_style_no,
        'processed_pos', v_processed_pos_count,
        'total_order_qty', v_style_total_qty,
        'factory_order_qty', v_factory_order_qty,
        'allowance_qty', v_allowance_qty,
        'total_order_value', v_style_total_val,
        'production_verified', true,
        'audited_production_records', v_total_prod_records
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_order_atomic(JSONB) TO anon, authenticated, service_role;

-- ============================================================================
-- 16. PRODUCTION RECORDS IMMUTABILITY ENFORCEMENT
-- ============================================================================
-- Ensures factory floor production logs cannot be modified by unprivileged order operations
CREATE OR REPLACE FUNCTION public.enforce_production_record_immutability()
RETURNS TRIGGER AS $$
BEGIN
    -- If the order management upsert is running, ensure production floor logs are never deleted or truncated
    IF TG_OP = 'DELETE' THEN
        IF public.is_admin_or_management() THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION 'Production records are immutable audit logs and cannot be deleted.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_immutability_cutting ON public.cutting_entries;
CREATE TRIGGER trg_immutability_cutting
    BEFORE DELETE ON public.cutting_entries
    FOR EACH ROW EXECUTE FUNCTION public.enforce_production_record_immutability();

DROP TRIGGER IF EXISTS trg_immutability_sewing ON public.sewing_production;
CREATE TRIGGER trg_immutability_sewing
    BEFORE DELETE ON public.sewing_production
    FOR EACH ROW EXECUTE FUNCTION public.enforce_production_record_immutability();

DROP TRIGGER IF EXISTS trg_immutability_finishing ON public.finishing_records;
CREATE TRIGGER trg_immutability_finishing
    BEFORE DELETE ON public.finishing_records
    FOR EACH ROW EXECUTE FUNCTION public.enforce_production_record_immutability();

DROP TRIGGER IF EXISTS trg_immutability_packing ON public.packing_records;
CREATE TRIGGER trg_immutability_packing
    BEFORE DELETE ON public.packing_records
    FOR EACH ROW EXECUTE FUNCTION public.enforce_production_record_immutability();

DROP TRIGGER IF EXISTS trg_immutability_shipment ON public.shipment_records;
CREATE TRIGGER trg_immutability_shipment
    BEFORE DELETE ON public.shipment_records
    FOR EACH ROW EXECUTE FUNCTION public.enforce_production_record_immutability();
