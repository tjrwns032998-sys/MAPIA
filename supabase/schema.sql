-- 월광 살롱 (마피아) Supabase 설정 - 전체 스키마 (새 프로젝트에 한 번 실행)
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여 넣고 Run 하세요.
-- 그다음 Authentication > Sign In / Providers 에서 "Allow anonymous sign-ins" 를 켜세요.

-- 1) 게임 상태 저장소. path 는 "<방코드>/players/<id>" 같은 형태이고 room 에 방코드가 들어간다.
create table if not exists public.kv (
  path text primary key,
  room text not null default '',
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists kv_room on public.kv (room);

-- 2) 채팅. rk 는 "<방코드>:<게임id>" 또는 "<방코드>:lobby"
create table if not exists public.chat (
  id bigint generated always as identity primary key,
  rk text not null,
  uid text not null,
  ch text not null,
  text text not null,
  t bigint not null
);
create index if not exists chat_rk_t on public.chat (rk, t);

-- 3) 진행자 임대 (한 번에 한 명의 브라우저만 게임을 진행하도록)
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

-- 쓰기: <방>/players/<내id>, <방>/actions/<내id> 는 본인만. 나머지 방 문서는 참가자 모두.
drop policy if exists kv_insert on public.kv;
create policy kv_insert on public.kv for insert to authenticated
  with check (split_part(path, '/', 1) = room and (path !~ '^[^/]+/(players|actions)/' or split_part(path, '/', 3) = auth.uid()::text));
drop policy if exists kv_update on public.kv;
create policy kv_update on public.kv for update to authenticated
  using (path !~ '^[^/]+/(players|actions)/' or split_part(path, '/', 3) = auth.uid()::text)
  with check (split_part(path, '/', 1) = room and (path !~ '^[^/]+/(players|actions)/' or split_part(path, '/', 3) = auth.uid()::text));
drop policy if exists kv_delete on public.kv;
create policy kv_delete on public.kv for delete to authenticated
  using (path !~ '^[^/]+/(players|actions)/' or split_part(path, '/', 3) = auth.uid()::text);

-- 채팅: 본인 이름으로, 또는 AI 참가자(bot_) 이름으로 쓸 수 있다. AI 대사는 진행자의 브라우저가 대신 올린다.
drop policy if exists chat_read on public.chat;
create policy chat_read on public.chat for select to authenticated using (true);
drop policy if exists chat_insert on public.chat;
create policy chat_insert on public.chat for insert to authenticated
  with check ((uid = auth.uid()::text or uid like 'bot\_%') and length(text) <= 200);

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

-- 오래된 방 정리 (하루 지난 데이터). 접속할 때마다 한 번 호출된다.
create or replace function public.cleanup_old()
returns void
language sql
security definer
set search_path = public
as $$
  delete from kv where updated_at < now() - interval '1 day';
  delete from chat where t < (extract(epoch from now() - interval '1 day') * 1000)::bigint;
  delete from lease where expires_at < now() - interval '1 day';
$$;
revoke execute on function public.cleanup_old() from anon;
revoke execute on function public.cleanup_old() from public;
grant execute on function public.cleanup_old() to authenticated;

-- 실시간 변경 알림 켜기
alter publication supabase_realtime add table public.kv;
alter publication supabase_realtime add table public.chat;
