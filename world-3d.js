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
  function irregularPatch(radius,seed,segments=22){
    const geometry=new THREE.CircleGeometry(radius,segments),positions=geometry.attributes.position,rand=seeded(seed+937);
    // Deform only the perimeter: dirt edges become naturally broken instead of perfect coins.
    for(let i=1;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),factor=.78+rand()*.42;
      positions.setXY(i,x*factor,y*factor);
    }
    positions.needsUpdate=true;geometry.computeVertexNormals();return geometry;
  }
  function addCanopy(x,z,scale,seed){
    // Taller, irregular woodland trees: visible trunks, branching limbs and layered foliage.
    const rand=seeded(seed),greens=[0x203b25,0x29492c,0x315632,0x3a6036,0x45683a,0x526f40,0x5b7845];
    const shadow=boardMesh(new THREE.CircleGeometry(.34*scale,20),forestMat(0x10170f),x+.055,.087,z+.07,.9,1,.8);
    shadow.rotation.x=-Math.PI/2;
    const bark=forestMat(seed%3===0?0x39291e:0x4b3524);
    const trunkH=.62*scale;
    const trunk=boardMesh(new THREE.CylinderGeometry(.045*scale,.09*scale,trunkH,7),bark,x,.055+trunkH/2,z);
    trunk.rotation.z=(rand()-.5)*.09;
    // Forked branches break the straight, toy-like trunk silhouette.
    for(let n=0;n<3;n++){
      const a=rand()*Math.PI*2,branchLen=(.19+rand()*.1)*scale;
      const branch=boardMesh(new THREE.CylinderGeometry(.012*scale,.027*scale,branchLen,5),bark,
        x+Math.cos(a)*branchLen*.25,.055+trunkH*(.62+n*.09),z+Math.sin(a)*branchLen*.25);
      branch.rotation.set(Math.sin(a)*.72,0,Math.cos(a)*.72);
    }
    // Layered asymmetric foliage, raised above the ground so perspective reveals depth.
    for(let n=0;n<13;n++){
      const angle=rand()*Math.PI*2,dist=n===0?0:(.08+rand()*.22)*scale;
      const radius=(.17+rand()*.14)*scale;
      const crownY=.055+trunkH*.92+rand()*.22*scale;
      const crown=boardMesh(new THREE.SphereGeometry(radius,10,8),forestMat(greens[Math.floor(rand()*greens.length)]),
        x+Math.cos(angle)*dist,crownY,z+Math.sin(angle)*dist,
        .9+rand()*.5,.72+rand()*.42,.85+rand()*.5);
      crown.rotation.set((rand()-.5)*.18,rand()*Math.PI,(rand()-.5)*.18);
    }
    // A few small leaf clusters create an uneven, natural crown edge.
    for(let n=0;n<5;n++){
      const angle=rand()*Math.PI*2,dist=(.25+rand()*.1)*scale;
      const leaf=boardMesh(new THREE.SphereGeometry(.055*scale,8,6),forestMat(greens[Math.floor(rand()*greens.length)]),
        x+Math.cos(angle)*dist,.055+trunkH*.86+rand()*.2*scale,z+Math.sin(angle)*dist,.9,.8,1.15);
      leaf.rotation.y=angle;
    }
  }
  function addTerrainRelief(x,z,seed){
    // Low, irregular ground swells break the flat board silhouette without moving logical cells.
    const rand=seeded(seed+3307),radius=.27+rand()*.16,segments=7+(seed%3);
    const positions=[],indices=[];
    const peak=.075+rand()*.055;
    positions.push(0,peak,0);
    for(let n=0;n<segments;n++){
      const a=Math.PI*2*n/segments+(rand()-.5)*.22;
      const r=radius*(.72+rand()*.38);
      positions.push(Math.cos(a)*r,.056+rand()*.009,Math.sin(a)*r);
    }
    for(let n=0;n<segments;n++)indices.push(0,n+1,(n+1)%segments+1);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    const colors=[0x314c2d,0x3c5732,0x455f37,0x526742];
    const material=forestMat(colors[seed%colors.length],1);
    const mound=boardMesh(geometry,material,x,.002,z);
    mound.castShadow=false;mound.receiveShadow=true;
  }
  function addForestEdge(x,z,seed){
    const rand=seeded(seed+2401),rock=forestMat(seed%2?0x55594b:0x696b5c,.98);
    // Irregular layered outcrops, partly buried in soil instead of a clean board rim.
    for(let n=0;n<3+(seed%3);n++){
      const px=x+(rand()-.5)*.78,pz=z+(rand()-.5)*.78,size=.12+rand()*.23;
      const b=boardMesh(new THREE.DodecahedronGeometry(size,1),rock,px,.035+size*.3,pz,.85+rand()*.75,.58+rand()*.72,.78+rand()*.62);
      b.rotation.set(rand()*.32,rand()*Math.PI,rand()*.26);
    }
    // Exposed roots and moss visually stitch the rocks into the forest floor.
    if(seed%2===0)addForestRoots(x+(rand()-.5)*.24,z+(rand()-.5)*.24,seed+77);
    if(seed%3===0){
      const moss=boardMesh(new THREE.SphereGeometry(.25,8,5),forestMat(0x3d5833),x+(rand()-.5)*.3,.073,z+(rand()-.5)*.3,1.4,.13,.92);
      moss.rotation.y=rand()*Math.PI;
    }
  }
  function boardMesh(geometry,material,x,y,z,scaleX=1,scaleY=1,scaleZ=1){
    const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(scaleX,scaleY,scaleZ);m.castShadow=true;m.receiveShadow=true;boardRoot.add(m);return m;
  }
  function addAncientRuin(){
    // Weathered, partially collapsed stone gateway behind the playable forest edge.
    // Decorative only: no gameplay cells or positions are changed.
    const stone=forestMat(0x55594d,.97),moss=forestMat(0x46573a,1),z=-4.02;
    for(const side of [-1,1]){
      const x=side*2.48,height=side===-1?1.02:.78;
      const pillar=boardMesh(new THREE.CylinderGeometry(.105,.16,height,7),stone,x,.055+height/2,z);
      pillar.rotation.z=side===-1?-.035:.08;
      boardMesh(new THREE.CylinderGeometry(.18,.2,.12,7),stone,x,.105,z,1,.55,1);
      const cap=boardMesh(new THREE.DodecahedronGeometry(.19,1),stone,x,.055+height,z,.95,.65,1.05);
      cap.rotation.set(.1,side*.3,.08);
      if(side===-1){
        const lintel=boardMesh(new THREE.BoxGeometry(.62,.16,.2),stone,x+.31,.055+height+.02,z);
        lintel.rotation.z=-.16;
      }else{
        const fragment=boardMesh(new THREE.DodecahedronGeometry(.23,1),stone,x-.23,.16,z,.95,.65,1.15);
        fragment.rotation.set(.1,.7,.24);
      }
      boardMesh(new THREE.SphereGeometry(.12,7,5),moss,x-side*.08,.12,z+.09,1.5,.16,.8);
    }
    for(let n=0;n<5;n++){
      const x=-.8+n*.38,rand=seeded(730+n),size=.09+rand()*.11;
      const chunk=boardMesh(new THREE.DodecahedronGeometry(size,1),stone,x,.055+size*.45,z+.05+(rand()-.5)*.2,.9+rand()*.6,.65+rand()*.5,.8+rand()*.5);
      chunk.rotation.set(rand()*.3,rand()*Math.PI,rand()*.2);
    }
    // Creeping ivy and weather stains visually age the masonry.
    const ivy=forestMat(0x354b2b,1),ivyLight=forestMat(0x526a37,1);
    for(const side of [-1,1]){
      const x=side*2.48,rand=seeded(880+(side+1)*17);
      for(let vine=0;vine<2;vine++){
        const points=[];
        const startY=.12+rand()*.18,span=.42+rand()*.3;
        for(let k=0;k<5;k++){
          const t=k/4;
          points.push(new THREE.Vector3(x+side*(.09+Math.sin(t*5+vine)*.055),startY+span*t,z+.105+vine*.035));
        }
        const curve=new THREE.CatmullRomCurve3(points);
        const stem=boardMesh(new THREE.TubeGeometry(curve,12,.012,4,false),ivy,0,0,0);
        stem.castShadow=false;
        for(let leaf=1;leaf<5;leaf+=2){
          const p=curve.getPoint(leaf/5);
          const sprout=boardMesh(new THREE.IcosahedronGeometry(.045,0),leaf%3===0?ivyLight:ivy,p.x+side*.045,p.y,p.z,.8,.45,1.15);
          sprout.rotation.y=rand()*Math.PI;
        }
      }
      // Water-darkened streaks break up the uniform stone surface.
      const stain=boardMesh(new THREE.BoxGeometry(.025,.28,.012),forestMat(0x343d30,1),x+side*.055,.43,z+.165,.7+rand()*.8,1,.7);
      stain.rotation.z=(rand()-.5)*.18;
    }
  }
  function addForestMushrooms(x,z,seed){
    // Tiny, subdued mushroom clusters provide scale cues along damp woodland edges.
    const rand=seeded(seed+5019),stem=forestMat(0xb8ad8a,.95);
    const caps=[forestMat(0x76513b,.92),forestMat(0x8a6845,.92),forestMat(0x5c6540,.98)];
    const count=2+(seed%2);
    for(let n=0;n<count;n++){
      const px=x+(rand()-.5)*.28,pz=z+(rand()-.5)*.26,h=.055+rand()*.045,r=.035+rand()*.018;
      boardMesh(new THREE.CylinderGeometry(.009,.012,h,5),stem,px,.058+h/2,pz,1,1,1);
      const cap=boardMesh(new THREE.SphereGeometry(r,7,5),caps[(seed+n)%caps.length],px,.058+h,pz,1,.42,1);
      cap.castShadow=false;
      if(n===0&&seed%3===0){
        const moss=boardMesh(new THREE.SphereGeometry(.11,7,5),forestMat(0x3b5a32),px-.04,.066,pz+.025,1.5,.12,.8);
        moss.castShadow=false;
      }
    }
  }
  function addForestMist(x,z,seed){
    // Low, translucent haze catches the forest light without obscuring gameplay tokens.
    const rand=seeded(seed+6101);
    const mistMat=new THREE.MeshBasicMaterial({color:0xb8c7a9,transparent:true,opacity:.055,depthWrite:false,side:THREE.DoubleSide});
    const haze=boardMesh(new THREE.CircleGeometry(.35+rand()*.3,16),mistMat,x+(rand()-.5)*.18,.084,z+(rand()-.5)*.18,1.5,.55,.75);
    haze.rotation.x=-Math.PI/2;
    haze.castShadow=false;haze.renderOrder=2;
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
    boardCamera.aspect=Math.max(.5,r.width/Math.max(1,r.height));
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
    if(root.dataset.gameScene==='wild')addAncientRuin();
    // One uninterrupted forest floor removes visible cell seams; the DOM grid still owns gameplay.
    if(root.dataset.gameScene==='wild'){
      const forestFloor=boardMesh(new THREE.PlaneGeometry(8.08,8.08),boardMaterials.empty,0,.052,0);
      forestFloor.rotation.x=-Math.PI/2;forestFloor.receiveShadow=true;forestFloor.castShadow=false;
    }
    // Textured terrain and irregular path overlays; the DOM grid remains the gameplay source of truth.
    for(let i=0;i<8;i++)for(let j=0;j<8;j++){
      const cell=board.children[i*8+j];if(!cell||!cell.classList.contains('play-cell'))continue;
      const type=['start','finish','treasure','trap','event','empty'].find(t=>cell.classList.contains('tile-'+t))||'path';
      const x=j-3.5,z=i-3.5,seed=i*8+j+1;
      // Forest ground is continuous grass; dirt paths are irregular overlays, not square tiles.
      const terrainType=root.dataset.gameScene==='wild'?'empty':type;
      if(root.dataset.gameScene!=='wild'){
        const terrain=boardMesh(new THREE.PlaneGeometry(1.015,1.015),boardMaterials[terrainType],x,.055,z);
        terrain.rotation.x=-Math.PI/2;terrain.receiveShadow=true;terrain.castShadow=false;
      }
      if(type==='path'){
        if(root.dataset.gameScene==='wild'){
          const rand=seeded(seed+173);
          const dirt=boardMesh(irregularPatch(.59,seed+173,26),boardMaterials.path,x,.062,z,.94+rand()*.16,1,.82+rand()*.2);
          dirt.rotation.x=-Math.PI/2;
          // Join neighboring path cells into one readable trail rather than isolated dirt coins.
          const right=board.children[i*8+j+1];
          const down=board.children[(i+1)*8+j];
          if(j<7&&right&&right.classList.contains('tile-path')){
            const join=boardMesh(new THREE.CircleGeometry(.54,20),boardMaterials.path,x+.5,.0615,z,1.18,1,.82);
            join.rotation.x=-Math.PI/2;
          }
          if(i<7&&down&&down.classList.contains('tile-path')){
            const join=boardMesh(new THREE.CircleGeometry(.54,20),boardMaterials.path,x,.0615,z+.5,.82,1,1.18);
            join.rotation.x=-Math.PI/2;
          }
          for(let n=0;n<2;n++){
            const patch=boardMesh(irregularPatch(.24+rand()*.12,seed+n+291,16),boardMaterials.path,x+(rand()-.5)*.38,.063,z+(rand()-.5)*.38,.8+rand()*.5,1,.65+rand()*.6);
            patch.rotation.x=-Math.PI/2;
          }
          // Embedded pebbles and thin worn ruts make the trail read as compacted earth.
          for(let n=0;n<4;n++){
            const px=x+(rand()-.5)*.78,pz=z+(rand()-.5)*.72,size=.018+rand()*.025;
            const pebble=boardMesh(new THREE.DodecahedronGeometry(size,0),forestMat(n%2?0x766650:0x5c503e,1),px,.071,pz,1.3,.55,.9);
            pebble.rotation.y=rand()*Math.PI;
          }
          for(let rut=0;rut<2;rut++){
            const rutMesh=boardMesh(new THREE.CapsuleGeometry(.012,.25,2,4),forestMat(0x6e5236,1),x+(rut===0?-.17:.17),.063,z+(rand()-.5)*.12,.75,1,1.15);
            rutMesh.rotation.x=Math.PI/2;
            rutMesh.rotation.z=(rand()-.5)*.22;
            rutMesh.castShadow=false;
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
        if(root.dataset.gameScene==='wild'&&seed%2===0)addTerrainRelief(x+(rand()-.5)*.22,z+(rand()-.5)*.22,seed);
        if(root.dataset.gameScene==='wild'&&seed%4===1)addForestMushrooms(x-.22,z+.24,seed);
        if(root.dataset.gameScene==='wild'&&seed%7===0)addForestMist(x,z,seed);
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
      // Rough natural border: broken rock shelves and exposed roots instead of a clean square rim.
      if(root.dataset.gameScene==='wild'&&(i===0||i===7||j===0||j===7)&&seed%2===0){
        addForestEdge(x+(j===0?.22:j===7?-.22:0),z+(i===0?.22:i===7?-.22:0),seed);
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
    // Cinematic oblique perspective: the board reads as a real miniature MOBA world,
    // with visible terrain thickness, depth falloff and a horizon-facing forest edge.
    boardCamera=new THREE.PerspectiveCamera(34,1,.1,60);
    boardCamera.position.set(0,12.5,15.5);boardCamera.lookAt(0,.05,0);
    boardRenderer=new THREE.WebGLRenderer({canvas:boardCanvas,antialias:true,alpha:true,powerPreference:'low-power'});
    boardRenderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));boardRenderer.setClearColor(0x000000,0);
    boardRenderer.shadowMap.enabled=true;boardRenderer.shadowMap.type=THREE.PCFSoftShadowMap;
    boardRenderer.outputColorSpace=THREE.SRGBColorSpace;boardRenderer.toneMapping=THREE.ACESFilmicToneMapping;
    boardScene.add(new THREE.HemisphereLight(0xe5efdc,0x263326,1.75));
    const fill=new THREE.DirectionalLight(0xb7d6ff,.72);fill.position.set(6,5,-6);boardScene.add(fill);
    const sun=new THREE.DirectionalLight(0xffe8c4,2.7);sun.position.set(-5,11,7);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-7;sun.shadow.camera.right=7;sun.shadow.camera.top=7;sun.shadow.camera.bottom=-7;sun.shadow.bias=-.00018;sun.shadow.normalBias=.025;boardScene.add(sun);
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