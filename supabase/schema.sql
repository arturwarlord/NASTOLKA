-- NASTOLKA online rooms: run this file once in Supabase SQL Editor.
-- Browser clients can read room listings, but all mutations go through validated RPC functions.
create extension if not exists pgcrypto;

create table if not exists public.nastolka_rooms (
  id uuid primary key default gen_random_uuid(),
  room_name text not null check (char_length(trim(room_name)) between 2 and 48),
  map_id text not null,
  map_name text not null,
  map_data jsonb not null,
  host_player_id uuid not null,
  max_players integer not null check (max_players between 2 and 4),
  status text not null default 'waiting' check (status in ('waiting','playing','finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists nastolka_waiting_room_name_unique
  on public.nastolka_rooms (lower(room_name)) where status = 'waiting';
create index if not exists nastolka_rooms_status_created_idx
  on public.nastolka_rooms (status, created_at desc);

create table if not exists public.nastolka_room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.nastolka_rooms(id) on delete cascade,
  player_name text not null check (char_length(trim(player_name)) between 1 and 24),
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  unique(room_id, id)
);
create index if not exists nastolka_room_players_room_idx on public.nastolka_room_players(room_id, joined_at);

-- Tokens are kept in a private table, never exposed through public SELECT.
create table if not exists public.nastolka_player_secrets (
  player_id uuid primary key references public.nastolka_room_players(id) on delete cascade,
  room_id uuid not null references public.nastolka_rooms(id) on delete cascade,
  token_hash text not null
);
alter table public.nastolka_rooms enable row level security;
alter table public.nastolka_room_players enable row level security;
alter table public.nastolka_player_secrets enable row level security;
drop policy if exists "Public can view waiting rooms" on public.nastolka_rooms;
create policy "Public can view waiting rooms" on public.nastolka_rooms for select using (status = 'waiting' or status = 'playing');
drop policy if exists "Public can view room players" on public.nastolka_room_players;
create policy "Public can view room players" on public.nastolka_room_players for select using (true);
revoke all on public.nastolka_player_secrets from anon, authenticated;
revoke insert, update, delete on public.nastolka_rooms from anon, authenticated;
revoke insert, update, delete on public.nastolka_room_players from anon, authenticated;

create or replace function public.nastolka_create_room(
  p_room_name text, p_host_name text, p_map_id text, p_map_name text,
  p_map_data jsonb, p_max_players integer, p_token text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_room_id uuid; v_player_id uuid;
begin
  if char_length(trim(coalesce(p_room_name,''))) not between 2 and 48 then raise exception 'Название комнаты должно содержать 2–48 символов'; end if;
  if char_length(trim(coalesce(p_host_name,''))) not between 1 and 24 then raise exception 'Имя игрока должно содержать 1–24 символа'; end if;
  if p_max_players not between 2 and 4 then raise exception 'Допустимо от 2 до 4 игроков'; end if;
  if length(coalesce(p_token,'')) < 24 then raise exception 'Недействительный токен игрока'; end if;
  if p_map_data is null or jsonb_typeof(p_map_data) <> 'object' or jsonb_typeof(p_map_data->'cells') <> 'array' or jsonb_array_length(p_map_data->'cells') <> 64 then raise exception 'Некорректная игровая карта'; end if;
  insert into nastolka_rooms(room_name,map_id,map_name,map_data,host_player_id,max_players)
  values(trim(p_room_name),left(trim(p_map_id),80),left(trim(p_map_name),80),p_map_data,gen_random_uuid(),p_max_players)
  returning id into v_room_id;
  insert into nastolka_room_players(room_id,player_name,is_host) values(v_room_id,trim(p_host_name),true) returning id into v_player_id;
  update nastolka_rooms set host_player_id=v_player_id where id=v_room_id;
  insert into nastolka_player_secrets(player_id,room_id,token_hash) values(v_player_id,v_room_id,encode(digest(p_token,'sha256'),'hex'));
  return jsonb_build_object('room_id',v_room_id,'player_id',v_player_id,'player_token',p_token);
exception when unique_violation then raise exception 'Комната с таким названием уже ожидает игроков';
end; $$;

create or replace function public.nastolka_join_room(p_room_id uuid,p_player_name text,p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_room nastolka_rooms%rowtype; v_player_id uuid; v_hash text;
begin
  if char_length(trim(coalesce(p_player_name,''))) not between 1 and 24 then raise exception 'Имя игрока должно содержать 1–24 символа'; end if;
  if length(coalesce(p_token,'')) < 24 then raise exception 'Недействительный токен игрока'; end if;
  select * into v_room from nastolka_rooms where id=p_room_id for update;
  if not found then raise exception 'Комната не найдена'; end if;
  if v_room.status <> 'waiting' then raise exception 'Эта партия уже началась'; end if;
  v_hash:=encode(digest(p_token,'sha256'),'hex');
  select player_id into v_player_id from nastolka_player_secrets where room_id=p_room_id and token_hash=v_hash;
  if v_player_id is not null then return jsonb_build_object('room_id',p_room_id,'player_id',v_player_id,'player_token',p_token); end if;
  if (select count(*) from nastolka_room_players where room_id=p_room_id) >= v_room.max_players then raise exception 'В комнате больше нет свободных мест'; end if;
  insert into nastolka_room_players(room_id,player_name,is_host) values(p_room_id,trim(p_player_name),false) returning id into v_player_id;
  insert into nastolka_player_secrets(player_id,room_id,token_hash) values(v_player_id,p_room_id,v_hash);
  return jsonb_build_object('room_id',p_room_id,'player_id',v_player_id,'player_token',p_token);
end; $$;

create or replace function public.nastolka_leave_room(p_room_id uuid,p_player_id uuid,p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_is_host boolean;
begin
  if not exists(select 1 from nastolka_player_secrets where room_id=p_room_id and player_id=p_player_id and token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex')) then raise exception 'Не удалось подтвердить участника'; end if;
  select is_host into v_is_host from nastolka_room_players where id=p_player_id and room_id=p_room_id;
  delete from nastolka_room_players where id=p_player_id and room_id=p_room_id;
  if v_is_host then delete from nastolka_rooms where id=p_room_id; end if;
  if exists(select 1 from nastolka_rooms where id=p_room_id) and not exists(select 1 from nastolka_room_players where room_id=p_room_id) then delete from nastolka_rooms where id=p_room_id; end if;
  return jsonb_build_object('ok',true);
end; $$;

create or replace function public.nastolka_start_room(p_room_id uuid,p_player_id uuid,p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from nastolka_player_secrets where room_id=p_room_id and player_id=p_player_id and token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex')) then raise exception 'Не удалось подтвердить участника'; end if;
  if (select count(*) from nastolka_room_players where room_id=p_room_id) < 2 then raise exception 'Для старта нужен хотя бы один присоединившийся игрок'; end if;
  update nastolka_rooms set status='playing',updated_at=now() where id=p_room_id and host_player_id=p_player_id and status='waiting';
  if not found then raise exception 'Только создатель может запустить ожидающую партию'; end if;
  return jsonb_build_object('ok',true,'room_id',p_room_id);
end; $$;

revoke all on function public.nastolka_create_room(text,text,text,text,jsonb,integer,text) from public;
revoke all on function public.nastolka_join_room(uuid,text,text) from public;
revoke all on function public.nastolka_leave_room(uuid,uuid,text) from public;
revoke all on function public.nastolka_start_room(uuid,uuid,text) from public;
grant execute on function public.nastolka_create_room(text,text,text,text,jsonb,integer,text) to anon, authenticated;
grant execute on function public.nastolka_join_room(uuid,text,text) to anon, authenticated;
grant execute on function public.nastolka_leave_room(uuid,uuid,text) to anon, authenticated;
grant execute on function public.nastolka_start_room(uuid,uuid,text) to anon, authenticated;

-- Enable realtime updates for the shared room list and participant list.
do $$ begin
  alter publication supabase_realtime add table public.nastolka_rooms;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.nastolka_room_players;
exception when duplicate_object then null; when undefined_object then null; end $$;
