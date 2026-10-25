const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const games = [
  {id:'wild',name:'Дикий рубеж',category:'fantasy',genre:'Фэнтези',description:'Исследуй древние леса, найди артефакты и напиши собственную легенду.'},
  {id:'city',name:'Город возможностей',category:'strategy',genre:'Стратегия',description:'Покупай участки, строй империю и обойди соперников на каждом ходу.'},
  {id:'secret',name:'Последний секрет',category:'mystery',genre:'Мистика',description:'Каждая улика важна. Сможешь раскрыть тайну до последнего броска?'},
  {id:'island',name:'Остров сокровищ',category:'family',genre:'Приключение',description:'Собирай команду, ищи спрятанные богатства и остерегайся ловушек.'},
  {id:'neon',name:'Неоновый предел',category:'strategy',genre:'Киберпанк',description:'В городе будущего информация дороже золота. Доверься инстинктам.'},
  {id:'cosmos',name:'На краю галактики',category:'family',genre:'Космос',description:'Прокладывай маршрут по звёздам и решай, что скрывается за горизонтом.'}
];
const rollMessages = ['Судьба на твоей стороне. Сделай смелый ход!','Неожиданный поворот — именно то, что нужно.','Время исследовать неизведанное.','Собери команду: впереди большое приключение.','Рискни. Лучшие истории начинаются с риска.','Сегодня выпало шесть. Мир открыт!'];
let toastTimer;
let searchMode = 'games';
let activeMapId = null;
let selectedTile = 'path';
let activePlayMap = null;
let gameState = null;
let onlineGameContext = null;
const playerColors = ['#d8ff3e','#7ec8ff','#ff9b82','#c4a7ff'];
const playerNames = ['Игрок 1','Игрок 2','Игрок 3','Игрок 4'];
function getLastPlayerNames(){
  const saved=readStorage('nastolka-player-names',[]);
  return playerNames.map((fallback,index)=>typeof saved[index]==='string'&&saved[index].trim()?saved[index].trim().slice(0,18):fallback);
}
function renderPlayerNameFields(){
  const host=$('#playerNameFields');
  if(!host)return;
  const count=Number($('#playerCount').value)||2;
  const names=getLastPlayerNames();
  host.replaceChildren();
  for(let i=0;i<count;i++){
    const field=document.createElement('label');field.className='player-name-field';
    const caption=document.createElement('span');caption.textContent='Игрок '+(i+1);
    const input=document.createElement('input');input.type='text';input.name='playerName'+(i+1);input.maxLength=18;input.autocomplete='off';input.value=names[i]||playerNames[i];input.setAttribute('aria-label','Имя игрока '+(i+1));input.placeholder=playerNames[i];
    field.append(caption,input);host.append(field);
  }
}
const tileInfo = {
  empty:{label:'Пусто',symbol:''},
  path:{label:'Путь',symbol:'·'},
  start:{label:'Старт',symbol:'↗'},
  finish:{label:'Финиш',symbol:'⚑'},
  treasure:{label:'Сокровище',symbol:'✦'},
  trap:{label:'Ловушка',symbol:'!'},
  event:{label:'Событие',symbol:'?'}
};
function blankBoard(){
  const cells = Array.from({length:64}, () => 'path');
  cells[0] = 'start';
  cells[63] = 'finish';
  return cells;
}
function normalizeBoard(map){
  if(Array.isArray(map.cells) && map.cells.length === 64) return map.cells.map(cell => tileInfo[cell] ? cell : 'path');
  return blankBoard();
}
function openEditor(map){
  activeMapId = map.id;
  selectedTile = 'path';
  $$('.tile-tool').forEach(button => button.classList.toggle('selected', button.dataset.tile === selectedTile));
  $('#editorTitle').textContent = map.name.toLocaleUpperCase('ru');
  $('#mapRules').value = map.rules || '';
  map.cells = normalizeBoard(map);
  renderEditorBoard(map.cells);
  $('#editorDialog').showModal();
}
function renderEditorBoard(cells){
  const board = $('#editorBoard');
  board.replaceChildren();
  const previewRoute = playableCells({cells});
  const routeIndices = new Set((previewRoute || []).map(cell => cell.index));
  const specialTypes = new Set(['treasure','trap','event']);
  const specialOnRoute = cells.filter((type, index) => specialTypes.has(type) && routeIndices.has(index)).length;
  const specialOffRoute = cells.filter((type, index) => specialTypes.has(type) && !routeIndices.has(index)).length;

  cells.forEach((type, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'editor-cell tile-' + (tileInfo[type] ? type : 'path');
    if(previewRoute && routeIndices.has(index)) button.classList.add('editor-route-cell');
    else if(type !== 'empty') button.classList.add('editor-off-route-cell');
    button.textContent = tileInfo[type] ? tileInfo[type].symbol : '·';
    const label = 'Клетка ' + (index + 1) + ': ' + (tileInfo[type] ? tileInfo[type].label : 'Путь');
    button.setAttribute('aria-label', label + (routeIndices.has(index) ? ', на маршруте' : ''));
    button.title = label + (routeIndices.has(index) ? ' — на маршруте' : ' — вне маршрута');
    button.addEventListener('click', () => {
      const maps = getSavedMaps();
      const map = maps.find(item => item.id === activeMapId);
      if(!map) return;
      const next = [...normalizeBoard(map)];
      if(selectedTile === 'start' || selectedTile === 'finish'){
        next.forEach((cell, i) => { if(cell === selectedTile) next[i] = 'path'; });
      }
      next[index] = selectedTile;
      map.cells = next;
      setSavedMaps(maps);
      renderEditorBoard(next);
    });
    board.append(button);
  });
  $('#tileCount').textContent = cells.length;
  const status = $('#editorRouteStatus');
  if(status){
    if(!previewRoute){
      status.textContent = 'Маршрут не соединён: поставь Старт и Финиш и соедини их соседними клетками без пустых разрывов.';
      status.className = 'editor-route-status is-invalid';
    }else{
      const routeText = 'Маршрут найден: ' + previewRoute.length + ' клеток. События на маршруте: ' + specialOnRoute + '.';
      const warning = specialOffRoute ? ' Вне маршрута: ' + specialOffRoute + ' событий — они не сработают.' : '';
      status.textContent = routeText + warning;
      status.className = 'editor-route-status' + (specialOffRoute ? ' has-warning' : ' is-valid');
    }
  }
}

