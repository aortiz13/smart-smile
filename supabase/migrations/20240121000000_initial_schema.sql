-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Leads Table
create table public.leads (
    id uuid primary key default uuid_generate_v4(),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    name text,
    email text,
    phone text,
    survey_data jsonb default '{}'::jsonb,
    status text default 'pending' check (status in ('pending', 'contacted', 'converted', 'rejected')),
    marketing_consent boolean default false
);

-- Generations Table (Images/Videos)
create table public.generations (
    id uuid primary key default uuid_generate_v4(),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    lead_id uuid references public.leads(id) on delete set null,
    type text check (type in ('image', 'video')),
    status text default 'processing' check (status in ('processing', 'completed', 'failed')),
    input_path text, -- Path in storage
    output_path text, -- Path in storage
    metadata jsonb default '{}'::jsonb
);

-- Audit Logs
create table public.audit_logs (
    id uuid primary key default uuid_generate_v4(),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    action text not null,
    details jsonb default '{}'::jsonb
);

-- RLS Policies
alter table public.leads enable row level security;
alter table public.generations enable row level security;
alter table public.audit_logs enable row level security;

-- Public/Anon policies (for the widget flow)
-- Leads: Insert allowed for anon (creation of new lead)
create policy "Allow anon insert leads" on public.leads
    for insert with check (true);

-- Generations: Select allowed for anon if they own it (This is tricky without auth, maybe use a session token or logic in Edge Function. For now, public read for simpler widget flow BUT this exposes data. Better: Edge Function handles read/write, and Anon users don't directly query tables expect via secure RPC or just returns).
-- Actually, for now, let's allow read for the lead creator assuming some ID correlation, but simpler:
-- The widget will communicate via Edge Functions which run as Service Role or use signed URLs.
-- So we might not need public RLS for SELECT if we use Edge Functions to proxy.
-- But for simplest architecture:
create policy "Enable all for service role" on public.leads
    for all using (auth.role() = 'service_role');
    
create policy "Enable all for service role" on public.generations
    for all using (auth.role() = 'service_role');

create policy "Enable all for service role" on public.audit_logs
    for all using (auth.role() = 'service_role');
