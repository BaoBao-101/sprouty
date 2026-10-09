import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PlantArt, type PlantStageId } from './PlantArt';
import { buildPlantModel, disposePlantModel, type ModelOptions } from './plant-model';
import './PlantViewer3D.css';
import { plantBackdrop } from './plant-backdrop';
import { buildAmbience, sceneLighting, type Ambience } from './garden-ambience';
import type { SceneKey } from './garden-looks';

type Props = ModelOptions & {
  /** The garden's scene; `natural` follows the clock through `isNight`. */
  scene?: SceneKey;
  /** Real time of day, for the regular scene. */
  isNight?: boolean;
};
type Viewer = {
  scene: T.Scene; camera: T.PerspectiveCamera; renderer: T.WebGLRenderer; controls: OrbitControls;
  draw: () => void; model?: T.Group; ambience?: Ambience | null;
  hemi: T.HemisphereLight; sun: T.DirectionalLight; rim: T.DirectionalLight; env: T.Texture;
};

/** Frames per second for the drifting particles: smooth enough, kind to a phone battery. */
const AMBIENT_FPS = 30;

export default function PlantViewer3D(props:Props) {
  const host=useRef<HTMLDivElement>(null);
  const viewer=useRef<Viewer | null>(null);
  const [unavailable,setUnavailable]=useState(false);
  const [roots,setRoots]=useState(false);
  const rootsRef=useRef(false);
  const scene=props.scene ?? 'natural';

  useEffect(()=>{
    const el=host.current;
    if(!el) return;
    let renderer:T.WebGLRenderer;
    try { renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'}); }
    catch { setUnavailable(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.25;
    const scene3=new T.Scene();
    const camera=new T.PerspectiveCamera(38,1,.05,30);
    camera.position.set(2.4,1.6,3.5);
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.target.set(0,.48,0);
    controls.enablePan=false; controls.minDistance=1.8; controls.maxDistance=7;
    controls.minPolarAngle=.08; controls.maxPolarAngle=Math.PI-.08;
    controls.update(); controls.saveState();
    const hemi=new T.HemisphereLight('#FFF6DE','#707B65',2.5); scene3.add(hemi);
    const sun=new T.DirectionalLight('#FFF2D5',3); sun.position.set(3,5,4);scene3.add(sun);
    const rim=new T.DirectionalLight('#D1E7EA',1.6);rim.position.set(-3,2,-2);scene3.add(rim);
    // Something for a glazed pot to reflect. Only materials flagged glossy get
    // it, so the leaves keep the matte look they were built with.
    const pmrem=new T.PMREMGenerator(renderer);
    const room=new RoomEnvironment();
    const env=pmrem.fromScene(room,.04).texture;
    room.dispose(); pmrem.dispose();
    const draw=()=>renderer.render(scene3,camera);
    const engine:Viewer={scene:scene3,camera,renderer,controls,draw,hemi,sun,rim,env};viewer.current=engine;
    const canvas=renderer.domElement;
    canvas.tabIndex=0;canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label','Mô hình cây 3D. Kéo để xoay, cuộn để phóng to. Dùng phím mũi tên để xoay, dấu cộng trừ để zoom, Home để đặt lại.');
    el.appendChild(canvas);
    controls.addEventListener('change',draw);
    const key=(event:KeyboardEvent)=>{
      const offset=camera.position.clone().sub(controls.target);
      const sphere=new T.Spherical().setFromVector3(offset);
      if(event.key==='ArrowLeft') sphere.theta-=.15;
      else if(event.key==='ArrowRight') sphere.theta+=.15;
      else if(event.key==='ArrowUp') sphere.phi=Math.max(.08,sphere.phi-.15);
      else if(event.key==='ArrowDown') sphere.phi=Math.min(Math.PI-.08,sphere.phi+.15);
      else if(event.key==='+' || event.key==='=') sphere.radius=Math.max(1.8,sphere.radius*.9);
      else if(event.key==='-') sphere.radius=Math.min(7,sphere.radius*1.1);
      else if(event.key==='Home') {event.preventDefault();controls.reset();return;}
      else return;
      event.preventDefault();camera.position.copy(controls.target).add(new T.Vector3().setFromSpherical(sphere));controls.update();draw();
    };
    canvas.addEventListener('keydown',key);
    const lost=(event:Event)=>{event.preventDefault();setUnavailable(true);};
    canvas.addEventListener('webglcontextlost',lost);
    const resize=new ResizeObserver(()=>{
      const {width,height}=el.getBoundingClientRect();if(!width||!height)return;
      camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);draw();
    });resize.observe(el);

    // The drifting particles. Runs only while there is something to move, the
    // viewer is on screen and the tab is visible; a reader who asked the
    // system for less motion gets the scene standing still.
    const still=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let onScreen=true, frame=0, last=0;
    const started=performance.now();
    const tick=(now:number)=>{
      frame=requestAnimationFrame(tick);
      if(!engine.ambience || !onScreen || document.hidden) return;
      if(now-last<1000/AMBIENT_FPS) return;
      last=now;
      engine.ambience.update((now-started)/1000);
      draw();
    };
    if(!still) frame=requestAnimationFrame(tick);
    const seen=new IntersectionObserver(entries=>{onScreen=entries.some(e=>e.isIntersecting);});
    seen.observe(el);

    return ()=>{
      cancelAnimationFrame(frame);seen.disconnect();
      resize.disconnect();controls.removeEventListener('change',draw);controls.dispose();
      canvas.removeEventListener('keydown',key);canvas.removeEventListener('webglcontextlost',lost);
      if(engine.model)disposePlantModel(engine.model);
      if(engine.ambience){scene3.remove(engine.ambience.group);engine.ambience.dispose();}
      if(scene3.background instanceof T.Texture) scene3.background.dispose();
      env.dispose();
      renderer.dispose();renderer.forceContextLoss();canvas.remove();viewer.current=null;
    };
  },[]);

  // The plant and its pot.
  useEffect(()=>{
    const engine=viewer.current;if(!engine)return;
    if(engine.model){engine.scene.remove(engine.model);disposePlantModel(engine.model);}
    const model=buildPlantModel(props);engine.model=model;engine.scene.add(model);
    model.traverse(obj=>{
      if(!(obj instanceof T.Mesh)) return;
      const material=obj.material as T.MeshStandardMaterial;
      if(material.userData?.glossy){material.envMap=engine.env;material.envMapIntensity=.9;material.needsUpdate=true;}
    });
    const shell=model.getObjectByName('soil-shell');if(shell)shell.visible=!(props.form==='root' && rootsRef.current);
    engine.draw();
  },[props.stage,props.progress,props.health,props.form,props.fruitShape,props.fruitColor,props.flowerColor,props.decoration]);

  // The place around it: sky, light, and whatever drifts through the air.
  useEffect(()=>{
    const engine=viewer.current;if(!engine)return;
    const night=Boolean(props.isNight);
    if(engine.scene.background instanceof T.Texture) engine.scene.background.dispose();
    engine.scene.background=plantBackdrop(scene,night);
    const light=sceneLighting(scene,night);
    engine.hemi.color.set(light.hemiSky);engine.hemi.groundColor.set(light.hemiGround);engine.hemi.intensity=light.hemi;
    engine.sun.color.set(light.sun);engine.sun.intensity=light.sunIntensity;engine.sun.position.set(...light.sunPos);
    engine.rim.color.set(light.rim);engine.rim.intensity=light.rimIntensity;
    engine.renderer.toneMappingExposure=light.exposure;
    if(engine.ambience){engine.scene.remove(engine.ambience.group);engine.ambience.dispose();}
    engine.ambience=buildAmbience(scene);
    if(engine.ambience) engine.scene.add(engine.ambience.group);
    engine.draw();
  },[scene,props.isNight]);

  function toggleRoots(){
    const next=!roots;setRoots(next);rootsRef.current=next;
    const shell=viewer.current?.model?.getObjectByName('soil-shell');if(shell)shell.visible=!next;
    viewer.current?.draw();
  }
  return <div className="plant-viewer">
    <div className="plant-viewer-stage" ref={host} hidden={unavailable} />
    {unavailable ? <><PlantArt {...props} stage={props.stage as PlantStageId} size={300}
      isNight={scene==='night' || (scene==='natural' && Boolean(props.isNight))} autumn={scene==='autumn'}/>
      <p className="plant-viewer-hint">Thiết bị chưa hỗ trợ 3D. Đang hiển thị hình minh họa.</p></> : <>
      <div className="plant-viewer-toolbar">
        <span className="plant-viewer-tag">MÔ HÌNH 3D</span>
        <button type="button" onClick={()=>viewer.current?.controls.reset()} aria-label="Đặt lại góc nhìn">Góc ban đầu</button>
      </div>
      <p className="plant-viewer-hint">Kéo để xoay · Cuộn hoặc chụm hai ngón để zoom</p>
      {props.form==='root' && <button type="button" className="plant-viewer-root" aria-pressed={roots} onClick={toggleRoots}>{roots?'Hiện lại đất và chậu':'Xem củ dưới đất'}</button>}
      {props.form==='root' && roots && <p className="plant-viewer-hint">Đã ẩn đất và chậu để quan sát củ. Cây vẫn đang trồng trong đất.</p>}
    </>}
  </div>;
}
