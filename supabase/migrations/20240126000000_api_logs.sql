-- Create api_usage_logs table
create table if not exists public.api_usage_logs (
    id uuid primary key default uuid_generate_v4(),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    service_name text not null,
    timestamp timestamp with time zone default now()
);

-- RLS
alter table public.api_usage_logs enable row level security;

-- Public/Anon policy (optional, but better to use Service Role)
create policy "Enable insert for service role only" on public.api_usage_logs
    for insert with check (auth.role() = 'service_role');
