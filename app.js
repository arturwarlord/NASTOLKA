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
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600)}
function getSavedMaps(){try{return JSON.parse(localStorage.getItem('nastolka-maps')||'[]')}catch{return []}}
function setSavedMaps(maps){try{localStorage.setItem('nastolka-maps',JSON.stringify(maps))}catch{}}
function getSavedGames(){try{return JSON.parse(localStorage.getItem('nastolka-saved-games')||'[]')}catch{return []}}
function setSavedGames(ids){try{localStorage.setItem('nastolka-saved-games',JSON.stringify(ids))}catch{}}
function updateSavedUI(){const maps=getSavedMaps();const count=$('.tiny-count');if(count)count.textContent=maps.length;$$('.save-button').forEach(btn=>{const saved=getSavedGames().includes(btn.dataset.save);btn.classList.toggle('saved',saved);btn.textContent=saved?'✓':'＋';btn.setAttribute('aria-pressed',String(saved))})}
function rollDice(target){const value=Math.floor(Math.random()*6)+1;const faces=['⚀','⚁','⚂','⚃','⚄','⚅'];if(target)target.textContent=faces[value-1]+'  Выпало '+value+'!';return value}
function openGame(id){const game=games.find(g=>g.id===id);if(!game)return;$('#dialogTitle').textContent=game.name;$('#dialogDescription').textContent=game.description+' Жанр: '+game.genre+'. Это демонстрационный режим — полноценная игровая сессия появится в следующих версиях.';$('#dialogRollResult').textContent='Готов к игре?';$('#gameDialog').showModal()}
$$('.filter-chip').forEach(btn=>btn.addEventListener('click',()=>{ $$('.filter-chip').forEach(b=>b.classList.toggle('selected',b===btn));let shown=0;$$('.game-card').forEach(card=>{const visible=btn.dataset.filter==='all'||card.dataset.category===btn.dataset.filter;card.hidden=!visible;if(visible)shown++});$('#emptyState').hidden=shown>0}));
$$('.save-button').forEach(btn=>btn.addEventListener('click',()=>{const ids=getSavedGames();const id=btn.dataset.save;const index=ids.indexOf(id);if(index>=0){ids.splice(index,1);toast('Игра удалена из избранного')}else{ids.push(id);toast('Игра добавлена в избранное')}setSavedGames(ids);updateSavedUI()}));
$$('[data-play]').forEach(btn=>btn.addEventListener('click',()=>openGame(btn.dataset.play)));
$('#rollDice').addEventListener('click',()=>{const result=rollDice($('#diceResult'));$('#diceResult').textContent='Выпало '+result+'! '+rollMessages[result-1]});
$('#rollHeroDie').addEventListener('click',()=>{const value=rollDice(null);toast('Твой бросок: '+value+'! '+rollMessages[value-1])});
$('#dialogRoll').addEventListener('click',()=>rollDice($('#dialogRollResult')));
$$('.dialog-close').forEach(btn=>btn.addEventListener('click',()=>btn.closest('dialog').close()));
$('#createMapBtn').addEventListener('click',()=>$('#createDialog').showModal());
$('#myMapsBtn').addEventListener('click',()=>{const maps=getSavedMaps();if(!maps.length){toast('Твои карты появятся здесь. Создай первую!');$('#createDialog').showModal();return}$('#searchDialog').showModal();$('#searchInput').value='';renderSearchResults(maps.map((m,i)=>({id:'map-'+i,name:m.name,genre:m.genre,description:m.description||'Твоя авторская карта'})),true)});
$('#mapForm').addEventListener('submit',event=>{event.preventDefault();const data=new FormData(event.currentTarget);const maps=getSavedMaps();maps.unshift({name:String(data.get('mapName')).trim(),genre:String(data.get('mapGenre')),description:String(data.get('mapDescription')||'').trim(),createdAt:new Date().toISOString()});setSavedMaps(maps);updateSavedUI();event.currentTarget.reset();$('#createDialog').close();toast('Карта сохранена в этом браузере!')});
function renderSearchResults(items,isMaps=false){const container=$('#searchResults');container.replaceChildren();if(!items.length){const p=document.createElement('p');p.className='game-description';p.textContent='Ничего не найдено. Попробуй другое название.';container.append(p);return}items.forEach(item=>{const row=document.createElement('div');row.className='search-result';const info=document.createElement('div');const name=document.createElement('strong');name.textContent=item.name;const meta=document.createElement('small');meta.textContent=item.genre||item.category;info.append(name,document.createElement('br'),meta);row.append(info);if(!isMaps){const button=document.createElement('button');button.textContent='Открыть ↗';button.addEventListener('click',()=>{$('#searchDialog').close();openGame(item.id)});row.append(button)}else{const label=document.createElement('small');label.textContent='СОХРАНЕНО';row.append(label)}container.append(row)})}
function openSearch(){ $('#searchInput').value='';renderSearchResults(games);$('#searchDialog').showModal();setTimeout(()=>$('#searchInput').focus(),100)}
$('.search-open').addEventListener('click',openSearch);
$('#searchInput').addEventListener('input',event=>{const query=event.target.value.trim().toLocaleLowerCase('ru');renderSearchResults(games.filter(g=>(g.name+' '+g.genre+' '+g.description).toLocaleLowerCase('ru').includes(query)))});
$$('[data-product]').forEach(btn=>btn.addEventListener('click',()=>toast('Магазин готовится к запуску. '+btn.dataset.product+' появится позже.')));
$('#shopViewAll').addEventListener('click',event=>{event.preventDefault();toast('Каталог товаров скоро откроется!')});
$('.mobile-menu').addEventListener('click',()=>{const nav=$('.desktop-nav');const visible=nav.style.display==='flex';nav.style.display=visible?'none':'flex';if(!visible){Object.assign(nav.style,{position:'absolute',top:'67px',left:'0',right:'0',padding:'22px 6%',background:'#151612',borderBottom:'1px solid #33342e',flexDirection:'column',gap:'20px',margin:'0'})}});
$$('.nav-link').forEach(link=>link.addEventListener('click',()=>{$$('.nav-link').forEach(a=>a.classList.toggle('active',a===link))}));
updateSavedUI();