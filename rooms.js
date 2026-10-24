(() => {
  const $room = (selector, root = document) => root.querySelector(selector);
  const $$room = (selector, root = document) => [...root.querySelectorAll(selector)];
  const config = window.NASTOLKA_SUPABASE_CONFIG || {};
  const statusEl = $room('#roomConnectionStatus');
  const listEl = $room('#roomsList');
  const lobbyEl = $room('#roomLobby');
  const createDialog = $room('#createRoomDialog');
  const createForm = $room('#createRoomForm');
  const mapSelect = $room('#roomMapSelect');
  if (!statusEl || !listEl || !createDialog || !createForm) return;

  let client = null;
  let roomChannel = null;
  let currentRoom = null;
  let currentPlayer = null;
  let currentToken = null;
  let roomsCache = [];
  let gameSyncSchemaReady = true;
  const tokenKey = 'nastolka-online-player-token';
  const playerIdKey = 'nastolka-online-player-id';
  const roomIdKey = 'nastolka-online-room-id';

  function setStatus(message, type='') {
    statusEl.className = 'room-connection-status' + (type ? ' is-' + type : '');
    const text = document.createElement('span');
    text.textContent = message;
    statusEl.replaceChildren(Object.assign(document.createElement('span'), {className:'status-dot'}), text);
  }
  function escapeText(value) { return String(value ?? ''); }
  function getToken() {
    let token = localStorage.getItem(tokenKey);
    if (!token) {
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      token = [...bytes].map(value => value.toString(16).padStart(2,'0')).join('');
      localStorage.setItem(tokenKey, token);
    }
    return token;
  }
  function presetMap(id) {
    if (typeof buildPresetMap !== 'function' || !Array.isArray(games)) return null;
    const game = games.find(item => item.id === id);
    return game ? buildPresetMap(game) : null;
  }
  function fillMapChoices() {
    mapSelect.replaceChildren();
    const builtinGroup = document.createElement('optgroup'); builtinGroup.label = 'Миры NASTOLKA';
    (Array.isArray(games) ? games : []).forEach(game => {
      const option = document.createElement('option'); option.value = game.id; option.textContent = game.name; builtinGroup.append(option);
    });
    mapSelect.append(builtinGroup);
    const customMaps = typeof getSavedMaps === 'function' ? getSavedMaps() : [];
    if (customMaps.length) {
      const group = document.createElement('optgroup'); group.label = 'Мои карты (содержимое будет передано в комнату)';
      customMaps.forEach(map => {
        const option = document.createElement('option'); option.value = 'custom:' + map.id; option.textContent = map.name; group.append(option);
      });
      mapSelect.append(group);
    }
  }
  function selectedMap() {
    const id = mapSelect.value;
    if (id.startsWith('custom:')) {
      const map = (typeof getSavedMaps === 'function' ? getSavedMaps() : []).find(item => String(item.id) === id.slice(7));
      return map ? {id:String(map.id), name:map.name, data:map} : null;
    }
    const game = games.find(item => item.id === id);
    const data = presetMap(id);
    return game && data ? {id:game.id, name:game.name, data} : null;
  }
  async function rpc(name, args) {
    const {data,error} = await client.rpc(name,args);
    if (error) throw error;
    return data;
  }
  let loadRoomsInProgress = false;
  async function loadRooms() {
    if (!client || loadRoomsInProgress) return;
    loadRoomsInProgress = true;
    try {
      let result = await client.from('nastolka_rooms').select('id,room_name,map_id,map_name,map_data,game_state,game_version,max_players,status,created_at,host_player_id').in('status',['waiting','playing']).order('created_at',{ascending:false}).limit(100);
      if(result.error && /game_state|game_version|column/i.test(result.error.message||'')) {
        gameSyncSchemaReady = false;
        setStatus('Список комнат доступен, но синхронизация партии ещё не установлена в Supabase. Открой supabase/schema.sql и выполни его целиком: он включает SQL синхронизации.','error');
        result = await client.from('nastolka_rooms').select('id,room_name,map_id,map_name,map_data,max_players,status,created_at,host_player_id').in('status',['waiting','playing']).order('created_at',{ascending:false}).limit(100);
      } else if(!result.error) {
        gameSyncSchemaReady = true;
      }
      const {data,error} = result;
      if (error) throw error;
      const ids=(data||[]).map(room=>room.id);
      let playerRows=[];
      if(ids.length) {
        const playersResult=await client.from('nastolka_room_players').select('id,room_id,player_name,is_host,joined_at').in('room_id',ids).order('joined_at',{ascending:true}).order('id',{ascending:true});
        if(playersResult.error) throw playersResult.error;
        playerRows=playersResult.data||[];
      }
      roomsCache=(data||[]).map(room=>({...room,players:playerRows.filter(player=>player.room_id===room.id)}));
      renderRooms();
      if(currentRoom) {
        const latest=roomsCache.find(room=>room.id===currentRoom.id);
        if(latest) {
          currentRoom=latest;
          const sessionPlayer=latest.players.find(player=>player.id===currentPlayer?.id);
          if(sessionPlayer) currentPlayer={...sessionPlayer,is_host:sessionPlayer.is_host};
          renderLobby(latest);
          if(latest.status==='playing'&&latest.game_state) syncOnlineGame(latest);
        } else {
          currentRoom=null;
          lobbyEl.hidden=true;
          setStatus('Комната закрыта или больше недоступна.','');
        }
      }
    } finally {
      loadRoomsInProgress = false;
    }
  }
  function renderRooms() {
    const query=$room('#roomSearch').value.trim().toLocaleLowerCase('ru');
    const rooms=roomsCache.filter(room=>room.room_name.toLocaleLowerCase('ru').includes(query));
    listEl.replaceChildren();
    if(!rooms.length) {
      const empty=document.createElement('div'); empty.className='room-empty';
      const icon=document.createElement('span'); icon.textContent='⚄';
      const title=document.createElement('strong'); title.textContent=query?'Комнат с таким названием нет':'Пока нет открытых столов';
      const note=document.createElement('p'); note.textContent=query?'Проверь написание или попробуй другое название.':'Создай комнату, чтобы собрать игроков за одним столом.';
      empty.append(icon,title,note); listEl.append(empty); return;
    }
    rooms.forEach(room=>{
      const card=document.createElement('article'); card.className='room-card';
      const top=document.createElement('div'); top.className='room-card-top';
      const info=document.createElement('div'); const title=document.createElement('h3'); title.textContent=room.room_name;
      const map=document.createElement('div'); map.className='room-card-map'; map.textContent='Карта: '+room.map_name;
      info.append(title,map);
      const badge=document.createElement('span'); badge.className='room-status-pill'; badge.textContent=room.status==='playing'?'ИДЁТ ИГРА':'ОЖИДАЕТ';
      top.append(info,badge);
      const meta=document.createElement('div'); meta.className='room-card-meta';
      const count=document.createElement('span'); count.textContent='♟ '+room.players.length+' / '+room.max_players+' игроков';
      const host=room.players.find(player=>player.is_host);
      const owner=document.createElement('span'); owner.textContent='Создатель: '+(host?host.player_name:'игрок');
      meta.append(count,owner);
      const actions=document.createElement('div'); actions.className='room-card-actions';
      const savedRoomId=localStorage.getItem(roomIdKey);
      const savedPlayerId=localStorage.getItem(playerIdKey);
      const savedToken=localStorage.getItem(tokenKey);
      const canResume=Boolean(savedToken&&savedRoomId===room.id&&savedPlayerId&&room.players.some(player=>player.id===savedPlayerId));
      const join=document.createElement('button'); join.type='button'; join.className='primary-button';
      join.textContent=canResume?'Вернуться в игру ↗':(room.status==='playing'?'Идёт игра':'Присоединиться ↗');
      join.disabled=canResume?false:(room.status!=='waiting'||room.players.length>=room.max_players);
      join.addEventListener('click',()=>canResume?resumeRoom(room):joinRoom(room));
      actions.append(join);
      card.append(top,meta,actions); listEl.append(card);
    });
  }
  function syncOnlineGame(room) {
    if(!room || room.status!=='playing' || !room.game_state || !currentPlayer || !currentToken || !window.NASTOLKA_GAME) return;
    const playerIds=room.players.map(player=>player.id);
    if(!playerIds.includes(currentPlayer.id)) return;
    const context={
      roomId:room.id,
      playerId:currentPlayer.id,
      playerIds,
      version:Number(room.game_version)||Number(room.game_state.version)||1,
      submitTurn:(expectedVersion,nextState)=>rpc('nastolka_submit_turn',{
        p_room_id:room.id,p_player_id:currentPlayer.id,p_token:currentToken,
        p_expected_version:expectedVersion,p_next_state:nextState
      }),
      refresh:()=>loadRooms().catch(error=>setStatus(error.message||'Не удалось синхронизировать партию.','error'))
    };
    window.NASTOLKA_GAME.showOnline(room.map_data,room.game_state,context);
  }
  function renderLobby(room) {
    if(!room) {lobbyEl.hidden=true;return}
    lobbyEl.hidden=false; lobbyEl.replaceChildren();
    const heading=document.createElement('div'); heading.className='room-lobby-heading';
    const titleWrap=document.createElement('div'); const title=document.createElement('h3'); title.textContent=room.room_name;
    const subtitle=document.createElement('div'); subtitle.className='room-lobby-subtitle'; subtitle.textContent=room.map_name+' · '+room.players.length+' из '+room.max_players+' игроков · '+(room.status==='playing'?'Партия запущена':'Ожидание игроков');
    titleWrap.append(title,subtitle);
    const close=document.createElement('button'); close.type='button'; close.className='secondary-editor-button'; close.textContent='Скрыть лобби'; close.addEventListener('click',()=>{lobbyEl.hidden=true});
    heading.append(titleWrap,close); lobbyEl.append(heading);
    const players=document.createElement('div'); players.className='room-player-list';
    room.players.forEach((player,index)=>{const row=document.createElement('div');row.className='room-player';const icon=document.createElement('span');icon.className='room-player-icon';icon.textContent=player.is_host?'★':String(index+1);const name=document.createElement('span');name.textContent=player.player_name+(player.is_host?' · создатель':'');row.append(icon,name);players.append(row)});
    for(let i=room.players.length;i<room.max_players;i++){const row=document.createElement('div');row.className='room-player';const icon=document.createElement('span');icon.className='room-player-icon';icon.textContent='+';icon.style.background='#34362b';icon.style.color='#a5a699';const name=document.createElement('span');name.textContent='Свободное место';row.append(icon,name);players.append(row)}
    lobbyEl.append(players);
    const actions=document.createElement('div');actions.className='room-lobby-actions';
    if(currentPlayer&&currentRoom&&currentPlayer.is_host&&room.status==='waiting'){
      const start=document.createElement('button');start.type='button';start.className='primary-button';start.textContent='Начать партию ↗';start.disabled=room.players.length<2||!gameSyncSchemaReady;
      start.title=!gameSyncSchemaReady?'Сначала выполни полный supabase/schema.sql в Supabase SQL Editor':(room.players.length<2?'Нужен хотя бы один присоединившийся игрок':'');
      start.addEventListener('click',async()=>{
        try{
          const playerIds=room.players.map(player=>player.id);
          const initialState=window.NASTOLKA_GAME.createInitialState(room.map_data,room.players);
          await rpc('nastolka_begin_game',{p_room_id:room.id,p_player_id:currentPlayer.id,p_token:currentToken,p_initial_state:initialState,p_player_ids:playerIds});
          await loadRooms();
          setStatus('Партия запущена. Поле и ходы синхронизируются между участниками.','connected');
        }catch(error){setStatus(error.message||'Не удалось запустить партию.','error')}
      });
      actions.append(start);
    }
    const leave=document.createElement('button');leave.type='button';leave.className='secondary-editor-button';leave.textContent='Выйти из комнаты';
    leave.addEventListener('click',async()=>{if(!currentRoom||!currentPlayer||!currentToken){currentRoom=null;currentPlayer=null;lobbyEl.hidden=true;return}try{await rpc('nastolka_leave_room',{p_room_id:currentRoom.id,p_player_id:currentPlayer.id,p_token:currentToken});localStorage.removeItem(roomIdKey);localStorage.removeItem(playerIdKey);currentRoom=null;currentPlayer=null;currentToken=null;lobbyEl.hidden=true;await loadRooms();setStatus('Ты вышел из комнаты.','connected')}catch(error){setStatus(error.message||'Не удалось выйти из комнаты.','error')}});
    actions.append(leave); lobbyEl.append(actions);
  }
  function resumeRoom(room) {
    const savedRoomId=localStorage.getItem(roomIdKey);
    const savedPlayerId=localStorage.getItem(playerIdKey);
    const savedToken=localStorage.getItem(tokenKey);
    if(!savedToken||savedRoomId!==room.id||!savedPlayerId) {
      setStatus('Не найдена сохранённая сессия этой комнаты. Присоединиться можно только до старта партии.','error');
      return;
    }
    const player=room.players.find(item=>item.id===savedPlayerId);
    if(!player) {
      setStatus('Твой игрок больше не числится в этой комнате. Возможно, создатель закрыл стол.','error');
      return;
    }
    currentRoom=room;
    currentPlayer={...player,is_host:player.is_host};
    currentToken=savedToken;
    renderLobby(room);
    if(room.status==='playing'&&room.game_state) syncOnlineGame(room);
    else if(room.status==='playing') setStatus('Комната найдена, но состояние партии ещё не загрузилось. Обновляю список…','');
    else setStatus('Ты вернулся в комнату «'+room.room_name+'».','connected');
    lobbyEl.scrollIntoView({behavior:'smooth',block:'center'});
  }
  async function joinRoom(room) {
    if(!client)return;
    const playerName=prompt('Как тебя будут видеть за столом?','Игрок');
    if(playerName===null)return;
    const cleanName=playerName.trim().slice(0,24);
    if(!cleanName){setStatus('Введи имя длиной от 1 до 24 символов.','error');return}
    try{
      const token=getToken();
      const result=await rpc('nastolka_join_room',{p_room_id:room.id,p_player_name:cleanName,p_token:token});
      currentRoom=room; currentPlayer={id:result.player_id,is_host:room.host_player_id===result.player_id};currentToken=token;
      localStorage.setItem(roomIdKey,room.id);localStorage.setItem(playerIdKey,result.player_id);
      await loadRooms();const latest=roomsCache.find(item=>item.id===room.id);if(latest)currentRoom=latest;
      renderLobby(currentRoom);setStatus('Ты подключён к комнате «'+room.room_name+'».','connected');
    }catch(error){setStatus(error.message||'Не удалось присоединиться.','error')}
  }
  function openCreateDialog() {fillMapChoices();createDialog.showModal()}
  $room('#createRoomOpen').addEventListener('click',openCreateDialog);
  $room('#refreshRoomsBtn').addEventListener('click',()=>loadRooms().catch(error=>setStatus(error.message||'Не удалось обновить список.','error')));
  $room('#roomSearch').addEventListener('input',renderRooms);
  createForm.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!client){setStatus('Онлайн-сервис не подключён. Сначала добавим URL и anon key Supabase в supabase-config.js.','error');return}
    const map=selectedMap();if(!map){setStatus('Не удалось загрузить выбранную карту.','error');return}
    const roomName=$room('#roomName').value.trim();const hostName=$room('#roomHostName').value.trim();const maxPlayers=Number($room('#roomMaxPlayers').value);
    try{
      const token=getToken();
      const result=await rpc('nastolka_create_room',{p_room_name:roomName,p_host_name:hostName,p_map_id:map.id,p_map_name:map.name,p_map_data:map.data,p_max_players:maxPlayers,p_token:token});
      currentRoom={id:result.room_id,room_name:roomName,map_id:map.id,map_name:map.name,max_players:maxPlayers,status:'waiting',host_player_id:result.player_id,players:[]};
      currentPlayer={id:result.player_id,is_host:true};currentToken=token;
      localStorage.setItem(roomIdKey,result.room_id);localStorage.setItem(playerIdKey,result.player_id);
      createDialog.close();createForm.reset();await loadRooms();currentRoom=roomsCache.find(room=>room.id===result.room_id)||currentRoom;renderLobby(currentRoom);
      setStatus('Комната создана. Отправь друзьям название: '+roomName+'.','connected');
      lobbyEl.scrollIntoView({behavior:'smooth',block:'center'});
    }catch(error){setStatus(error.message||'Не удалось создать комнату.','error')}
  });
  function restoreSession() {
    const roomId=localStorage.getItem(roomIdKey);const playerId=localStorage.getItem(playerIdKey);const token=localStorage.getItem(tokenKey);
    if(roomId&&playerId&&token){currentToken=token;currentPlayer={id:playerId,is_host:false};return {roomId,playerId}}
    return null;
  }
  async function initialize() {
    fillMapChoices();
    if(!config.url||!config.anonKey||!window.supabase||!window.supabase.createClient){
      setStatus('Онлайн-сервис не настроен. Интерфейс готов, но комнаты станут общими после подключения Supabase.','');
      return;
    }
    try{
      client=window.supabase.createClient(config.url,config.anonKey);
      await loadRooms();
      setStatus(gameSyncSchemaReady?'Подключено к онлайн-комнатам. Список обновляется автоматически.':'Комнаты доступны; для запуска общей партии нужно применить supabase/multiplayer.sql.','connected');
      roomChannel=client.channel('nastolka-room-updates').on('postgres_changes',{event:'*',schema:'public',table:'nastolka_rooms'},()=>loadRooms().catch(()=>{})).on('postgres_changes',{event:'*',schema:'public',table:'nastolka_room_players'},()=>loadRooms().catch(()=>{})).subscribe();
      // Realtime can be delayed or missed on mobile/background tabs; polling is the recovery path.
      setInterval(() => {
        if (client && document.visibilityState === 'visible') loadRooms().catch(error => setStatus(error.message || 'Не удалось обновить состояние комнаты.','error'));
      }, 1800);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && client) loadRooms().catch(() => {});
      });
      const session=restoreSession();
      if(session){const room=roomsCache.find(item=>item.id===session.roomId);if(room){currentRoom=room;const player=room.players.find(item=>item.id===session.playerId);if(player){currentPlayer={...player,is_host:player.is_host};renderLobby(room);if(room.status==='playing'&&room.game_state)syncOnlineGame(room)}}}
    }catch(error){setStatus('Не удалось подключиться к базе комнат: '+(error.message||'проверь настройки Supabase'),'error')}
  }
  $room('#createRoomDialog .dialog-close').addEventListener('click',()=>createDialog.close());
  createDialog.addEventListener('click',event=>{if(event.target===createDialog)createDialog.close()});
  $$room('a[href="#current-games"]').forEach(link=>link.addEventListener('click',()=>setTimeout(()=>{if(client)loadRooms().catch(()=>{})},0)));
  initialize();
})();
