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
  // Theme-specific board materials: the same playable grid becomes a different physical world.
  const boardLooks={
    wild:{base:0x17231a,rim:0x514333,inset:0x283b29,empty:0x284632,path:0x92734b,start:0x9ab849,finish:0xc7a365,trap:0x783d35,event:0x66528f,detail:0x54734a,detail2:0x64523a,metal:0x9b9b8b},
    island:{base:0x203b3b,rim:0x6c573b,inset:0x7f704e,empty:0x47734c,path:0xc3a36b,start:0x71b98b,finish:0xf0d18b,trap:0x9b6048,event:0x3f9fa5,detail:0x3c7951,detail2:0x9c8759,metal:0xb4b7a3},
    city:{base:0x20262b,rim:0x42464a,inset:0x333a3f,empty:0x39483e,path:0x686b6a,start:0x86a87c,finish:0xe1b37c,trap:0x8d4841,event:0xb27c4b,detail:0x53615a,detail2:0x777b7c,metal:0xb7bfc1},
    mystery:{base:0x211e2c,rim:0x4b4357,inset:0x343044,empty:0x41443c,path:0x71677b,start:0x879b70,finish:0xc5b5d6,trap:0x78475c,event:0x8e79b8,detail:0x555044,detail2:0x5d5867,metal:0xaaa2b4},
    neon:{base:0x151b2a,rim:0x3b4055,inset:0x242d43,empty:0x25454a,path:0x3b5264,start:0x45b6a1,finish:0x5cc6e6,trap:0xb13f72,event:0xd65bb8,detail:0x28616a,detail2:0x3c5369,metal:0x80d8e7},
    cosmos:{base:0x171d35,rim:0x424865,inset:0x272f4d,empty:0x303e62,path:0x59658a,start:0x7899cb,finish:0xd0c6ff,trap:0x864d7a,event:0x8197e5,detail:0x40567a,detail2:0x6c7397,metal:0xb4c7f4}
  };
  let activeBoardLook=boardLooks.wild;
  function terrainMaterial(base,kind,seed){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const c=canvas.getContext('2d');c.fillStyle='#'+base.toString(16).padStart(6,'0');c.fillRect(0,0,256,256);
    let state=(seed+17)*2654435761>>>0;
    const rand=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
    // Dense, fine-grained albedo variation instead of flat toy-like tile colors.
    for(let i=0;i<4400;i++){
      const v=Math.floor(rand()*48)-24,alpha=.12+rand()*.24;
      const r=Math.max(0,Math.min(255,((base>>16)&255)+v));
      const g=Math.max(0,Math.min(255,((base>>8)&255)+v));
      const b=Math.max(0,Math.min(255,(base&255)+v));
      c.fillStyle='rgba('+r+','+g+','+b+','+alpha+')';
      const size=kind==='soil'?1+rand()*4:1+rand()*2.5;
      c.beginPath();c.ellipse(rand()*256,rand()*256,size,size*(.4+rand()),rand()*3.14,0,Math.PI*2);c.fill();
    }
    if(kind==='grass'){
      for(let i=0;i<1800;i++){
        const x=rand()*256,y=rand()*256;
        c.strokeStyle=rand()>.5?'rgba(150,177,91,.2)':'rgba(16,47,22,.24)';
        c.lineWidth=.5+rand();c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-2+rand()*4,y-4-rand()*5,x-4+rand()*8,y-3-rand()*11);c.stroke();
      }
    } else if(kind==='soil'){
      for(let i=0;i<130;i++){
        c.strokeStyle=rand()>.5?'rgba(213,181,123,.18)':'rgba(35,26,17,.2)';c.lineWidth=.5+rand()*2;
        c.beginPath();c.moveTo(rand()*256,rand()*256);c.lineTo(rand()*256,rand()*256);c.stroke();
      }
    }
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=2;
    return new THREE.MeshStandardMaterial({map:tex,color:0xffffff,roughness:kind==='stone'?.88:1});
  }
  function createBoardMaterials(){
    const key=root.dataset.gameScene||'wild';activeBoardLook=boardLooks[key]||boardLooks.wild;
    boardMaterials={
      empty:terrainMaterial(key==='island'?0x54784a:activeBoardLook.empty,'grass',11),
      path:terrainMaterial(key==='island'?0xb79a69:activeBoardLook.path,'soil',23),
      start:terrainMaterial(activeBoardLook.start,'grass',31),
      finish:terrainMaterial(activeBoardLook.finish,'grass',47),
      treasure:terrainMaterial(0x887043,'soil',59),
      trap:terrainMaterial(activeBoardLook.trap,'stone',71),
      event:terrainMaterial(activeBoardLook.event,'stone',83)
    };
  }
  const forestMaterialCache={};
  function forestMat(color,roughness=1){
    const key=color+'-'+roughness;
    if(!forestMaterialCache[key])forestMaterialCache[key]=new THREE.MeshStandardMaterial({color,roughness});
    return forestMaterialCache[key];
  }
  function seeded(seed){
    let state=(seed+1)*2654435761>>>0;
    return ()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
  }
  function addCanopy(x,z,scale,seed){
    // Organic overhead canopy clusters: overlapping irregular crowns, not stacked toy cones.
    const rand=seeded(seed), greens=[0x203f28,0x294e2e,0x315a34,0x3a6539,0x456d3c,0x527746];
    const shadow=boardMesh(new THREE.CircleGeometry(.43*scale,18),forestMat(0x101d14),x+.055,.087,z+.07);
    shadow.rotation.x=-Math.PI/2;
    const trunk=boardMesh(new THREE.CylinderGeometry(.055*scale,.105*scale,.18*scale,8),forestMat(0x3d2c20),x,.13,z);
    trunk.castShadow=true;
    // Wide central crown plus asymmetric lobes create a naturally uneven silhouette.
    for(let n=0;n<11;n++){
      const angle=rand()*Math.PI*2,dist=n===0?0:(.10+rand()*.19)*scale;
      const radius=(.19+rand()*.13)*scale;
      const crown=boardMesh(new THREE.SphereGeometry(radius,9,7),forestMat(greens[Math.floor(rand()*greens.length)]),
        x+Math.cos(angle)*dist,.19+rand()*.045,z+Math.sin(angle)*dist,
        .88+rand()*.48,.48+rand()*.18,.82+rand()*.48);
      crown.rotation.y=rand()*Math.PI;
    }
    // Small edge leaves break the smooth circular outline from the overhead camera.
    for(let n=0;n<7;n++){
      const angle=rand()*Math.PI*2,dist=(.28+rand()*.08)*scale;
      const leaf=boardMesh(new THREE.SphereGeometry(.065*scale,7,5),forestMat(greens[Math.floor(rand()*greens.length)]),
        x+Math.cos(angle)*dist,.205,z+Math.sin(angle)*dist,.85,.45,1.2);
      leaf.rotation.y=angle;
    }
  }
  function boardMesh(geometry,material,x,y,z,scaleX=1,scaleY=1,scaleZ=1){
    const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(scaleX,scaleY,scaleZ);m.castShadow=true;m.receiveShadow=true;boardRoot.add(m);return m;
  }
  function addTopDownTree(x,z,seed){addCanopy(x,z,1.15,seed);}
  function addForestRoots(x,z,seed){
    const rand=seeded(seed+401),rootMat=forestMat(seed%3===0?0x493a27:0x5a452e),count=3+(seed%3);
    for(let n=0;n<count;n++){
      const a=Math.PI*2*n/count+(rand()-.5)*.45,length=.18+rand()*.2;
      const root=boardMesh(new THREE.CylinderGeometry(.012,.035,length,5),rootMat,x+Math.cos(a)*length*.36,.105,z+Math.sin(a)*length*.36);
      root.rotation.set(.12,-a,Math.PI/2);root.scale.z=.72+rand()*.65;
    }
  }
  function addFern(x,z,seed){
    const rand=seeded(seed+809),greens=[0x41653a,0x557743,0x71884a],stemMat=forestMat(0x3b512e);
    for(let n=0;n<5;n++){
      const a=n*Math.PI*2/5+rand()*.35,len=.13+rand()*.1;
      const leaf=boardMesh(new THREE.SphereGeometry(.085,7,5),forestMat(greens[n%3]),x+Math.cos(a)*len*.65,.115,z+Math.sin(a)*len*.65,1.05,.25,.52);
      leaf.rotation.y=-a;
      const stem=boardMesh(new THREE.CylinderGeometry(.008,.012,len,4),stemMat,x+Math.cos(a)*len*.36,.105,z+Math.sin(a)*len*.36);
      stem.rotation.set(0,-a,Math.PI/2);
    }
  }
  function addFallenLog(x,z,seed){
    const rand=seeded(seed+1201),wood=forestMat(seed%2?0x493522:0x5b432b),length=.34+rand()*.22;
    const log=boardMesh(new THREE.CylinderGeometry(.045,.06,length,7),wood,x,.12,z);
    log.rotation.set(0,(rand()-.5)*.8,Math.PI/2);
    const end=boardMesh(new THREE.CircleGeometry(.043,8),forestMat(0x9a7950),x+length*.49,.12,z);
    end.rotation.x=-Math.PI/2;
  }
  function addBoulderDetail(x,z,seed){
    const rand=seeded(seed+1601),rockMat=forestMat(seed%2?0x62675a:0x777969,.98),size=.105+rand()*.095;
    const b=boardMesh(new THREE.DodecahedronGeometry(size,1),rockMat,x,.11,z,1.25,.75,.95);
    b.rotation.set(rand()*.2,rand()*Math.PI,rand()*.18);
    const chip=boardMesh(new THREE.DodecahedronGeometry(size*.42,0),rockMat,x+(rand()-.5)*.18,.085,z+(rand()-.5)*.15,.9,.72,1.1);
    chip.rotation.y=rand()*Math.PI;
  }
  function addForestFloorDetail(x,z,seed){
    // Small, irregular moss islands and fallen twigs break the perfect-square look
    // without changing the underlying logical grid or making the board too heavy.
    const mossColors=[0x3d5b36,0x526b3d,0x667348];
    const mossMat=new THREE.MeshStandardMaterial({color:mossColors[seed%3],roughness:1});
    const patch=new THREE.Mesh(new THREE.SphereGeometry(.19+(seed%3)*.035,7,5),mossMat);
    patch.position.set(x+(((seed*7)%11)/20-.25),.188,z+(((seed*5)%9)/20-.22));
    patch.scale.set(1.25,.12,.72);patch.rotation.y=(seed%7)*.43;patch.receiveShadow=true;boardRoot.add(patch);
    if(seed%2===0){
      const twigMat=forestMat(seed%4===0?0x493b2a:0x66503a);
      const twig=boardMesh(new THREE.CylinderGeometry(.018,.032,.27,5),twigMat,x+(((seed*3)%7)/16-.2),.205,z+(((seed*11)%7)/16-.2));
      twig.rotation.set(.08,(seed%9)*.37,Math.PI/2+((seed%3)-1)*.22);
    }
    if(seed%3===0)addFern(x+(((seed*5)%7)/10-.3),z+(((seed*3)%9)/12-.3),seed);
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
    if(boardRoot){boardScene.remove(boardRoot);boardRoot.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&& !Object.values(boardMaterials).includes(o.material)){if(Array.isArray(o.material))o.material.forEach(m=>{if(m.map)m.map.dispose();m.dispose();});else{if(o.material.map)o.material.map.dispose();o.material.dispose();}}});}
    boardRoot=new THREE.Group();boardScene.add(boardRoot);
    const look=activeBoardLook;
    const baseMat=new THREE.MeshStandardMaterial({color:look.base,roughness:.96,metalness:.015});
    boardMesh(new THREE.BoxGeometry(8.3,.08,8.3),baseMat,0,-.065,0);
    // Theme-specific edge finish keeps the board feeling like a physical miniature terrain.
    const rimMat=new THREE.MeshStandardMaterial({color:look.rim,roughness:.78,metalness:(root.dataset.gameScene==='neon'||root.dataset.gameScene==='cosmos')?.18:.02});
    boardMesh(new THREE.BoxGeometry(8.36,.045,8.36),rimMat,0,-.005,0);
    const insetMat=new THREE.MeshStandardMaterial({color:look.inset,roughness:.94});
    boardMesh(new THREE.BoxGeometry(8.12,.018,8.12),insetMat,0,.025,0);
    // Top-down natural terrain: flat continuous ground, textured soil and grass,
    // with trees/rocks as environmental decoration rather than raised toy-like cubes.
    for(let i=0;i<8;i++)for(let j=0;j<8;j++){
      const cell=board.children[i*8+j];if(!cell||!cell.classList.contains('play-cell'))continue;
      const type=['start','finish','treasure','trap','event','empty'].find(t=>cell.classList.contains('tile-'+t))||'path';
      const x=j-3.5,z=i-3.5,seed=i*8+j+1;
      // Forest ground is continuous grass; dirt paths are irregular overlays, not square tiles.
      const terrainType=root.dataset.gameScene==='wild'?'empty':type;
      const terrain=boardMesh(new THREE.PlaneGeometry(1.015,1.015),boardMaterials[terrainType],x,.055,z);
      terrain.rotation.x=-Math.PI/2;terrain.receiveShadow=true;terrain.castShadow=false;
      if(type==='path'){
        if(root.dataset.gameScene==='wild'){
          const rand=seeded(seed+173);
          const dirt=boardMesh(new THREE.CircleGeometry(.61,18),boardMaterials.path,x,.062,z, .9+rand()*.2,1,.78+rand()*.25);
          dirt.rotation.x=-Math.PI/2;
          for(let n=0;n<2;n++){
            const patch=boardMesh(new THREE.CircleGeometry(.27+rand()*.13,12),boardMaterials.path,x+(rand()-.5)*.42,.063,z+(rand()-.5)*.42,.8+rand()*.5,1,.65+rand()*.6);
            patch.rotation.x=-Math.PI/2;
          }
        }
        // Uneven dirt edge stones, scattered rather than arranged as decorative beads.
        for(let k=0;k<3;k++){
          const px=x+Math.sin(seed*2.1+k*4.3)*.34,pz=z+Math.cos(seed*1.7+k*3.7)*.34;
          const stone=boardMesh(new THREE.DodecahedronGeometry(.035+(k%2)*.018,0),new THREE.MeshStandardMaterial({color:k===1?0x9a8b70:0x665b49,roughness:1}),px,.09,pz,1.2,.55,.8);
          stone.rotation.y=seed*k;
        }
        if(seed%2===0){
          const rand=seeded(seed+91),greens=[0x284d2d,0x355d32,0x496b39];
          for(let n=0;n<4;n++){
            const tuft=boardMesh(new THREE.SphereGeometry(.045+rand()*.025,6,5),forestMat(greens[n%3]),x+(rand()-.5)*.78,.09,z+(rand()-.5)*.78,.8,.5,1.1);
          }
        }
        if(seed%4===0){
          const grassMat=forestMat(0x516b37);
          for(let k=0;k<3;k++){const blade=boardMesh(new THREE.ConeGeometry(.018,.12,4),grassMat,x+Math.sin(seed+k)*.37,.11,z+Math.cos(seed*2+k)*.34);blade.rotation.z=(k-1)*.32;}
        }
        if(seed%5===0)addForestFloorDetail(x,z,seed);
      } else if(type==='empty'){
        const rand=seeded(seed+211);
        if(seed%3!==0)addCanopy(x+((seed%3)-1)*.12,z+((seed%5)-2)*.07,.7+(seed%4)*.08,seed);
        if(seed%4===0)addBoulderDetail(x+.27,z-.22,seed);
        if(seed%5===1)addForestRoots(x-.12,z+.12,seed);
        if(seed%6===2)addFallenLog(x+(rand()-.5)*.24,z+(rand()-.5)*.24,seed);
        for(let k=0;k<3;k++){
          boardMesh(new THREE.SphereGeometry(.085+(k%2)*.025,7,6),forestMat([0x294f2d,0x3a6337,0x496b3c][k]),x+Math.sin(seed+k*2)*.31,.12,z+Math.cos(seed*1.4+k*2)*.3,.95,.62,1.05);
        }
        if(seed%3===0)addFern(x-.22,z+.2,seed);
      } else if(type==='treasure'){
        const chestWood=forestMat(0x624126,.82);
        const gold=new THREE.MeshStandardMaterial({color:0xc3a04b,metalness:.45,roughness:.38});
        const chest=boardMesh(new THREE.BoxGeometry(.25,.16,.2),chestWood,x,.16,z);
        chest.rotation.y=(seed%5)*.21;
        boardMesh(new THREE.BoxGeometry(.27,.035,.22),gold,x,.25,z);
        boardMesh(new THREE.BoxGeometry(.035,.1,.025),gold,x,.18,z+.105);
        boardMesh(new THREE.TorusGeometry(.12,.012,5,12,Math.PI),gold,x,.25,z,1,.65,.85);
        if(seed%2===0)addFern(x+.24,z+.2,seed);
      } else if(type==='trap'){
        const iron=new THREE.MeshStandardMaterial({color:0x6f7771,metalness:.65,roughness:.42});
        boardMesh(new THREE.TorusGeometry(.22,.022,5,20),iron,x,.09,z,1,1,.8);
        for(let k=0;k<5;k++){const spike=boardMesh(new THREE.ConeGeometry(.045,.15,5),iron,x-.17+k*.085,.15,z+Math.sin(k*1.2)*.06);spike.rotation.z=Math.PI;}
      } else if(type==='event'){
        const glow=new THREE.MeshStandardMaterial({color:activeBoardLook.event,emissive:activeBoardLook.event,emissiveIntensity:.28,roughness:.35});
        boardMesh(new THREE.OctahedronGeometry(.13,0),glow,x,.19,z,.75,1.1,.75);
        boardMesh(new THREE.RingGeometry(.2,.225,24),new THREE.MeshStandardMaterial({color:activeBoardLook.event,transparent:true,opacity:.65,roughness:.6}),x,.075,z);
      } else {
        const markerMat=new THREE.MeshStandardMaterial({color:type==='start'?0x9caf62:0xd7bd83,roughness:.75});
        boardMesh(new THREE.CylinderGeometry(.16,.2,.045,16),markerMat,x,.09,z);
        if(type==='start')addCanopy(x+.28,z-.2,.42,seed+13);
      }
      const tokenEls=cell.querySelectorAll('.player-token');
      tokenEls.forEach((token,index)=>{
        const css=getComputedStyle(token).getPropertyValue('--token-color').trim()||['#d8ff3e','#7ec8ff','#ff9b82','#c4a7ff'][index%4];
        const color=new THREE.Color(css),tokenMat=new THREE.MeshStandardMaterial({color,metalness:.16,roughness:.3});
        boardMesh(new THREE.CylinderGeometry(.09,.12,.08,16),tokenMat,x-.15+index*.12,.13,z+.13);
        boardMesh(new THREE.SphereGeometry(.075,12,10),tokenMat,x-.15+index*.12,.21,z+.13,.88,1.15,.88);
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
    // True orthographic overhead camera: a MOBA-style map view, not a tilted tabletop.
    boardCamera.position.set(0,24,0.001);boardCamera.up.set(0,0,-1);boardCamera.lookAt(0,0,0);
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
    new MutationObserver(()=>{createBoardMaterials();lastBoardSignature='';sync();}).observe(document.documentElement,{attributes:true,attributeFilter:['class','data-game-scene']});
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