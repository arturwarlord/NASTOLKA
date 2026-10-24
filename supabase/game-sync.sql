-- NASTOLKA multiplayer game-state sync migration.
-- Run after supabase/schema.sql in the Supabase SQL Editor.
create table if not exists public.nastolka_room_game_states (
  room_id uuid primary key references public.nastolka_rooms(id) on delete cascade,
  state jsonb not null,
  revision bigint not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now()
);
alter table public.nastolka_room_game_states enable row level security;
drop policy if exists "Public can read online game state" on public.nastolka_room_game_states;
create policy "Public can read online game state"
  on public.nastolka_room_game_states for select using (true);
revoke insert, update, delete on public.nastolka_room_game_states from anon, authenticated;

create or replace function public.nastolka_init_game_state(
  p_room_id uuid, p_player_id uuid, p_token text, p_state jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_room public.nastolka_rooms%rowtype;
begin
  if not exists (
    select 1 from public.nastolka_player_secrets
    where room_id=p_room_id and player_id=p_player_id
      and token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex')
  ) then raise exception 'Не удалось подтвердить участника'; end if;
  select * into v_room from public.nastolka_rooms where id=p_room_id for update;
  if not found or v_room.status <> 'playing' then raise exception 'Комната не находится в запущенной игре'; end if;
  if v_room.host_player_id <> p_player_id then raise exception 'Только создатель может подготовить игровое поле'; end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object'
     or jsonb_typeof(p_state->'players') <> 'array'
     or jsonb_array_length(p_state->'players') not between 2 and 4
     or jsonb_typeof(p_state->'route') <> 'array'
     or jsonb_array_length(p_state->'route') < 2 then
    raise exception 'Некорректное начальное состояние партии';
  end if;
  insert into public.nastolka_room_game_states(room_id,state,revision,updated_at)
  values(p_room_id,p_state,1,now())
  on conflict(room_id) do nothing;
  if not found then raise exception 'Игровое состояние уже создано'; end if;
  return jsonb_build_object('ok',true,'revision',1);
end; $$;

create or replace function public.nastolka_submit_game_state(
  p_room_id uuid, p_player_id uuid, p_token text,
  p_expected_revision bigint, p_state jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_current public.nastolka_room_game_states%rowtype; v_room public.nastolka_rooms%rowtype;
declare v_turn integer; v_turn_player_id text;
begin
  if not exists (
    select 1 from public.nastolka_player_secrets
    where room_id=p_room_id and player_id=p_player_id
      and token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex')
  ) then raise exception 'Не удалось подтвердить участника'; end if;
  select * into v_room from public.nastolka_rooms where id=p_room_id for update;
  if not found or v_room.status <> 'playing' then raise exception 'Партия не запущена'; end if;
  select * into v_current from public.nastolka_room_game_states where room_id=p_room_id for update;
  if not found then raise exception 'Начальное состояние партии ещё не создано'; end if;
  if v_current.revision <> p_expected_revision then
    return jsonb_build_object('ok',false,'conflict',true,'revision',v_current.revision,'state',v_current.state);
  end if;
  v_turn := greatest(0,coalesce((v_current.state->>'turn')::integer,0));
  v_turn_player_id := v_current.state->'players'->v_turn->>'onlinePlayerId';
  if v_turn_player_id is null or v_turn_player_id <> p_player_id::text then
    raise exception 'Сейчас ход другого игрока';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object'
     or jsonb_typeof(p_state->'players') <> 'array'
     or jsonb_array_length(p_state->'players') not between 2 and 4
     or jsonb_typeof(p_state->'route') <> 'array'
     or jsonb_array_length(p_state->'route') < 2 then
    raise exception 'Некорректное состояние партии';
  end if;
  update public.nastolka_room_game_states
  set state=p_state,revision=revision+1,updated_at=now()
  where room_id=p_room_id and revision=p_expected_revision;
  if not found then
    select * into v_current from public.nastolka_room_game_states where room_id=p_room_id;
    return jsonb_build_object('ok',false,'conflict',true,'revision',v_current.revision,'state',v_current.state);
  end if;
  return jsonb_build_object('ok',true,'revision',p_expected_revision+1);
end; $$;

revoke all on function public.nastolka_init_game_state(uuid,uuid,text,jsonb) from public;
revoke all on function public.nastolka_submit_game_state(uuid,uuid,text,bigint,jsonb) from public;
grant execute on function public.nastolka_init_game_state(uuid,uuid,text,jsonb) to anon, authenticated;
grant execute on function public.nastolka_submit_game_state(uuid,uuid,text,bigint,jsonb) to anon, authenticated;

do $$ begin
  alter publication supabase_realtime add table public.nastolka_room_game_states;
exception when duplicate_object then null; when undefined_object then null; end $$;