function toast(message){
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
function readStorage(key, fallback){
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value === null ? fallback : value;
  } catch { return fallback; }
}
function getSavedMaps(){const value=readStorage('nastolka-maps',[]);return Array.isArray(value)?value:[]}
function setSavedMaps(maps){try{localStorage.setItem('nastolka-maps',JSON.stringify(maps))}catch{toast('Не удалось сохранить данные. Проверь свободное место в браузере.')}}
function getSavedGames(){const value=readStorage('nastolka-saved-games',[]);return Array.isArray(value)?value:[]}
function getGameHistory(){const value=readStorage('nastolka-game-history',[]);return Array.isArray(value)?value:[]}
function saveGameHistory(history){try{localStorage.setItem('nastolka-game-history',JSON.stringify(history.slice(0,50)))}catch{toast('Не удалось сохранить историю партий в браузере.')}}
function renderGameStats(){
  const summary=$('#gameStatsSummary');
  const recent=$('#gameHistoryList');
  if(!summary||!recent)return;
  const history=getGameHistory();
  const completed=history.length;
  const coins=history.reduce((sum,game)=>sum+(Number(game.totalCoins)||0),0);
  const playerTotals={};
  history.forEach(game=>{
    if(Array.isArray(game.players))game.players.forEach(player=>{const name=String(player.name||'Неизвестно');if(!playerTotals[name])playerTotals[name]={wins:0,coins:0};playerTotals[name].coins+=Number(player.coins)||0;if(player.winner)playerTotals[name].wins++});
    else if(game.winner){const name=String(game.winner);if(!playerTotals[name])playerTotals[name]={wins:0,coins:0};playerTotals[name].wins++;playerTotals[name].coins+=Number(game.winnerCoins)||0}
  });
  const leader=Object.entries(playerTotals).sort((a,b)=>b[1].wins-a[1].wins||b[1].coins-a[1].coins)[0];
  const leaderLabel=leader?leader[0]+' · '+leader[1].wins:'—';
  summary.replaceChildren();
  [[completed,'Завершённых партий'],[coins,'Монет собрано'],[leaderLabel,'Чаще побеждает']].forEach(([value,label])=>{
    const item=document.createElement('div');item.className='game-stat';
    const strong=document.createElement('strong');strong.textContent=String(value);
    const caption=document.createElement('span');caption.textContent=label;
    item.append(strong,caption);summary.append(item);
  });
  const playerList=$('#playerStatsList');
  if(playerList){
    playerList.replaceChildren();
    const heading=document.createElement('h4');heading.className='player-stats-heading';heading.textContent='РЕЙТИНГ ИГРОКОВ';playerList.append(heading);
    const ranked=Object.entries(playerTotals).sort((a,b)=>b[1].wins-a[1].wins||b[1].coins-a[1].coins);
    if(!ranked.length){const empty=document.createElement('p');empty.className='game-history-empty';empty.textContent='Рейтинг появится после первой завершённой партии.';playerList.append(empty)}
    ranked.slice(0,8).forEach(([name,stats],index)=>{const row=document.createElement('div');row.className='player-stats-row';const rank=document.createElement('span');rank.className='player-stats-rank';rank.textContent=String(index+1).padStart(2,'0');const player=document.createElement('strong');player.textContent=name;const detail=document.createElement('span');detail.textContent=stats.wins+' побед · '+stats.coins+' монет';row.append(rank,player,detail);playerList.append(row)});
  }
  recent.replaceChildren();
  if(!history.length){const empty=document.createElement('p');empty.className='game-history-empty';empty.textContent='Здесь появятся результаты после первой завершённой партии.';recent.append(empty);return}
  history.slice(0,5).forEach(game=>{
    const row=document.createElement('div');row.className='game-history-row';
    const info=document.createElement('div');info.className='game-history-info';
    const title=document.createElement('strong');title.textContent=game.mapName||'Авторская карта';
    const meta=document.createElement('span');
    const date=game.date?new Date(game.date):null;
    const dateText=date&&!Number.isNaN(date.getTime())?date.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}):'Дата неизвестна';
    meta.textContent=dateText+' · '+(game.playerCount||2)+' игрока · '+(game.turns||0)+' ходов';
    info.append(title,meta);
    const result=document.createElement('div');result.className='game-history-result';
    const winner=document.createElement('strong');winner.textContent=game.winner||'Победитель';
    const reward=document.createElement('span');reward.textContent='✦ '+(Number(game.winnerCoins)||0)+' монет';
    result.append(winner,reward);row.append(info,result);recent.append(row);
  });
}
function setSavedGames(ids){try{localStorage.setItem('nastolka-saved-games',JSON.stringify(ids))}catch{toast('Не удалось сохранить избранное в браузере.')}}
function updateSavedUI(){
  const maps = getSavedMaps();
  const count = $('.tiny-count');
  if(count) count.textContent = maps.length;
  $$('.save-button').forEach(btn => {
    const saved = getSavedGames().includes(btn.dataset.save);
    btn.classList.toggle('saved', saved);
    btn.textContent = saved ? '✓' : '＋';
    btn.setAttribute('aria-pressed', String(saved));
  });
}
function rollDice(target){
  const value = Math.floor(Math.random() * 6) + 1;
  const faces = ['⚀','⚁','⚂','⚃','⚄','⚅'];
  if(target) target.textContent = faces[value-1] + '  Выпало ' + value + '!';
  return value;
}
function buildPresetMap(game){
  const cells=Array.from({length:64},()=>'empty');
  const route=[];
  for(let row=0;row<8;row++){
    if(row%2===0){
      for(let col=0;col<8;col++)route.push(row*8+col);
    }else{
      const connectorCol=(row===1||row===5)?7:0;
      route.push(row*8+connectorCol);
      if(row<7){
        for(let col=(connectorCol===7?6:1);connectorCol===7?col>=0:col<8;col+=(connectorCol===7?-1:1)){
          route.push(row*8+col);
        }
      }
    }
  }
  // The corridor runs across four alternating rows; connector rows stay narrow.
  const corridor=[];
  for(let row=0;row<8;row+=2){
    if(row===0){for(let col=0;col<8;col++)corridor.push(row*8+col)}
    else{
      const previousEnd=corridor[corridor.length-1]%8;
      corridor.push((row-1)*8+previousEnd);
      if(row%4===2){for(let col=7;col>=0;col--)corridor.push(row*8+col)}
      else{for(let col=0;col<8;col++)corridor.push(row*8+col)}
    }
  }
  // Keep the route inside the 8x8 board and make every turn reachable in order.
  const path=[];
  for(let row=0;row<8;row+=2){
    const leftToRight=(row/2)%2===0;
    const cols=leftToRight?[0,1,2,3,4,5,6,7]:[7,6,5,4,3,2,1,0];
    cols.forEach(col=>path.push(row*8+col));
    if(row<6){
      const edge=leftToRight?7:0;
      path.push((row+1)*8+edge);
    }
  }
  path.forEach(index=>cells[index]='path');
  cells[path[0]]='start';
  cells[path[path.length-1]]='finish';
  const layouts={
    wild:{treasure:[4,12,21],trap:[8,25],event:[16,28]},
    city:{treasure:[6,18],trap:[11,24],event:[3,15,27]},
    secret:{treasure:[9,22],trap:[5,19],event:[13,25,29]},
    island:{treasure:[3,10,17,26],trap:[8,21],event:[14,24]},
    neon:{treasure:[7,20],trap:[12,23],event:[4,16,28]},
    cosmos:{treasure:[5,14,27],trap:[10,22],event:[3,18,25]}
  };
  const layout=layouts[game.id]||layouts.wild;
  Object.entries(layout).forEach(([type,positions])=>positions.forEach(position=>{
    if(position>0&&position<path.length-1)cells[path[position]]=type;
  }));
  return {id:'builtin-'+game.id,name:game.name,genre:game.genre,description:game.description,rules:'Бросай кубик по очереди. ✦ Сокровище: +3 монеты. ! Ловушка: отступи на 2 клетки. ? Событие: случайная удача или потеря шага.',cells,kind:'builtin'};
}
function openGame(id){
  const game=games.find(item=>item.id===id);
  if(!game)return;
  const params=new URLSearchParams(window.location.search);
  if(params.get('play')===id) {
    openCustomGame(buildPresetMap(game));
    return;
  }
  const url=new URL(window.location.href);
  url.search='';
  url.searchParams.set('play',id);
  window.open(url.toString(),'_blank','noopener');
}
function setGameScene(map){
  const source=String([map?.id,map?.genre,map?.name].filter(Boolean).join(' ')).toLowerCase();
  const scene=/cosmos|космос|галактик|звезд/.test(source)?'cosmos':
    /neon|киберпанк|неонов/.test(source)?'neon':
    /city|город|стратег/.test(source)?'city':
    /secret|мистик|тайн/.test(source)?'mystery':
    /island|остров|сокровищ/.test(source)?'island':'wild';
  document.documentElement.dataset.gameScene=scene;
  const sceneProps={
    wild:['🌲','🪨','🌿','💎'],
    island:['🌴','🐚','🦜','💰'],
    city:['🏙️','🏛️','🪙','🏮'],
    mystery:['🗿','🕯️','🕸️','🔮'],
    neon:['🌆','💠','🦾','⚡'],
    cosmos:['🪐','🌌','☄️','✨']
  };
  document.querySelectorAll('.game-world-props span').forEach((prop,index)=>{
    prop.textContent=(sceneProps[scene]||sceneProps.wild)[index];
  });
}
function openCustomGame(map){
  document.documentElement.classList.add('game-mode');
  setGameScene(map);
  onlineGameContext = null;
  const setup = $('.game-setup'); if(setup) setup.hidden = false;
  $('#playerNameFields').hidden = false;
  activePlayMap = map;
  gameState = null;
  $('#dialogTitle').textContent = map.name;
  $('#dialogDescription').textContent = (map.description || 'Авторское приключение') + (map.rules ? ' Правила: ' + map.rules : '');
  $('#demoBoard').hidden = true;
  $('#customGamePanel').hidden = false;
  $('#dialogRoll').hidden = true;
  $('#dialogRollResult').textContent = 'Сначала начни партию.';
  $('#playerCount').value = '2';
  renderPlayerNameFields();
  $('#playRollBtn').disabled = true;
  $('#playBoard').replaceChildren();
  $('#turnStatus').textContent = 'Выбери число игроков и нажми «Начать партию».';
  $('#gameLog').replaceChildren();
  const saved=getSavedSession();
  const resumeButton=$('#resumeGameBtn');
  if(resumeButton)resumeButton.hidden=!(saved&&saved.map&&saved.map.id===map.id&&!saved.state?.finished);
  renderGameStats();
  $('#gameDialog').showModal();
}
function playableCells(map){
  const cells = normalizeBoard(map);
  const start = cells.indexOf('start');
  const finish = cells.indexOf('finish');
  if(start < 0 || finish < 0) return null;

  const queue = [start];
  const previous = new Map([[start, null]]);
  while(queue.length){
    const current = queue.shift();
    if(current === finish) break;
    const row = Math.floor(current / 8);
    const col = current % 8;
    const neighbors = [];
    if(row > 0) neighbors.push(current - 8);
    if(col < 7) neighbors.push(current + 1);
    if(row < 7) neighbors.push(current + 8);
    if(col > 0) neighbors.push(current - 1);
    neighbors.forEach(next => {
      if(cells[next] !== 'empty' && !previous.has(next)){
        previous.set(next, current);
        queue.push(next);
      }
    });
  }
  if(!previous.has(finish)) return null;

  const indices = [];
  for(let current = finish; current !== null; current = previous.get(current)) indices.push(current);
  indices.reverse();
  return indices.map(index => ({type:cells[index], index}));
}
function renderPlayerLocations(){
  const bar=$('#playerLocationBar');
  if(!bar||!gameState)return;
  bar.replaceChildren();
  gameState.players.forEach((player,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='player-location'+(index===gameState.turn?' is-current':'')+(index===gameState.winner?' is-winner':'');
    button.style.setProperty('--token-color',playerColors[index]);
    button.dataset.playerIndex=String(index);
    button.setAttribute('aria-label','Показать '+player.name+', шаг '+(player.position+1));
    const marker=document.createElement('span');marker.className='player-location-marker';marker.textContent=String(index+1);
    const info=document.createElement('span');info.className='player-location-info';
    const name=document.createElement('strong');name.textContent=player.name;
    const position=document.createElement('small');position.textContent=(player.position===gameState.route.length-1?'Финиш':'Шаг '+(player.position+1)+' из '+gameState.route.length)+' · '+player.coins+' монет';
    info.append(name,position);button.append(marker,info);
    const progress=document.createElement('span');progress.className='player-location-progress';
    progress.style.width=(Math.max(0,Math.min(100,((player.position+1)/gameState.route.length)*100)))+'%';
    button.append(progress);bar.append(button);
  });
}
function renderPlayBoard(){
  const route=gameState.route;
  const board=$('#playBoard');
  const miniatures=['♟','♞','♜','♛'];
  board.dataset.layout='road';
  board.replaceChildren();
  const scene=document.documentElement.dataset.gameScene||'wild';
  const symbols={
    wild:{start:'🏕️',finish:'🏰',treasure:'💎',trap:'🪤',event:'🔮',path:'·'},
    island:{start:'⛵',finish:'🏴‍☠️',treasure:'💰',trap:'🦀',event:'🐚',path:'·'},
    city:{start:'🚉',finish:'🏛️',treasure:'🪙',trap:'🚧',event:'🏮',path:'·'},
    mystery:{start:'🕯️',finish:'🗝️',treasure:'🔮',trap:'🕸️',event:'👁️',path:'·'},
    neon:{start:'🚀',finish:'🌆',treasure:'💠',trap:'⚡',event:'🦾',path:'·'},
    cosmos:{start:'🛰️',finish:'🪐',treasure:'🌟',trap:'☄️',event:'🌀',path:'·'}
  };
  const sceneSet=symbols[scene]||symbols.wild;
  route.forEach((cell,routeIndex)=>{
    const type=cell.type||'path';
    const isCurrent=gameState.players[gameState.turn]?.position===routeIndex;
    const tile=document.createElement('article');
    tile.className='play-cell road-cell tile-'+type+(isCurrent?' current-player-cell':'')+(routeIndex===gameState.route.length-1?' road-finish':'');
    tile.dataset.step=String(routeIndex+1);
    tile.title=(tileInfo[type]?.label||'Путь')+' · Шаг '+(routeIndex+1);
    const step=document.createElement('span');step.className='route-step';step.textContent=String(routeIndex+1).padStart(2,'0');tile.append(step);
    const label=document.createElement('span');label.className='play-cell-symbol';label.textContent=sceneSet[type]||'·';tile.append(label);
    const name=document.createElement('span');name.className='road-cell-name';
    name.textContent=routeIndex===0?'СТАРТ':routeIndex===route.length-1?'ФИНИШ':(tileInfo[type]?.label||'Дорога').toLocaleUpperCase('ru-RU');
    tile.append(name);
    const tokens=document.createElement('div');tokens.className='play-tokens';
    gameState.players.forEach((player,playerIndex)=>{
      if(player.position===routeIndex){
        const token=document.createElement('span');
        token.className='player-token player-token-'+playerIndex;
        token.style.setProperty('--token-color',playerColors[playerIndex]);
        token.textContent=miniatures[playerIndex];
        token.setAttribute('aria-label',player.name);
        token.title=player.name+' · шаг '+(routeIndex+1);
        tokens.append(token);
      }
    });
    tile.append(tokens);
    board.append(tile);
  });
  renderPlayerLocations();
  requestAnimationFrame(()=>{
    const position=gameState.players[gameState.turn]?.position||0;
    const active=board.querySelector('[data-step="'+(position+1)+'"]');
    if(active)active.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
  });
}
function getSavedSession(){
  const saved=readStorage('nastolka-active-session',null);
  if(!saved||!saved.map||!saved.state||!Array.isArray(saved.state.players)||!Array.isArray(saved.state.route))return null;
  return saved;
}
function persistGameSession(){
  if(!gameState||gameState.finished||!activePlayMap){
    try{localStorage.removeItem('nastolka-active-session')}catch{}
    return;
  }
  const payload={map:{id:activePlayMap.id,name:activePlayMap.name,genre:activePlayMap.genre||'',description:activePlayMap.description||'',rules:activePlayMap.rules||'',cells:normalizeBoard(activePlayMap),kind:activePlayMap.kind||'custom'},state:gameState,savedAt:new Date().toISOString()};
  try{localStorage.setItem('nastolka-active-session',JSON.stringify(payload))}catch{toast('Не удалось сохранить партию. Освободи место в браузере.')}
}
function resumeCustomGame(){
  const saved=getSavedSession();
  if(!saved||saved.map.id!==activePlayMap?.id){toast('Сохранённая партия для этой карты не найдена.');return}
  const route=playableCells(saved.map);
  if(!route){toast('Карта изменилась и маршрут больше не соединён.');return}
  const state=saved.state;
  if(!Array.isArray(state.players)||state.players.length<2||state.players.length>4||!Number.isInteger(state.turn)||state.turn<0||state.turn>=state.players.length){toast('Сохранённая партия повреждена. Начни новую.');return}
  state.route=route;
  state.players=state.players.map(player=>({name:String(player.name||'Игрок').slice(0,18),position:Math.max(0,Math.min(route.length-1,Number(player.position)||0)),coins:Math.max(0,Number(player.coins)||0),skip:Boolean(player.skip)}));
  state.turns=Math.max(0,Number(state.turns)||0);
  state.log=Array.isArray(state.log)?state.log.filter(line=>typeof line==='string').slice(0,5):[];
  state.finished=false;state.recorded=false;
  activePlayMap=saved.map;
  gameState=state;
  $('#playerCount').value=String(state.players.length);
  renderPlayerNameFields();
  $('#playRollBtn').disabled=false;
  $('#gameLog').replaceChildren();
  state.log.forEach(line=>{const p=document.createElement('p');p.textContent=line;$('#gameLog').append(p)});
  updateGameStatus();renderPlayBoard();
  $('#resumeGameBtn').hidden=true;
  toast('Партия восстановлена!');
}
function startCustomGame(){
  if(!activePlayMap) return;
  const route = playableCells(activePlayMap);
  if(!route){
    gameState = null;
    $('#playRollBtn').disabled = true;
    $('#turnStatus').textContent = 'Маршрут не соединён. В редакторе соедини Старт и Финиш клетками пути без пустых разрывов.';
    $('#playBoard').replaceChildren();
    toast('Не найден непрерывный путь от старта до финиша.');
    return;
  }
  const count=Number($('#playerCount').value)||2;
  const names=$$('#playerNameFields input').slice(0,count).map((input,index)=>input.value.trim().slice(0,18)||playerNames[index]);
  const normalized=names.map(name=>name.toLocaleLowerCase('ru-RU'));
  if(new Set(normalized).size!==normalized.length){toast('У каждого игрока должно быть своё имя.');return}
  try{localStorage.setItem('nastolka-player-names',JSON.stringify(names.concat(playerNames.slice(count))))}catch{toast('Имена не удалось сохранить, но партия может начаться.')}
  gameState={route,players:Array.from({length:count},(_,i)=>({name:names[i],position:0,coins:0,skip:false})),turn:0,finished:false,recorded:false,turns:0,log:[]};
  $('#resumeGameBtn').hidden=true;
  $('#playRollBtn').disabled=false;
  $('#gameLog').replaceChildren();
  addGameLog('Партия началась! Все игроки на старте. Маршрут: '+route.length+' клеток.');
  updateGameStatus();
  renderPlayBoard();
  persistGameSession();
}
function addGameLog(message){
  if(!gameState) return;
  gameState.log.unshift(message);
  gameState.log=gameState.log.slice(0,5);
  $('#gameLog').replaceChildren();
  gameState.log.forEach(line=>{const p=document.createElement('p');p.textContent=line;$('#gameLog').append(p)});
}
function updateGameStatus(){
  if(!gameState) return;
  const player=gameState.players[gameState.turn];
  $('#turnStatus').textContent=gameState.finished?'🏆 '+player.name+' победил!':player.name+' — твой ход · шаг '+(player.position+1)+' из '+gameState.route.length+' · монеты: '+player.coins;
  renderPlayerLocations();
}
function renderFinalResults(){
  if(!gameState||!gameState.finished)return;
  const log=$('#gameLog');
  log.replaceChildren();
  const heading=document.createElement('p');
  heading.className='game-result-heading';
  heading.textContent='🏆 Итоги партии';
  log.append(heading);
  const ranked=gameState.players.map((player,index)=>({...player,index})).sort((a,b)=>{
    if(a.index===gameState.winner)return -1;
    if(b.index===gameState.winner)return 1;
    return b.coins-a.coins||a.index-b.index;
  });
  ranked.forEach((player,position)=>{
    const row=document.createElement('p');
    row.className='game-result-row'+(player.index===gameState.winner?' is-winner':'');
    row.textContent=(position+1)+'. '+player.name+' — '+player.coins+' монет'+(player.index===gameState.winner?' · победитель':'');
    log.append(row);
  });
  gameState.log=ranked.map((player,position)=>(position+1)+'. '+player.name+' — '+player.coins+' монет'+(player.index===gameState.winner?' · победитель':'' )).slice(0,5);
}
function nextPlayer(){
  if(!gameState || gameState.finished) return;
  for(let i=0;i<gameState.players.length;i++){
    gameState.turn=(gameState.turn+1)%gameState.players.length;
    if(!gameState.players[gameState.turn].skip) break;
    gameState.players[gameState.turn].skip=false;
    addGameLog(gameState.players[gameState.turn].name+' пропускает ход из-за ловушки.');
  }
  updateGameStatus();
}
async function takeGameTurn(){
  const boardEl=$('#playBoard');
  if(boardEl){
    boardEl.classList.remove('dice-rolling');
    void boardEl.offsetWidth;
    boardEl.classList.add('dice-rolling');
    window.setTimeout(()=>boardEl.classList.remove('dice-rolling'),720);
  }
  if(!onlineGameContext) { performGameTurn(); return; }
  if(!gameState || gameState.finished) return;
  if(onlineGameContext.playerIds[gameState.turn] !== onlineGameContext.playerId) {
    toast('Сейчас ход другого игрока.');
    return;
  }
  const previousState = JSON.parse(JSON.stringify(gameState));
  const expectedVersion = onlineGameContext.version;
  $('#playRollBtn').disabled = true;
  performGameTurn();
  const nextState = JSON.parse(JSON.stringify(gameState));
  nextState.online_player_ids = onlineGameContext.playerIds;
  try {
    const result = await onlineGameContext.submitTurn(expectedVersion, nextState);
    onlineGameContext.version = Number(result.version) || expectedVersion + 1;
    gameState.version = onlineGameContext.version;
    $('#playRollBtn').disabled = gameState.finished || onlineGameContext.playerIds[gameState.turn] !== onlineGameContext.playerId;
    if(typeof onlineGameContext.refresh === 'function') onlineGameContext.refresh();
  } catch(error) {
    gameState = previousState;
    renderPlayBoard(); updateGameStatus();
    $('#gameLog').replaceChildren();
    gameState.log.forEach(line=>{const p=document.createElement('p');p.textContent=line;$('#gameLog').append(p)});
    $('#playRollBtn').disabled = onlineGameContext.playerIds[gameState.turn] !== onlineGameContext.playerId;
    toast(error && error.message ? error.message : 'Ход не синхронизирован. Обновляю состояние.');
    if(typeof onlineGameContext.refresh === 'function') onlineGameContext.refresh();
  }
}
function performGameTurn(){
  if(!gameState || gameState.finished) return;
  const player=gameState.players[gameState.turn];
  if(player.skip){player.skip=false;addGameLog(player.name+' пропускает ход.');nextPlayer();return}
  const roll=Math.floor(Math.random()*6)+1;
  gameState.turns++;
  const from=player.position;
  player.position=Math.min(gameState.route.length-1,player.position+roll);
  const cell=gameState.route[player.position];
  let event='выпало '+roll+', переход на клетку '+(player.position+1)+'.';
  if(cell.type==='treasure'){player.coins+=3;event+=' Сокровище: +3 монеты!'}
  else if(cell.type==='trap'){player.position=Math.max(0,player.position-2);event+=' Ловушка! Отступаешь на 2 клетки.'}
  else if(cell.type==='event'){
    const outcome=Math.floor(Math.random()*3);
    if(outcome===0){player.coins+=2;event+=' Удача: +2 монеты.'}
    else if(outcome===1){player.position=Math.max(0,player.position-1);event+=' Неожиданность: шаг назад.'}
    else {player.coins+=1;event+=' Находка: +1 монета.'}
  }
  addGameLog(player.name+': '+event);
  if(cell.type==='finish' || player.position>=gameState.route.length-1){
    player.position=gameState.route.length-1;
    gameState.finished=true;
    gameState.winner=gameState.turn;
    if(!gameState.recorded){
      gameState.recorded=true;
      const totalCoins=gameState.players.reduce((sum,item)=>sum+item.coins,0);
      const history=getGameHistory();
      history.unshift({date:new Date().toISOString(),mapName:activePlayMap.name||'Авторская карта',playerCount:gameState.players.length,winner:player.name,winnerCoins:player.coins,totalCoins,turns:gameState.turns,players:gameState.players.map((item,index)=>({name:item.name,coins:item.coins,winner:index===gameState.winner}))});
      saveGameHistory(history);
      renderGameStats();
      toast('Результат сохранён в истории партий!');
    }
    $('#playRollBtn').disabled=true;
    updateGameStatus();
    renderPlayBoard();
    renderFinalResults();
    persistGameSession();
    const resumeButton=$('#resumeGameBtn');if(resumeButton)resumeButton.hidden=true;
    return;
  }
  renderPlayBoard();
  nextPlayer();
  persistGameSession();
}


