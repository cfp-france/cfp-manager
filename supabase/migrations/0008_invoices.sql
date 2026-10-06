-- ─────────────────────────────────────────────────────────────────────────
-- Facturation : formateurs → CFP, et CFP → CFA (clients)
-- ─────────────────────────────────────────────────────────────────────────

-- Factures des FORMATEURS vers le CFP (règlement de leur prestation mensuelle)
create table if not exists public.trainer_invoices (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete restrict,
  period_year int not null,
  period_month int not null check (period_month between 1 and 12),
  invoice_number text not null,
  issue_date date not null default current_date,
  due_date date,
  total_hours numeric(10, 2) not null default 0,
  hourly_rate numeric(10, 2),
  amount_ht numeric(12, 2) not null default 0,
  vat_rate numeric(5, 2) not null default 0,          -- 0 si auto-entrepreneur en franchise
  amount_vat numeric(12, 2) not null default 0,
  amount_ttc numeric(12, 2) not null default 0,
  status text not null default 'draft' check (status in ('draft','sent','paid','cancelled')),
  paid_at timestamptz,
  paid_by uuid references auth.users(id),
  payment_reference text,                              -- n° de virement, chèque, etc.
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (trainer_id, period_year, period_month)
);

create table if not exists public.trainer_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.trainer_invoices(id) on delete cascade,
  time_entry_id uuid references public.time_entries(id) on delete set null,
  session_date date not null,
  cfa_name text,
  mission_name text,
  hours numeric(6, 2) not null,
  hourly_rate numeric(10, 2) not null,
  amount_ht numeric(10, 2) not null
);
create index if not exists idx_til_invoice on public.trainer_invoice_lines(invoice_id);

-- Factures du CFP vers les CFA (clients)
create table if not exists public.cfa_invoices (
  id uuid primary key default gen_random_uuid(),
  cfa_id uuid not null references public.cfa(id) on delete restrict,
  period_year int not null,
  period_month int not null check (period_month between 1 and 12),
  invoice_number text not null unique,
  issue_date date not null default current_date,
  due_date date,
  total_hours numeric(10, 2) not null default 0,
  amount_ht numeric(12, 2) not null default 0,
  vat_rate numeric(5, 2) not null default 20,
  amount_vat numeric(12, 2) not null default 0,
  amount_ttc numeric(12, 2) not null default 0,
  status text not null default 'draft' check (status in ('draft','sent','paid','cancelled')),
  paid_at timestamptz,
  paid_by uuid references auth.users(id),
  payment_reference text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (cfa_id, period_year, period_month)
);

create table if not exists public.cfa_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.cfa_invoices(id) on delete cascade,
  time_entry_id uuid references public.time_entries(id) on delete set null,
  session_date date not null,
  trainer_name text,
  mission_name text,
  hours numeric(6, 2) not null,
  hourly_rate numeric(10, 2) not null,
  amount_ht numeric(10, 2) not null
);
create index if not exists idx_cil_invoice on public.cfa_invoice_lines(invoice_id);

-- Marque sur time_entries : liens vers les factures émises (évite les doublons)
alter table public.time_entries
  add column if not exists trainer_invoice_id uuid references public.trainer_invoices(id) on delete set null,
  add column if not exists cfa_invoice_id uuid references public.cfa_invoices(id) on delete set null;

-- ─────────────── RLS ───────────────
alter table public.trainer_invoices enable row level security;
alter table public.trainer_invoice_lines enable row level security;
alter table public.cfa_invoices enable row level security;
alter table public.cfa_invoice_lines enable row level security;

-- Formateur voit ses propres factures ; admin voit tout
drop policy if exists p_ti_select on public.trainer_invoices;
create policy p_ti_select on public.trainer_invoices for select using (
  exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);

drop policy if exists p_ti_insert on public.trainer_invoices;
create policy p_ti_insert on public.trainer_invoices for insert with check (
  exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);

drop policy if exists p_ti_update on public.trainer_invoices;
create policy p_ti_update on public.trainer_invoices for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
  or (
    exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = auth.uid())
    and status in ('draft')  -- un formateur ne peut modifier qu'un brouillon
  )
);

drop policy if exists p_ti_delete on public.trainer_invoices;
create policy p_ti_delete on public.trainer_invoices for delete using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
  or (
    exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = auth.uid())
    and status in ('draft')
  )
);

drop policy if exists p_til_select on public.trainer_invoice_lines;
create policy p_til_select on public.trainer_invoice_lines for select using (
  exists (
    select 1 from public.trainer_invoices i
    where i.id = invoice_id and (
      exists (select 1 from public.trainers t where t.id = i.trainer_id and t.user_id = auth.uid())
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
    )
  )
);
drop policy if exists p_til_insert on public.trainer_invoice_lines;
create policy p_til_insert on public.trainer_invoice_lines for insert with check (
  exists (
    select 1 from public.trainer_invoices i
    where i.id = invoice_id and (
      exists (select 1 from public.trainers t where t.id = i.trainer_id and t.user_id = auth.uid())
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
    )
  )
);

-- Factures CFA : réservées à l'admin
drop policy if exists p_ci_all on public.cfa_invoices;
create policy p_ci_all on public.cfa_invoices for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);

drop policy if exists p_cil_all on public.cfa_invoice_lines;
create policy p_cil_all on public.cfa_invoice_lines for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);

-- ─────────────── Séquences pour numérotation ───────────────
-- Format : CFP-TR-<YYYY>-<nnnn> pour formateur, CFP-FC-<YYYY>-<nnnn> pour CFA
create sequence if not exists public.trainer_invoice_seq;
create sequence if not exists public.cfa_invoice_seq;
