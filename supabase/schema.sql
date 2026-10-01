-- 월광 살롱 (마피아) Supabase 설정
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여 넣고 Run 하세요.

-- 1) 게임 상태 저장소 (플레이어, 행동, 게임 진행 상태)
create table if not exists public.kv (
  path text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2) 채팅
create table if not exists public.chat (
  id bigint generated always as identity primary key,
  rk text not null,
  uid text not null,
  ch text not null,
  text text not null,
  t bigint not null
);
create index if not exists chat_rk_t on public.chat (rk, t);

-- 3) 진행자 임대(한 번에 한 명만 게임을 진행하도록)
create table if not exists public.lease (
  path text primary key,
  holder text not null,
  expires_at timestamptz not null
);

alter table public.kv enable row level security;
alter table public.chat enable row level security;
alter table public.lease enable row level security;

-- 읽기: 로그인(익명 포함)한 모두
drop policy if exists kv_read on public.kv;
create policy kv_read on public.kv for select to authenticated using (true);

-- 쓰기: players/<내 id>, actions/<내 id> 는 본인만, 나머지 게임 문서는 참가자 모두
drop policy if exists kv_insert on public.kv;
create policy kv_insert on public.kv for insert to authenticated
  with check (path !~ '^(players|actions)/' or split_part(path, '/', 2) = auth.uid()::text);
drop policy if exists kv_update on public.kv;
create policy kv_update on public.kv for update to authenticated
  using (path !~ '^(players|actions)/' or split_part(path, '/', 2) = auth.uid()::text)
  with check (path !~ '^(players|actions)/' or split_part(path, '/', 2) = auth.uid()::text);
drop policy if exists kv_delete on public.kv;
create policy kv_delete on public.kv for delete to authenticated
  using (path !~ '^(players|actions)/' or split_part(path, '/', 2) = auth.uid()::text);

drop policy if exists chat_read on public.chat;
create policy chat_read on public.chat for select to authenticated using (true);
drop policy if exists chat_insert on public.chat;
create policy chat_insert on public.chat for insert to authenticated
  with check (uid = auth.uid()::text and length(text) <= 200);

-- 진행자 임대: 만료됐거나 내가 쥐고 있을 때만 갱신된다.
create or replace function public.acquire_lease(p_path text, p_ttl int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare ok boolean;
begin
  insert into lease (path, holder, expires_at)
  values (p_path, auth.uid()::text, now() + make_interval(secs => p_ttl / 1000.0))
  on conflict (path) do update
    set holder = excluded.holder, expires_at = excluded.expires_at
    where lease.holder = excluded.holder or lease.expires_at < now()
  returning true into ok;
  return coalesce(ok, false);
end;
$$;
revoke execute on function public.acquire_lease(text, int) from anon;
revoke execute on function public.acquire_lease(text, int) from public;
grant execute on function public.acquire_lease(text, int) to authenticated;

-- 실시간 변경 알림 켜기
alter publication supabase_realtime add table public.kv;
alter publication supabase_realtime add table public.chat;