window.NASTOLKA_GAME = {
  createInitialState(map, players) {
    const route = playableCells(map);
    if(!route) throw new Error('На выбранной карте нет непрерывного маршрута от старта до финиша.');
    return {
      route,
      players: players.map(player=>({name:String(player.player_name||'Игрок').slice(0,18),position:0,coins:0,skip:false})),
      turn:0,finished:false,recorded:false,turns:0,
      log:['Партия началась! Все игроки на старте. Маршрут: '+route.length+' клеток.']
    };
  },
  showOnline(map, state, context) {
    setGameScene(map);
    document.documentElement.classList.add('game-mode');
    const popout=$('#gameWorldPopout');
    if(popout){
      popout.hidden=false;
      popout.onclick=()=>{
        const url=new URL(window.location.href);
        url.search='';
        url.searchParams.set('onlineRoom',context.roomId);
        window.open(url.toString(),'_blank','noopener');
      };
    }
    const sameRoom = onlineGameContext && onlineGameContext.roomId === context.roomId;
    const incomingVersion = Number(state.version) || Number(context.version) || 1;
    // Ignore duplicate or out-of-order realtime/poll responses; never roll a client back.
    if(sameRoom && incomingVersion <= Number(onlineGameContext.version || 0)) return;
    if(!sameRoom) openCustomGame(map);
    activePlayMap = map;
    gameState = {...state,route:playableCells(map),online_player_ids:context.playerIds,version:incomingVersion};
    onlineGameContext = {...context,version:gameState.version};
    const setup=$('.game-setup'); if(setup) setup.hidden=true;
    $('#playerNameFields').hidden=true;
    $('#resumeGameBtn').hidden=true;
    $('#dialogTitle').textContent=map.name||'Онлайн-партия';
    $('#dialogDescription').textContent=(map.description||'Общая онлайн-партия')+(map.rules?' Правила: '+map.rules:'');
    $('#playRollBtn').hidden=false;
    $('#playRollBtn').disabled=gameState.finished||onlineGameContext.playerIds[gameState.turn]!==onlineGameContext.playerId;
    $('#dialogRoll').hidden=true;
    $('#dialogRollResult').textContent='Общая онлайн-партия';
    $('#gameLog').replaceChildren();
    (gameState.log||[]).forEach(line=>{const p=document.createElement('p');p.textContent=line;$('#gameLog').append(p)});
    updateGameStatus();renderPlayBoard();
    if(gameState.finished) renderFinalResults();
    if(!$('#gameDialog').open) $('#gameDialog').showModal();
  },
  closeOnline() { onlineGameContext=null; },
  isOnline() { return Boolean(onlineGameContext); }
};

