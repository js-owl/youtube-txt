-- 1. Таблица профилей
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  credits int not null default 5 check (credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. RLS
alter table public.profiles enable row level security;

drop policy if exists "select own profile" on public.profiles;
create policy "select own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id and credits >= 0);

-- 3. Триггер: при создании пользователя — создаём профиль с 5 кредитами
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. RPC: атомарное списание 1 кредита (защита от гонок)
create or replace function public.consume_credit()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare ok boolean;
begin
  update public.profiles
    set credits = credits - 1, updated_at = now()
    where id = auth.uid() and credits > 0
    returning true into ok;
  return coalesce(ok, false);
end;
$$;

-- 5. RPC: возврат кредита (используется при ошибке саммари)
create or replace function public.refund_credit()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set credits = credits + 1, updated_at = now()
    where id = auth.uid() and credits < 2147483647;
end;
$$;

-- 6. RPC: получение профиля текущего пользователя
create or replace function public.get_my_profile()
returns table(email text, credits int)
language sql
security definer
set search_path = public
as $$
  select email, credits
  from public.profiles
  where id = auth.uid();
$$;

-- 7. Grants
grant execute on function public.consume_credit() to authenticated;
grant execute on function public.refund_credit() to authenticated;
grant execute on function public.get_my_profile() to authenticated;
grant select, update on public.profiles to authenticated;
