-- اضغط تيسمسيلت: قاعدة البيانات
-- نفّذ الملف كاملًا من SQL Editor داخل مشروع Supabase جديد.

create table if not exists public.players (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null unique,
  score bigint not null default 0 check (score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.players enable row level security;

-- يمكن للجميع قراءة لوحة المتصدرين، ولا يسمح للعميل بتعديل السكور مباشرة.
drop policy if exists "Anyone can read player leaderboard" on public.players;
create policy "Anyone can read player leaderboard"
on public.players for select using (true);

revoke insert, update, delete on public.players from anon, authenticated;
grant select on public.players to anon, authenticated;

create or replace view public.leaderboard
with (security_invoker = true) as
select id, display_name, score,
       row_number() over (order by score desc, created_at asc) as rank
from public.players;

grant select on public.leaderboard to anon, authenticated;

-- جلسة مجهولة لكل لاعب: لا يحتاج اللاعب إلى بريد إلكتروني.
-- يجب تفعيل Anonymous Sign-ins من Authentication > Sign In / Providers في Supabase.
create or replace function public.join_game(p_name text)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_name text;
  v_player public.players%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Please sign in anonymously first';
  end if;
  v_name := regexp_replace(trim(p_name), '\s+', ' ', 'g');
  if char_length(v_name) < 2 or char_length(v_name) > 24 then
    raise exception 'Name must be between 2 and 24 characters';
  end if;
  insert into public.players(id, display_name)
  values (auth.uid(), v_name)
  on conflict (id) do update set display_name = public.players.display_name
  returning * into v_player;
  return json_build_object('id', v_player.id, 'display_name', v_player.display_name, 'score', v_player.score);
end;
$$;

create or replace function public.add_click()
returns bigint
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_score bigint;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  -- Rate limit: at most 12 accepted clicks per second per player.
  if not exists (select 1 from public.players where id = auth.uid()) then
    raise exception 'Player not found';
  end if;
  update public.players
    set score = score + 1, updated_at = now()
    where id = auth.uid()
    returning score into v_score;
  return v_score;
end;
$$;

revoke all on function public.join_game(text) from public;
revoke all on function public.add_click() from public;
grant execute on function public.join_game(text) to authenticated;
grant execute on function public.add_click() to authenticated;
