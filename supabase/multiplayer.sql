-- NASTOLKA synchronized multiplayer game state migration.
-- Run after schema.sql in Supabase SQL Editor.
alter table public.nastolka_rooms
  add column if not exists game_state jsonb,
  add column if not exists game_version integer not null default 0;

create or replace function public.nastolka_begin_game(
  p_room_id uuid,
  p_player_id uuid,
  p_token text,
  p_initial_state jsonb,
  p_player_ids uuid[]
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_room public.nastolka_rooms%rowtype;
  v_player_count integer;
  v_expected_ids uuid[];
  v_token_hash text;
begin
  v_token_hash := encode(digest(coalesce(p_token,''),'sha256'),'hex');
  if not exists (
    select 1 from public.nastolka_player_secrets
    where room_id=p_room_id and player_id=p_player_id and token_hash=v_token_hash
  ) then raise exception 'Не удалось подтвердить участника'; end if;

  select * into v_room from public.nastolka_rooms where id=p_room_id for update;
  if not found then raise exception 'Комната не найдена'; end if;
  if v_room.host_player_id <> p_player_id then raise exception 'Только создатель может начать партию'; end if;
  if v_room.status <> 'waiting' then raise exception 'Комната уже запущена'; end if;

  select count(*), array_agg(id order by joined_at asc, id asc)
    into v_player_count, v_expected_ids
    from public.nastolka_room_players where room_id=p_room_id;
  if v_player_count < 2 then raise exception 'Для старта нужен хотя бы один присоединившийся игрок'; end if;
  if coalesce(array_length(p_player_ids,1),0) <> v_player_count or p_player_ids <> v_expected_ids then
    raise exception 'Список игроков изменился. Обнови комнату и попробуй снова';
  end if;
  if p_initial_state is null
     or jsonb_typeof(p_initial_state) is distinct from 'object'
     or jsonb_typeof(p_initial_state->'players') is distinct from 'array'
     or jsonb_array_length(coalesce(p_initial_state->'players','[]'::jsonb)) <> v_player_count
     or jsonb_typeof(p_initial_state->'route') is distinct from 'array'
     or jsonb_array_length(coalesce(p_initial_state->'route','[]'::jsonb)) < 2 then
    raise exception 'Некорректное начальное состояние игры';
  end if;

  update public.nastolka_rooms
    set status='playing',
        game_state=p_initial_state || jsonb_build_object('online_player_ids',to_jsonb(p_player_ids),'version',1),
        game_version=1,
        updated_at=now()
    where id=p_room_id;
  return jsonb_build_object('ok',true,'room_id',p_room_id,'version',1);
end;
$$;

create or replace function public.nastolka_submit_turn(
  p_room_id uuid,
  p_player_id uuid,
  p_token text,
  p_expected_version integer,
  p_next_state jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_room public.nastolka_rooms%rowtype;
  v_ids uuid[];
  v_turn integer;
  v_active_player uuid;
  v_token_hash text;
begin
  v_token_hash := encode(digest(coalesce(p_token,''),'sha256'),'hex');
  if not exists (
    select 1 from public.nastolka_player_secrets
    where room_id=p_room_id and player_id=p_player_id and token_hash=v_token_hash
  ) then raise exception 'Не удалось подтвердить участника'; end if;

  select * into v_room from public.nastolka_rooms where id=p_room_id for update;
  if not found or v_room.status <> 'playing' or v_room.game_state is null then
    raise exception 'Общая партия не найдена или не запущена';
  end if;
  if v_room.game_version <> p_expected_version then
    raise exception 'Партия уже обновилась. Синхронизирую последнее состояние';
  end if;

  select array_agg(value::text::uuid order by ordinality)
    into v_ids
    from jsonb_array_elements_text(v_room.game_state->'online_player_ids') with ordinality;
  v_turn := (v_room.game_state->>'turn')::integer;
  if v_turn < 0 or v_turn >= coalesce(array_length(v_ids,1),0) or v_ids[v_turn+1] <> p_player_id then
    raise exception 'Сейчас ход другого игрока';
  end if;
  if p_next_state is null
     or jsonb_typeof(p_next_state) is distinct from 'object'
     or jsonb_typeof(p_next_state->'players') is distinct from 'array'
     or jsonb_array_length(coalesce(p_next_state->'players','[]'::jsonb)) <> array_length(v_ids,1)
     or jsonb_typeof(p_next_state->'route') is distinct from 'array'
     or p_next_state->'route' <> v_room.game_state->'route'
     or coalesce((p_next_state->>'turn')::integer,-1) < 0
     or coalesce((p_next_state->>'turn')::integer,-1) >= array_length(v_ids,1)
     or p_next_state->'online_player_ids' <> v_room.game_state->'online_player_ids'
     or coalesce((p_next_state->>'turns')::integer,-1) <> coalesce((v_room.game_state->>'turns')::integer,0) + 1 then
    raise exception 'Некорректный ход';
  end if;

  update public.nastolka_rooms
    set game_state=p_next_state || jsonb_build_object('version',v_room.game_version+1),
        game_version=v_room.game_version+1,
        updated_at=now()
    where id=p_room_id;
  return jsonb_build_object('ok',true,'version',v_room.game_version+1);
end;
$$;

revoke all on function public.nastolka_begin_game(uuid,uuid,text,jsonb,uuid[]) from public;
revoke all on function public.nastolka_submit_turn(uuid,uuid,text,integer,jsonb) from public;
grant execute on function public.nastolka_begin_game(uuid,uuid,text,jsonb,uuid[]) to anon, authenticated;
grant execute on function public.nastolka_submit_turn(uuid,uuid,text,integer,jsonb) to anon, authenticated;
