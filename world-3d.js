/* NASTOLKA realtime 3D environment layer.
   Decorative WebGL environment only: the DOM board remains the source of truth for gameplay. */
(function(){
  'use strict';
  const root=document.documentElement;
  let renderer,scene,camera,world,raf,resizeObserver;
  const palettes={
    wild:{fog:0x111b15,ground:0x344332,rock:0x56584b,leaf:0x29472d,accent:0x84945a,sky:0x26352a},
    island:{fog:0x102a32,ground:0x9b8a61,rock:0x5d665b,leaf:0x2b5d3b,accent:0x5cc6bc,sky:0x20505b},
    city:{fog:0x171b22,ground:0x3e4548,rock:0x53575a,leaf:0x34483d,accent:0xd18a58,sky:0x30333a},
    mystery:{fog:0x191824,ground:0x343044,rock:0x565166,leaf:0x353d39,accent:0x8e79b8,sky:0x29263b},
    neon:{fog:0x111629,ground:0x22283b,rock:0x41465d,leaf:0x284a51,accent:0xd65bb8,sky:0x20273e},
    cosmos:{fog:0x10162c,ground:0x222d50,rock:0x4c5576,leaf:0x303c66,accent:0x8197e5,sky:0x18213d}
  };
  function mat(color,roughness){return new THREE.MeshStandardMaterial({color,roughness:roughness===undefined?.92:roughness,metalness:.02});}
  function box(parent,x,y,z,w,h,d,material,rx){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);if(rx)mesh.rotation.y=rx;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function rock(parent,x,z,scale,material){
    const mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(scale,1),material);
    mesh.position.set(x,scale*.42,z);mesh.scale.set(1.15,.68,.9);mesh.rotation.set(Math.random()*.25,Math.random()*3,Math.random()*.2);
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
  }
  function tree(parent,x,z,scale,leaf,wood){
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.11*scale,.18*scale,1.4*scale,7),wood);
    trunk.position.set(x,.7*scale,z);trunk.castShadow=true;parent.add(trunk);
    for(let i=0;i<3;i++){
      const crown=new THREE.Mesh(new THREE.IcosahedronGeometry((.68-i*.11)*scale,1),new THREE.MeshStandardMaterial({color:leaf,roughness:1,flatShading:false}));
      crown.position.set(x,(1.25+i*.43)*scale,z);crown.scale.set(1,.86,1.04);crown.castShadow=true;parent.add(crown);
    }
  }
  function build(sceneName){
    const p=palettes[sceneName]||palettes.wild;
    scene=new THREE.Scene();scene.background=new THREE.Color(p.sky);scene.fog=new THREE.FogExp2(p.fog,.025);
    camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,160);
    camera.position.set(0,8.7,21);camera.lookAt(0,1.5,0);
    const hemi=new THREE.HemisphereLight(0xdce8dc,0x20251e,2.1);scene.add(hemi);
    const sun=new THREE.DirectionalLight(0xffe5c0,3.1);sun.position.set(-8,16,9);sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-22;sun.shadow.camera.right=22;sun.shadow.camera.top=22;sun.shadow.camera.bottom=-22;scene.add(sun);
    const fill=new THREE.PointLight(p.accent,sceneName==='neon'?36:12,34);fill.position.set(7,5,-4);scene.add(fill);
    world=new THREE.Group();scene.add(world);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100,1,1),mat(p.ground));ground.rotation.x=-Math.PI/2;ground.position.y=-.1;ground.receiveShadow=true;world.add(ground);
    // Broken terrain shelves create depth and catch directional shadows.
    for(let i=0;i<17;i++){
      const x=(Math.random()-.5)*39,z=-7-Math.random()*24,w=2+Math.random()*7,h=.35+Math.random()*1.5,d=2+Math.random()*5;
      const shelf=box(world,x,-.2+h/2,z,w,h,d,mat(i%3===0?p.accent:p.rock));shelf.material.color.multiplyScalar(i%3===0?.32:.8);
    }
    const wood=mat(0x49382a);
    if(sceneName==='city'||sceneName==='neon'){
      for(let i=0;i<25;i++){
        const x=(Math.random()-.5)*36,z=-5-Math.random()*22,w=1.1+Math.random()*2.3,h=2+Math.random()*8,d=1.3+Math.random()*2.4;
        const b=box(world,x,h/2-.05,z,w,h,d,mat(i%4===0?p.accent:0x3c454e),Math.random()*.15);
        if(sceneName==='city'||sceneName==='neon'){
          const windows=mat(sceneName==='neon'?0x57cce4:0xe0ae78,.4);
          for(let yy=.8;yy<h-.3;yy+=.8)for(let xx=-w/2+.25;xx<w/2-.1;xx+=.5)box(world,x+xx,yy,z+d/2+.012,.11,.2,.025,windows);
        }
      }
    } else if(sceneName==='island'){
      const water=new THREE.Mesh(new THREE.PlaneGeometry(90,90),new THREE.MeshStandardMaterial({color:0x176d79,roughness:.3,metalness:.18}));water.rotation.x=-Math.PI/2;water.position.y=-.28;world.add(water);
      for(let i=0;i<23;i++)tree(world,(Math.random()-.5)*34,-4-Math.random()*24,.8+Math.random()*1.8,i%3===0?0x477a49:0x28553b,wood);
      for(let i=0;i<20;i++)rock(world,(Math.random()-.5)*34,-3-Math.random()*24,.4+Math.random()*1.3,mat(0x766f59));
    } else if(sceneName==='cosmos'){
      const starMat=new THREE.MeshBasicMaterial({color:0xe3e8ff});
      for(let i=0;i<160;i++){const star=new THREE.Mesh(new THREE.SphereGeometry(.025+Math.random()*.035,5,5),starMat);star.position.set((Math.random()-.5)*60,3+Math.random()*25,-8-Math.random()*35);world.add(star);}
      for(let i=0;i<9;i++)rock(world,(Math.random()-.5)*34,-4-Math.random()*22,.7+Math.random()*1.8,mat(0x454e75));
    } else {
      for(let i=0;i<34;i++)tree(world,(Math.random()-.5)*38,-5-Math.random()*24,.7+Math.random()*1.7,i%4===0?p.accent:p.leaf,wood);
      for(let i=0;i<24;i++)rock(world,(Math.random()-.5)*36,-3-Math.random()*24,.3+Math.random()*1.2,mat(p.rock));
      if(sceneName==='mystery')for(let i=0;i<6;i++){box(world,(Math.random()-.5)*25,.9,-7-Math.random()*14,1.1,1.8,1.1,mat(0x5d5867));}
    }
  }

  // A separate real 3D tabletop, aligned to the existing accessible DOM grid.
  // DOM remains authoritative for turns and multiplayer; WebGL supplies the rendered board.
  let boardRenderer,boardScene,boardCamera,boardCanvas,boardObserver,boardResizeHandler;
  let boardRoot,boardFrame;
  let boardMaterials,lastBoardSignature='',boardSyncQueued=false;
  function createBoardMaterials(){boardMaterials={
    empty:new THREE.MeshStandardMaterial({color:0x284632,roughness:1}),
    path:new THREE.MeshStandardMaterial({color:0x92734b,roughness:.94}),
    start:new THREE.MeshStandardMaterial({color:0x9ab849,roughness:.78}),
    finish:new THREE.MeshStandardMaterial({color:0xc7a365,roughness:.75}),
    treasure:new THREE.MeshStandardMaterial({color:0x9d7428,metalness:.22,roughness:.45}),
    trap:new THREE.MeshStandardMaterial({color:0x783d35,roughness:.82}),
    event:new THREE.MeshStandardMaterial({color:0x66528f,roughness:.68})
  };}
  function boardMesh(geometry,material,x,y,z,scaleX=1,scaleY=1,scaleZ=1){
    const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(scaleX,scaleY,scaleZ);m.castShadow=true;m.receiveShadow=true;boardRoot.add(m);return m;
  }
  function updateBoardPosition(){
    const board=document.getElementById('playBoard');
    if(!board||!boardCanvas||!boardRenderer)return;
    const r=board.getBoundingClientRect();
    boardCanvas.style.left=Math.round(r.left)+'px';boardCanvas.style.top=Math.round(r.top)+'px';
    boardCanvas.style.width=Math.round(r.width)+'px';boardCanvas.style.height=Math.round(r.height)+'px';
    boardRenderer.setSize(Math.max(1,Math.round(r.width)),Math.max(1,Math.round(r.height)),false);
    boardCamera.left=-4.18;boardCamera.right=4.18;boardCamera.top=4.18;boardCamera.bottom=-4.18;
    boardCamera.updateProjectionMatrix();
    boardFrame=board;
  }
  function boardSignature(board){
    return Array.from(board.children).map(cell=>cell.className+'['+cell.querySelectorAll('.player-token').length+']').join('|');
  }
  function build3DBoard(){
    const board=document.getElementById('playBoard');
    if(!board||!boardRenderer||!board.isConnected)return;
    lastBoardSignature=boardSignature(board);
    board.classList.add('board-3d-ready');
    if(boardRoot){boardScene.remove(boardRoot);boardRoot.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&& !Object.values(boardMaterials).includes(o.material)){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});}
    boardRoot=new THREE.Group();boardScene.add(boardRoot);
    const baseMat=new THREE.MeshStandardMaterial({color:0x17231a,roughness:.96,metalness:.015});
    boardMesh(new THREE.BoxGeometry(8.3,.34,8.3),baseMat,0,-.2,0);
    // Dark wood-like rim and a narrow inset border make the board read as a physical tabletop.
    const rimMat=new THREE.MeshStandardMaterial({color:0x514333,roughness:.78});
    boardMesh(new THREE.BoxGeometry(8.36,.1,8.36),rimMat,0,-.015,0);
    const insetMat=new THREE.MeshStandardMaterial({color:0x283b29,roughness:.94});
    boardMesh(new THREE.BoxGeometry(8.12,.035,8.12),insetMat,0,.045,0);
    for(let i=0;i<8;i++)for(let j=0;j<8;j++){
      const cell=board.children[i*8+j];if(!cell||!cell.classList.contains('play-cell'))continue;
      const type=['start','finish','treasure','trap','event','empty'].find(t=>cell.classList.contains('tile-'+t))||'path';
      const x=j-3.5,z=i-3.5;
      boardMesh(new THREE.BoxGeometry(.94,.2,.94),boardMaterials[type],x,.075,z);
      // Fine bevel-like inset and natural surface variation.
      if(type==='path'){
        for(let k=0;k<3;k++){
          const pebble=new THREE.Mesh(new THREE.DodecahedronGeometry(.075+(k%2)*.025,0),new THREE.MeshStandardMaterial({color:k===1?0xb8a17b:0x64523a,roughness:1}));
          pebble.position.set(x+(Math.random()-.5)*.58,.19,z+(Math.random()-.5)*.58);pebble.scale.y=.38;pebble.castShadow=true;boardRoot.add(pebble);
        }
      } else if(type==='empty'){
        const rockMat=new THREE.MeshStandardMaterial({color:0x4a6044,roughness:1});
        for(let k=0;k<2;k++){
          const bush=new THREE.Mesh(new THREE.IcosahedronGeometry(.19+Math.random()*.13,1),new THREE.MeshStandardMaterial({color:k?0x34583a:0x54734a,roughness:1}));
          bush.position.set(x+(k?-.2:.2),.27,z+(Math.random()-.5)*.3);bush.scale.y=1.35;bush.castShadow=true;boardRoot.add(bush);
        }
        if((i*8+j)%3===0)boardMesh(new THREE.DodecahedronGeometry(.13,1),rockMat,x+.25,.25,z+.24,.9,.65,.8);
      } else if(type==='treasure'){
        const gold=new THREE.MeshStandardMaterial({color:0xe0b64d,metalness:.35,roughness:.36});
        boardMesh(new THREE.BoxGeometry(.36,.25,.28),gold,x,.27,z);
        boardMesh(new THREE.BoxGeometry(.39,.07,.31),gold,x,.42,z);
        boardMesh(new THREE.BoxGeometry(.055,.08,.025),new THREE.MeshStandardMaterial({color:0x51351a,metalness:.1}),x,.33,z+.16);
      } else if(type==='trap'){
        const iron=new THREE.MeshStandardMaterial({color:0x9b9b8b,metalness:.7,roughness:.36});
        for(let k=0;k<4;k++){const spike=boardMesh(new THREE.ConeGeometry(.065,.24,6),iron,x-.24+k*.16,.25,z);spike.rotation.z=Math.PI;}
        boardMesh(new THREE.TorusGeometry(.28,.035,6,20),iron,x,.2,z,1,1,.8);
      } else if(type==='event'){
        const crystal=new THREE.MeshStandardMaterial({color:0xb7a4ff,metalness:.22,roughness:.24,emissive:0x30204b});
        const gem=boardMesh(new THREE.OctahedronGeometry(.22,0),crystal,x,.38,z,.8,1.25,.8);gem.rotation.y=.4;
      } else {
        const markerMat=new THREE.MeshStandardMaterial({color:type==='start'?0xd7f08a:0xe8d4a7,roughness:.5});
        boardMesh(new THREE.CylinderGeometry(.22,.27,.08,20),markerMat,x,.16,z);
        boardMesh(new THREE.CylinderGeometry(.035,.045,.48,8),markerMat,x,.43,z);
      }
      // The DOM token names/colors mirror local and online game state.
      const tokenEls=cell.querySelectorAll('.player-token');
      tokenEls.forEach((token,index)=>{
        const css=getComputedStyle(token).getPropertyValue('--token-color').trim()||['#d8ff3e','#7ec8ff','#ff9b82','#c4a7ff'][index%4];
        const color=new THREE.Color(css);
        const tokenMat=new THREE.MeshStandardMaterial({color,metalness:.12,roughness:.34});
        boardMesh(new THREE.CylinderGeometry(.105,.14,.12,16),tokenMat,x-.22+index*.14,.25,z+.18);
        boardMesh(new THREE.SphereGeometry(.095,12,10),tokenMat,x-.22+index*.14,.38,z+.18,.85,1.18,.85);
      });
    }
    updateBoardPosition();
    if(boardRenderer)boardRenderer.render(boardScene,boardCamera);
  }
  function init3DBoard(){
    const board=document.getElementById('playBoard');
    if(!board||boardCanvas)return;
    boardCanvas=document.createElement('canvas');boardCanvas.id='nastolkaBoard3D';boardCanvas.setAttribute('aria-hidden','true');
    Object.assign(boardCanvas.style,{position:'fixed',pointerEvents:'none',zIndex:'1'});
    (document.getElementById('gameDialog')||document.body).appendChild(boardCanvas);
    createBoardMaterials();
    boardScene=new THREE.Scene();boardScene.background=null;
    boardCamera=new THREE.OrthographicCamera(-4.4,4.4,4.4,-4.4,.1,40);
    // A low, oblique tabletop angle gives visible tile thickness and depth instead of a flat overhead grid.
    boardCamera.position.set(0,13,4.6);boardCamera.lookAt(0,0,0);
    boardRenderer=new THREE.WebGLRenderer({canvas:boardCanvas,antialias:true,alpha:true,powerPreference:'low-power'});
    boardRenderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));boardRenderer.setClearColor(0x000000,0);
    boardRenderer.shadowMap.enabled=true;boardRenderer.shadowMap.type=THREE.PCFSoftShadowMap;
    boardRenderer.outputColorSpace=THREE.SRGBColorSpace;boardRenderer.toneMapping=THREE.ACESFilmicToneMapping;
    boardScene.add(new THREE.HemisphereLight(0xe5efdc,0x263326,2.3));
    const sun=new THREE.DirectionalLight(0xffe8c4,3.1);sun.position.set(-5,11,7);sun.castShadow=true;sun.shadow.mapSize.set(768,768);sun.shadow.camera.left=-7;sun.shadow.camera.right=7;sun.shadow.camera.top=7;sun.shadow.camera.bottom=-7;sun.shadow.bias=-.00025;boardScene.add(sun);
    const sync=()=>{
      if(boardSyncQueued)return;
      boardSyncQueued=true;
      requestAnimationFrame(()=>{
        boardSyncQueued=false;
        const active=document.documentElement.classList.contains('game-mode')&&board.isConnected&&board.offsetWidth>0;
        boardCanvas.style.display=active?'block':'none';
        if(active){
          const signature=boardSignature(board);
          if(signature!==lastBoardSignature)build3DBoard();
          else {updateBoardPosition();boardRenderer.render(boardScene,boardCamera);}
        }
      });
    };
    boardObserver=new MutationObserver(sync);boardObserver.observe(board,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    boardResizeHandler=()=>{if(boardCanvas&&boardCanvas.style.display!=='none'){updateBoardPosition();boardRenderer.render(boardScene,boardCamera);}};
    addEventListener('resize',boardResizeHandler,{passive:true});addEventListener('scroll',boardResizeHandler,{passive:true,capture:true});
    new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['class','data-game-scene']});
    sync();
    // The board is static between moves: render only after state or layout changes,
    // rather than spending a full animation loop on a motionless tabletop.
  }

  function animate(){
    raf=requestAnimationFrame(animate);
    if(renderer&&scene&&camera){const t=performance.now()*.00012;if(world)world.rotation.y=Math.sin(t)*.012;renderer.render(scene,camera);}
  }
  function init(){
    if(!window.THREE||document.getElementById('nastolka3D'))return;
    const canvas=document.createElement('canvas');canvas.id='nastolka3D';canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(innerWidth,innerHeight);
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    build(root.dataset.gameScene||'wild');
    init3DBoard();
    const resize=()=>{if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);};
    addEventListener('resize',resize,{passive:true});
    new MutationObserver(()=>{const next=root.dataset.gameScene||'wild';if(sceneNameLast!==next){sceneNameLast=next;build(next);}}).observe(root,{attributes:true,attributeFilter:['data-game-scene']});
    animate();
  }
  let sceneNameLast='';
  function load(){if(window.THREE){init();return;}const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.min.js';s.onload=init;s.onerror=()=>root.classList.add('no-webgl-world');document.head.appendChild(s);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();