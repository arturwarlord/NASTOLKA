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
const playerColors = ['#d8ff3e','#7ec8ff','#ff9b82','#c4a7ff'];
const playerNames = ['Игрок 1','Игрок 2','Игрок 3','Игрок 4'];
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
  $('.tile-tool').forEach(button => button.classList.toggle('selected', button.dataset.tile === selectedTile));
  $('#editorTitle').textContent = map.name.toLocaleUpperCase('ru');
  $('#mapRules').value = map.rules || '';
  map.cells = normalizeBoard(map);
  renderEditorBoard(map.cells);
  $('#editorDialog').showModal();
}
function renderEditorBoard(cells){
  const board = $('#editorBoard');
  board.replaceChildren();
  cells.forEach((type, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'editor-cell tile-' + (tileInfo[type] ? type : 'path');
    button.textContent = tileInfo[type] ? tileInfo[type].symbol : '·';
    button.setAttribute('aria-label', 'Клетка ' + (index + 1) + ': ' + (tileInfo[type] ? tileInfo[type].label : 'Путь'));
    button.title = 'Клетка ' + (index + 1) + ' — ' + (tileInfo[type] ? tileInfo[type].label : 'Путь');
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
function openGame(id){
  const game = games.find(g => g.id === id);
  if(!game) return;
  activePlayMap = null;
  gameState = null;
  $('#dialogTitle').textContent = game.name;
  $('#dialogDescription').textContent = game.description + ' Жанр: ' + game.genre + '. Это демонстрационный бросок кубика.';
  $('#dialogRollResult').textContent = 'Готов к игре?';
  $('#demoBoard').hidden = false;
  $('#customGamePanel').hidden = true;
  $('#dialogRoll').hidden = false;
  $('#gameDialog').showModal();
}
function openCustomGame(map){
  activePlayMap = map;
  gameState = null;
  $('#dialogTitle').textContent = map.name;
  $('#dialogDescription').textContent = (map.description || 'Авторское приключение') + (map.rules ? ' Правила: ' + map.rules : '');
  $('#demoBoard').hidden = true;
  $('#customGamePanel').hidden = false;
  $('#dialogRoll').hidden = true;
  $('#dialogRollResult').textContent = 'Сначала начни партию.';
  $('#playerCount').value = '2';
  $('#playRollBtn').disabled = true;
  $('#playBoard').replaceChildren();
  $('#turnStatus').textContent = 'Выбери число игроков и нажми «Начать партию».';
  $('#gameLog').replaceChildren();
  $('#gameDialog').showModal();
}
function playableCells(map){
  const cells = normalizeBoard(map);
  let route = cells.map((type,index)=>({type,index})).filter(cell=>cell.type!=='empty');
  if(!route.some(cell=>cell.type==='start')) route.unshift({type:'start',index:-1});
  if(!route.some(cell=>cell.type==='finish')) route.push({type:'finish',index:64});
  const start = route.findIndex(cell=>cell.type==='start');
  const finish = route.findIndex(cell=>cell.type==='finish');
  if(finish <= start) route.push({type:'finish',index:65});
  return route.slice(start);
}
function renderPlayBoard(){
  const route = gameState.route;
  const board = $('#playBoard');
  board.replaceChildren();
  route.forEach((cell,index)=>{
    const tile = document.createElement('div');
    tile.className = 'play-cell tile-' + cell.type;
    tile.title = 'Клетка ' + (cell.index >= 0 ? cell.index+1 : 'дополнительная') + ': ' + (tileInfo[cell.type]?.label || 'Путь');
    const label = document.createElement('span');
    label.className = 'play-cell-symbol';
    label.textContent = tileInfo[cell.type]?.symbol || '·';
    tile.append(label);
    const tokens = document.createElement('div');
    tokens.className = 'play-tokens';
    gameState.players.forEach((player,playerIndex)=>{
      if(player.position===index){
        const token=document.createElement('span');
        token.className='player-token';
        token.style.background=playerColors[playerIndex];
        token.textContent=String(playerIndex+1);
        token.title=player.name;
        tokens.append(token);
      }
    });
    tile.append(tokens);
    if(index===0){const tag=document.createElement('small');tag.textContent='СТАРТ';tile.append(tag)}
    if(cell.type==='finish'){const tag=document.createElement('small');tag.textContent='ФИНИШ';tile.append(tag)}
    board.append(tile);
  });
}
function startCustomGame(){
  if(!activePlayMap) return;
  const count=Number($('#playerCount').value)||2;
  gameState={route:playableCells(activePlayMap),players:Array.from({length:count},(_,i)=>({name:playerNames[i],position:0,coins:0,skip:false})),turn:0,finished:false,log:[]};
  $('#playRollBtn').disabled=false;
  $('#gameLog').replaceChildren();
  addGameLog('Партия началась! Все игроки на старте.');
  updateGameStatus();
  renderPlayBoard();
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
  $('#turnStatus').textContent=gameState.finished?'🏆 '+player.name+' победил!':player.name+' — твой ход · монеты: '+player.coins;
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
function takeGameTurn(){
  if(!gameState || gameState.finished) return;
  const player=gameState.players[gameState.turn];
  if(player.skip){player.skip=false;addGameLog(player.name+' пропускает ход.');nextPlayer();return}
  const roll=Math.floor(Math.random()*6)+1;
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
    $('#playRollBtn').disabled=true;
    updateGameStatus();
    renderPlayBoard();
    addGameLog('Партия завершена. Поздравляем победителя!');
    return;
  }
  renderPlayBoard();
  nextPlayer();
}

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
$('#playRollBtn').addEventListener('click', takeGameTurn);
$('#restartGameBtn').addEventListener('click', startCustomGame);
$$('.dialog-close').forEach(btn => btn.addEventListener('click', () => btn.closest('dialog').close()));
$('#createMapBtn').addEventListener('click', () => $('#createDialog').showModal());
$('.tile-tool').forEach(button => button.addEventListener('click', () => {
  selectedTile = button.dataset.tile;
  $('.tile-tool').forEach(tool => tool.classList.toggle('selected', tool === button));
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
  renderSearchResults(getSavedMaps(), true);
  $('#searchDialog').showModal();
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
        if(current) openCustomGame(current);
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
$('#searchDialog').addEventListener('close', () => {
  searchMode = 'games';
  $('#searchDialog').querySelector('.eyebrow').textContent = 'НАЙДИ СВОЙ МИР';
  $('#searchDialog').querySelector('h2').textContent = 'ПОИСК';
  $('#searchInput').placeholder = 'Название игры или жанр...';
});
updateSavedUI();
