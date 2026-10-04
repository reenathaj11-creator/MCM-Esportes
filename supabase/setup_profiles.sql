-- ============================================================
-- Tabela de perfis + estatísticas de usuários (MCM Esportes)
-- Rode este script no Supabase: Dashboard -> SQL Editor -> New query
-- ============================================================

-- 1) Tabela de perfis (1 linha por usuário do app)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

-- 2) RLS: apenas o próprio usuário e administradores leem perfis
alter table public.profiles enable row level security;

create policy "Usuario ve o proprio perfil"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

-- Segurança: admins são identificados via app_metadata (somente-servidor).
-- user_metadata NÃO é seguro para permissões, pois o próprio usuário o grava no cadastro.
create policy "Admins veem todos os perfis"
  on public.profiles for select to authenticated
  using (
    (select auth.jwt() ->> 'email') = 'felipe.fschneider@gmail.com'
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- 3) Trigger: cria perfil automaticamente a cada novo cadastro
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) Backfill: cadastra perfis dos usuários que já existem
insert into public.profiles (id, full_name, email, created_at)
select id, raw_user_meta_data ->> 'full_name', email, created_at
from auth.users
on conflict (id) do nothing;