// Open requested game in the newly opened tab; saved custom maps are shared through localStorage.
(function openRequestedGame(){
  const params=new URLSearchParams(window.location.search);
  const presetId=params.get('play');
  const customMapId=params.get('customMap');
  if(presetId){
    const game=games.find(item=>item.id===presetId);
    if(game)openCustomGame(buildPresetMap(game));
  }else if(customMapId){
    const map=getSavedMaps().find(item=>item.id===customMapId);
    if(map)openCustomGame(map);
    else toast('Эта карта не найдена в сохранённых картах браузера.');
  }
})();

$$('.filter-chip').forEach(btn => btn.addEventListener('click', () => {
  $$('.filter-chip').forEach(b => b.classList.toggle('selected', b === btn));
  let shown = 0;
  $$('.game-card').forEach(card => {
    const visible = btn.dataset.filter === 'all' || card.dataset.category === btn.dataset.filter;
    card.hidden = !visible;
    if(visible) shown++;
  });
  $('#emptyState').hidden = shown > 0;
}));
$$('.save-button').forEach(btn => btn.addEventListener('click', () => {
  const ids = getSavedGames();
  const id = btn.dataset.save;
  const index = ids.indexOf(id);
  if(index >= 0){ids.splice(index,1);toast('Игра удалена из избранного')}
  else {ids.push(id);toast('Игра добавлена в избранное')}
  setSavedGames(ids);
  updateSavedUI();
}));
$$('[data-play]').forEach(btn => btn.addEventListener('click', () => openGame(btn.dataset.play)));
$('#rollDice').addEventListener('click', () => {
  const result = rollDice($('#diceResult'));
  $('#diceResult').textContent = 'Выпало ' + result + '! ' + rollMessages[result-1];
});
$('#rollHeroDie').addEventListener('click', () => {
  const value = rollDice(null);
  toast('Твой бросок: ' + value + '! ' + rollMessages[value-1]);
});
$('#dialogRoll').addEventListener('click', () => rollDice($('#dialogRollResult')));
$('#startGameBtn').addEventListener('click', startCustomGame);
$('#resumeGameBtn').addEventListener('click',resumeCustomGame);
$('#playerCount').addEventListener('change',renderPlayerNameFields);
$('#playRollBtn').addEventListener('click', takeGameTurn);
$('#restartGameBtn').addEventListener('click', startCustomGame);
$$('.dialog-close').forEach(btn => btn.addEventListener('click', () => btn.closest('dialog').close()));
const mapHistoryToggle=$('#mapHistoryToggle');
if(mapHistoryToggle)mapHistoryToggle.addEventListener('click',()=>{const open=document.documentElement.classList.toggle('map-history-open');mapHistoryToggle.setAttribute('aria-pressed',String(open));mapHistoryToggle.setAttribute('aria-label',open?'Закрыть историю игры':'Открыть историю игры');});
const playerLocationBar=$('#playerLocationBar');
if(playerLocationBar)playerLocationBar.addEventListener('click',event=>{const button=event.target.closest('[data-player-index]');if(!button||!gameState)return;const player=gameState.players[Number(button.dataset.playerIndex)];const cell=$('#playBoard [data-step="'+(player.position+1)+'"]');if(cell)cell.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});});
const gameDialog=$('#gameDialog');
if(gameDialog)gameDialog.addEventListener('close',()=>{document.documentElement.classList.remove('game-mode','map-history-open');if(mapHistoryToggle){mapHistoryToggle.setAttribute('aria-pressed','false');mapHistoryToggle.setAttribute('aria-label','Открыть историю игры');}});
$('#createMapBtn').addEventListener('click', () => $('#createDialog').showModal());
$$('.tile-tool').forEach(button => button.addEventListener('click', () => {
  selectedTile = button.dataset.tile;
  $$('.tile-tool').forEach(tool => tool.classList.toggle('selected', tool === button));
}));
$('#clearBoardBtn').addEventListener('click', () => {
  const maps = getSavedMaps();
  const map = maps.find(item => item.id === activeMapId);
  if(!map) return;
  map.cells = Array.from({length:64}, () => 'empty');
  setSavedMaps(maps);
  renderEditorBoard(map.cells);
  toast('Поле очищено');
});
$('#saveBoardBtn').addEventListener('click', () => {
  const maps = getSavedMaps();
  const map = maps.find(item => item.id === activeMapId);
  if(!map) {toast('Не удалось найти карту для сохранения');return}
  map.cells = normalizeBoard(map);
  map.rules = $('#mapRules').value.trim();
  map.updatedAt = new Date().toISOString();
  setSavedMaps(maps);
  updateSavedUI();
  $('#editorDialog').close();
  toast('Игровое поле сохранено!');
});

