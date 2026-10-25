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
      for(let i=0;i<23;i++)tree(world,(Math.random()-.5)*34,-4-Math.random()*24,.8+Math.random()*1.8,mat(i%3===0?0x477a49:0x28553b),wood);
      for(let i=0;i<20;i++)rock(world,(Math.random()-.5)*34,-3-Math.random()*24,.4+Math.random()*1.3,mat(0x766f59));
    } else if(sceneName==='cosmos'){
      const starMat=new THREE.MeshBasicMaterial({color:0xe3e8ff});
      for(let i=0;i<160;i++){const star=new THREE.Mesh(new THREE.SphereGeometry(.025+Math.random()*.035,5,5),starMat);star.position.set((Math.random()-.5)*60,3+Math.random()*25,-8-Math.random()*35);world.add(star);}
      for(let i=0;i<9;i++)rock(world,(Math.random()-.5)*34,-4-Math.random()*22,.7+Math.random()*1.8,mat(0x454e75));
    } else {
      for(let i=0;i<34;i++)tree(world,(Math.random()-.5)*38,-5-Math.random()*24,.7+Math.random()*1.7,mat(i%4===0?p.accent:p.leaf),wood);
      for(let i=0;i<24;i++)rock(world,(Math.random()-.5)*36,-3-Math.random()*24,.3+Math.random()*1.2,mat(p.rock));
      if(sceneName==='mystery')for(let i=0;i<6;i++){box(world,(Math.random()-.5)*25,.9,-7-Math.random()*14,1.1,1.8,1.1,mat(0x5d5867));}
    }
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
    const resize=()=>{if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);};
    addEventListener('resize',resize,{passive:true});
    new MutationObserver(()=>{const next=root.dataset.gameScene||'wild';if(sceneNameLast!==next){sceneNameLast=next;build(next);}}).observe(root,{attributes:true,attributeFilter:['data-game-scene']});
    animate();
  }
  let sceneNameLast='';
  function load(){if(window.THREE){init();return;}const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.min.js';s.onload=init;s.onerror=()=>root.classList.add('no-webgl-world');document.head.appendChild(s);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();