$('#myMapsBtn').addEventListener('click', () => openMyMaps());
function openMyMaps(){
  searchMode = 'maps';
  $('#searchInput').value = '';
  $('#searchDialog').querySelector('.eyebrow').textContent = 'ТВОЯ ЛИЧНАЯ БИБЛИОТЕКА';
  $('#searchDialog').querySelector('h2').textContent = 'МОИ КАРТЫ';
  $('#searchInput').placeholder = 'Найти свою карту...';
  $('#mapBackupTools').hidden = false;
  renderSearchResults(getSavedMaps(), true);
  $('#searchDialog').showModal();
}
function exportMaps(){
  const maps=getSavedMaps();
  if(!maps.length){toast('Пока нечего экспортировать — сначала создай карту.');return}
  const backup={format:'nastolka-maps',version:1,exportedAt:new Date().toISOString(),maps};
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download='nastolka-maps-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast('Экспортировано карт: '+maps.length);
}
function importMapsFile(file){
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(String(reader.result||''));
      const imported=Array.isArray(parsed)?parsed:(parsed && parsed.format==='nastolka-maps' && Array.isArray(parsed.maps)?parsed.maps:null);
      if(!imported || !imported.length)throw new Error('В файле не найден список карт.');
      if(imported.length>200)throw new Error('В одном файле допускается не более 200 карт.');
      const allowedTiles=new Set(Object.keys(tileInfo));
      const clean=imported.map((map,index)=>{
        if(!map || typeof map!=='object' || typeof map.name!=='string' || !map.name.trim())throw new Error('Карта №'+(index+1)+' не содержит названия.');
        if(map.cells!==undefined && (!Array.isArray(map.cells)||map.cells.length!==64||map.cells.some(cell=>!allowedTiles.has(cell))))throw new Error('У карты «'+map.name+'» некорректное игровое поле.');
        return {
          id:(typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+'-'+index+'-'+Math.random().toString(16).slice(2),
          name:map.name.trim().slice(0,50),
          genre:typeof map.genre==='string'?map.genre.slice(0,40):'Другое',
          description:typeof map.description==='string'?map.description.slice(0,180):'',
          rules:typeof map.rules==='string'?map.rules.slice(0,1000):'',
          cells:Array.isArray(map.cells)?map.cells:[...blankBoard()],
          createdAt:typeof map.createdAt==='string'?map.createdAt:new Date().toISOString(),
          updatedAt:typeof map.updatedAt==='string'?map.updatedAt:undefined
        };
      });
      const existing=getSavedMaps();
      setSavedMaps([...clean,...existing]);
      updateSavedUI();
      $('#searchInput').value='';
      renderSearchResults(getSavedMaps(),true);
      toast('Импортировано карт: '+clean.length);
    }catch(error){
      toast('Не удалось импортировать: '+(error && error.message?error.message:'проверь JSON-файл.'));
    }finally{
      $('#importMapsFile').value='';
    }
  };
  reader.onerror=()=>{toast('Не удалось прочитать файл.');$('#importMapsFile').value=''};
  reader.readAsText(file);
}
$('#mapForm').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const name = String(data.get('mapName') || '').trim();
  if(!name){$('#mapName').focus();return}
  const maps = getSavedMaps();
  maps.unshift({
    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2),
    name,
    genre: String(data.get('mapGenre') || 'Другое'),
    description: String(data.get('mapDescription') || '').trim(),
    rules: '',
    cells: blankBoard(),
    createdAt: new Date().toISOString()
  });
  const newMap = maps[0];
  setSavedMaps(maps);
  updateSavedUI();
  event.currentTarget.reset();
  $('#createDialog').close();
  toast('Карта создана! Теперь построй игровое поле.');
  openEditor(newMap);
});
function renderSearchResults(items, isMaps = false){
  const container = $('#searchResults');
  container.replaceChildren();
  if(!items.length){
    const p = document.createElement('p');
    p.className = 'game-description';
    p.textContent = isMaps ? 'Пока нет карт. Создай свой первый мир!' : 'Ничего не найдено. Попробуй другое название.';
    container.append(p);
    return;
  }
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'search-result';
    const info = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = item.name;
    const meta = document.createElement('small');
    meta.textContent = item.genre || item.category || 'Авторская карта';
    info.append(name, document.createElement('br'), meta);
    row.append(info);
    if(!isMaps){
      const button = document.createElement('button');
      button.textContent = 'Открыть ↗';
      button.addEventListener('click', () => {$('#searchDialog').close();openGame(item.id)});
      row.append(button);
    } else {
      const actions = document.createElement('div');
      actions.className = 'map-row-actions';
      const label = document.createElement('small');
      label.textContent = 'МОЯ КАРТА';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Редактировать';
      edit.setAttribute('aria-label', 'Редактировать карту ' + item.name);
      edit.addEventListener('click', () => {
        $('#searchDialog').close();
        const current = getSavedMaps().find(map => map.id === item.id);
        if(current) openEditor(current);
      });
      const play = document.createElement('button');
      play.type = 'button';
      play.textContent = 'Играть';
      play.setAttribute('aria-label', 'Играть на карте ' + item.name);
      play.addEventListener('click', () => {
        $('#searchDialog').close();
        const current = getSavedMaps().find(map => map.id === item.id);
        if(current){const url=new URL(window.location.href);url.search='';url.searchParams.set('customMap',current.id);window.open(url.toString(),'_blank','noopener');}
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Удалить';
      remove.setAttribute('aria-label', 'Удалить карту ' + item.name);
      remove.addEventListener('click', () => {
        const maps = getSavedMaps();
        const index = maps.findIndex(map => map.id ? map.id === item.id : map.name === item.name && map.createdAt === item.createdAt);
        if(index < 0) return;
        maps.splice(index, 1);
        setSavedMaps(maps);
        updateSavedUI();
        const query = $('#searchInput').value.trim().toLocaleLowerCase('ru');
        renderSearchResults(getSavedMaps().filter(map => (map.name + ' ' + map.genre + ' ' + (map.description || '')).toLocaleLowerCase('ru').includes(query)), true);
        toast('Карта удалена');
      });
      actions.append(label, play, edit, remove);
      row.append(actions);
    }
    container.append(row);
  });
}
function openSearch(){
  searchMode = 'games';
  $('#mapBackupTools').hidden = true;
  $('#searchDialog').querySelector('.eyebrow').textContent = 'НАЙДИ СВОЙ МИР';
  $('#searchDialog').querySelector('h2').textContent = 'ПОИСК';
  $('#searchInput').placeholder = 'Название игры или жанр...';
  $('#searchInput').value = '';
  renderSearchResults(games);
  $('#searchDialog').showModal();
  setTimeout(() => $('#searchInput').focus(), 100);
}
$('.search-open').addEventListener('click', openSearch);
$('#searchInput').addEventListener('input', event => {
  const query = event.target.value.trim().toLocaleLowerCase('ru');
  if(searchMode === 'maps'){
    const matches = getSavedMaps().filter(map => (map.name + ' ' + map.genre + ' ' + (map.description || '')).toLocaleLowerCase('ru').includes(query));
    renderSearchResults(matches, true);
  } else {
    renderSearchResults(games.filter(game => (game.name + ' ' + game.genre + ' ' + game.description).toLocaleLowerCase('ru').includes(query)));
  }
});
$$('[data-product]').forEach(btn => btn.addEventListener('click', () => toast('Магазин готовится к запуску. ' + btn.dataset.product + ' появится позже.')));
$('#shopViewAll').addEventListener('click', event => {event.preventDefault();toast('Каталог товаров скоро откроется!')});
$('.mobile-menu').addEventListener('click', () => {
  const nav = $('.desktop-nav');
  const visible = nav.style.display === 'flex';
  nav.style.display = visible ? 'none' : 'flex';
  if(!visible) Object.assign(nav.style, {position:'absolute',top:'67px',left:'0',right:'0',padding:'22px 6%',background:'#151612',borderBottom:'1px solid #33342e',flexDirection:'column',gap:'20px',margin:'0'});
});
$$('.nav-link').forEach(link => link.addEventListener('click', () => $$('.nav-link').forEach(a => a.classList.toggle('active', a === link))));
$('#exportMapsBtn').addEventListener('click', exportMaps);
$('#importMapsFile').addEventListener('change', event => importMapsFile(event.currentTarget.files && event.currentTarget.files[0]));
$('#searchDialog').addEventListener('close', () => {
  searchMode = 'games';
  $('#mapBackupTools').hidden = true;
  $('#searchDialog').querySelector('.eyebrow').textContent = 'НАЙДИ СВОЙ МИР';
  $('#searchDialog').querySelector('h2').textContent = 'ПОИСК';
  $('#searchInput').placeholder = 'Название игры или жанр...';
});
updateSavedUI();
