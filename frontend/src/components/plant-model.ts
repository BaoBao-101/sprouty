import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PlantForm, FruitShape } from './PlantForms';
import type { PotKey } from './garden-looks';
import { buildPot } from './plant-pots';

export interface ModelOptions {
  stage: string; progress: number; health: number; form: PlantForm;
  fruitShape: FruitShape; fruitColor: string; flowerColor: string;
  decoration?: PotKey;
}
const stages = ['seed', 'sprout', 'seedling', 'vegetative', 'budding', 'flowering', 'fruiting', 'mature'];
const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z);

// Batch leaflets by material so a carrot does not need hundreds of draw calls.
// Keep soil and plant separate so the root inspection control can hide the pot.
function batchModel(group: T.Group) {
  for (const part of group.children) {
    const batches = new Map<T.Material, T.BufferGeometry[]>();
    for (const child of [...part.children]) {
      if (!(child instanceof T.Mesh) || Array.isArray(child.material)) continue;
      // A painted surface needs its UVs, which merging throws away.
      if ((child.material as T.MeshStandardMaterial).map) continue;
      child.updateMatrix();
      const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
      geometry.applyMatrix4(child.matrix);
      geometry.deleteAttribute('uv');
      const batch = batches.get(child.material) || [];
      batch.push(geometry); batches.set(child.material, batch);
      child.geometry.dispose(); part.remove(child);
    }
    for (const [material, geometries] of batches) {
      const merged = mergeGeometries(geometries);
      if (merged) part.add(new T.Mesh(merged, material));
      geometries.forEach(geometry => geometry.dispose());
    }
  }
  return group;
}

/** Hand-built botanical forms. Soil surface is y=0; roots grow below it. */
export function buildPlantModel(o: ModelOptions) {
  const group = new T.Group();
  const soil = new T.Group(); soil.name = 'soil-shell'; group.add(soil);
  const plant = new T.Group(); plant.name = 'plant'; group.add(plant);
  const phase = Math.max(0, stages.indexOf(o.stage)) + Math.min(.99, Math.max(0, o.progress / 100));
  const growth = Math.min(1, Math.max(.08, (phase - .5) / 6));
  const vigor = Math.min(1, Math.max(0, o.health / 100));
  const foliage = new T.Color('#477B37').lerp(new T.Color('#9D9054'), (1-vigor)*.6);
  const green = new T.MeshStandardMaterial({ color: foliage, roughness: .83, side: T.DoubleSide });
  const stem = new T.MeshStandardMaterial({ color: '#547A35', roughness: .9 });
  const earth = new T.MeshStandardMaterial({ color: '#51402F', roughness: 1 });
  const mesh = (geometry: T.BufferGeometry, material: T.Material, parent = plant) => {
    const m = new T.Mesh(geometry, material); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const tube = (points: T.Vector3[], radius = .015, material: T.Material = stem, parent = plant) =>
    mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), 12, radius, 6, false), material, parent);
  const ellipsoid = (position: T.Vector3, scale: T.Vector3, material: T.Material, parent = plant) => {
    const m = mesh(new T.SphereGeometry(1, 16, 10), material, parent); m.position.copy(position); m.scale.copy(scale); return m;
  };
  // A curved leaf blade with a raised midrib, not a sphere pretending to be a leaf.
  const leaf = (base: T.Vector3, tip: T.Vector3, width: number, material = green) => {
    const length = base.distanceTo(tip), positions: number[] = [], indices: number[] = [];
    for (let i=0;i<=8;i++) {
      const t=i/8, w=Math.sin(Math.PI*t)*width;
      for (let side=-1;side<=1;side++) positions.push(side*w, t*length, Math.sin(t*Math.PI)*length*.12 + (side===0 ? .012 : 0));
    }
    for(let i=0;i<8;i++) for(let j=0;j<2;j++) {
      const a=i*3+j; indices.push(a,a+3,a+1,a+1,a+3,a+4);
    }
    const geo=new T.BufferGeometry(); geo.setAttribute('position',new T.Float32BufferAttribute(positions,3)); geo.setIndex(indices); geo.computeVertexNormals();
    const m=mesh(geo,material); m.position.copy(base); m.quaternion.setFromUnitVectors(v(0,1,0),tip.clone().sub(base).normalize());
    return m;
  };
  buildPot(o.decoration, (geometry, material) => mesh(geometry, material, soil));
  const dirt=mesh(new T.CylinderGeometry(.57,.42,.73,40),earth,soil); dirt.position.y=-.38;
  // Small deterministic grains make the soil read as a surface without textures.
  for(let i=0;i<28;i++) {
    const a=i*2.399, r=.1+Math.sqrt((i+1)/28)*.42;
    ellipsoid(v(Math.cos(a)*r,-.008,Math.sin(a)*r),v(.024,.014,.018),earth,soil);
  }
  if(phase<1) {
    ellipsoid(v(0,.04,0),v(.065,.10,.045),new T.MeshStandardMaterial({color:'#947145',roughness:1}));
    if(o.progress>45) tube([v(0,.06,0),v(.025,.13,0),v(.07,.15,0)],.008);
    return batchModel(group);
  }
  if(phase<2) {
    const h=.13+growth*.4;
    tube([v(0,0,0),v(.025,h*.65,0),v(0,h,0)],.012);
    if(o.form==='stalk') leaf(v(0,h*.3,0),v(.06,h+.18,.03),.025);
    else for(const side of [-1,1]) leaf(v(0,h,0),v(side*.18,h+.06,.02),.06);
    return batchModel(group);
  }
  if(o.form==='root') {
    // Carrot taproot: a broad shoulder narrowing continuously into a fine tip.
    const length=.16+growth*.55, width=.025+Math.max(0,phase-3)*.026;
    const points=[[.002,-length],[width*.25,-length*.8],[width*.7,-length*.4],[width,-.06],[width*.8,.025],[0,.035]].map(([x,y])=>new T.Vector2(x,y));
    mesh(new T.LatheGeometry(points,32),new T.MeshStandardMaterial({color:'#D88136',roughness:.85}));
    for(let i=0;i<5;i++) {
      const y=-length*(.25+i*.13), a=i*2.4;
      tube([v(0,y,0),v(Math.cos(a)*width*1.2,y-.025,Math.sin(a)*width*1.2),v(Math.cos(a)*width*1.5,y-.065,Math.sin(a)*width*1.5)],.0025,earth);
    }
    const fronds=5+Math.floor(growth*4);
    for(let i=0;i<fronds;i++) {
      const a=i*2.399, h=(.4+growth*.7)*(1-(i%3)*.1), reach=.16+growth*.35;
      const end=v(Math.cos(a)*reach,h*(.72+vigor*.28),Math.sin(a)*reach);
      tube([v(0,.025,0),end.clone().multiplyScalar(.5).add(v(0,.08,0)),end],.008);
      const cross=v(-Math.sin(a),0,Math.cos(a));
      for(let j=2;j<9;j++) {
        const t=j/10, at=end.clone().multiplyScalar(t), span=(.11+growth*.08)*Math.sin(t*Math.PI);
        for(const side of [-1,1]) {
          const tip=at.clone().addScaledVector(cross,span*side).add(v(0,.065,0));
          tube([at,tip],.003);
          for(let k=1;k<=3;k++) {
            const b=at.clone().lerp(tip,k/4);
            leaf(b,b.clone().add(v(Math.cos(a)*.045,.025,Math.sin(a)*.045)),.012);
            leaf(b,b.clone().add(v(-Math.cos(a)*.045,.035,-Math.sin(a)*.045)),.012);
          }
        }
      }
    }
    return batchModel(group);
  }
  const h=.3+growth*1.45;
  const isHerb=o.form==='leafy', isVine=o.form==='vine', isCorn=o.form==='stalk', isSun=o.form==='head';
  if(isVine || (o.form==='bush' && o.fruitShape==='round')) {
    tube([v(-.09,0,0),v(-.09,h+.12,0)],.022,new T.MeshStandardMaterial({color:'#AF946A',roughness:1}));
  }
  const mainPoints=Array.from({length:16},(_,i)=>{const t=i/15;return v(isVine?Math.sin(t*15)*.08:Math.sin(t*3)*.025,t*h,isVine?Math.cos(t*15)*.08:0)});
  tube(mainPoints,isCorn?.035:.018);
  const count=isHerb?5:7;
  for(let i=0;i<count;i++) {
    const t=.2+i*.105, a=i*(isHerb?Math.PI:2.399), base=v(0,h*t,0);
    const length=(isCorn?.62:isSun?.42:.32)*(.55+growth*.45);
    const tip=v(Math.cos(a)*length,h*t + length*(vigor*.4-.15),Math.sin(a)*length);
    if(isCorn) { leaf(base,tip,.065); continue; }
    tube([base,base.clone().lerp(tip,.5).add(v(0,.04,0)),tip],.008);
    if(o.fruitShape==='round' && o.form==='bush') {
      const cross=v(-Math.sin(a),.25,Math.cos(a));
      for(const f of [.35,.65,.9]) for(const side of [-1,1]) {
        const b=base.clone().lerp(tip,f); leaf(b,b.clone().addScaledVector(cross,side*.12).add(v(0,.045,0)),.045);
      }
    } else if(isVine) {
      for(const offset of [-.7,0,.7]) leaf(tip.clone().multiplyScalar(.88),tip.clone().add(v(Math.cos(a+offset)*.13,.12,Math.sin(a+offset)*.13)),.065);
    } else {
      leaf(base.clone().lerp(tip,.35),tip.clone().add(v(0,.08,0)),isSun?.14:.08);
      if(isHerb) leaf(base,v(-tip.x,tip.y,-tip.z),.09);
    }
  }
  const flowerMaterial=new T.MeshStandardMaterial({color:o.flowerColor,roughness:.8,side:T.DoubleSide});
  function flower(center:T.Vector3,r:number,petals:number) {
    ellipsoid(center,v(r*.4,r*.4,.025),new T.MeshStandardMaterial({color:isSun?'#5B3A24':'#D9AF42',roughness:1}));
    for(let i=0;i<petals;i++) {
      const a=i/ petals*Math.PI*2;
      leaf(center,center.clone().add(v(Math.cos(a)*r,Math.sin(a)*r,.02)),r*.18,flowerMaterial);
    }
  }
  if(phase>=4 && phase<5 && !isHerb) ellipsoid(v(0,h+.02,0),v(.045,.07,.045),green);
  if(phase>=5 && !isHerb) {
    if(isCorn) {
      for(let i=0;i<7;i++) {const a=i*2.399; tube([v(0,h,0),v(Math.cos(a)*.11,h+.22,Math.sin(a)*.11)],.008,flowerMaterial);}
    } else if(isSun) flower(v(0,h, .03),.29,18);
    else for(let i=0;i<3;i++) flower(v(Math.cos(i*2.4)*.17,h*(.65+i*.1),Math.sin(i*2.4)*.17),.065,5);
  }
  if(phase>=6 && !isHerb && !isSun) {
    const fruitMat=new T.MeshStandardMaterial({color:new T.Color('#78A54B').lerp(new T.Color(o.fruitColor),Math.min(1,phase-6)),roughness:.48});
    for(let i=0;i<(isCorn?1:3);i++) {
      const a=i*2.399+.6, center=v(Math.cos(a)*.21,h*(.5+i*.13),Math.sin(a)*.21);
      tube([v(0,center.y+.14,0),center.clone().add(v(0,.08,0)),center],.007);
      if(isCorn) {
        ellipsoid(center,v(.085,.24,.085),fruitMat);
        leaf(center.clone().add(v(0,-.24,0)),center.clone().add(v(.14,.2,0)),.08);
      } else if(isVine || o.fruitShape==='cone') {
        const points = [new T.Vector2(.001,-.28),new T.Vector2(.022,-.18),new T.Vector2(isVine?.025:.055,-.04),new T.Vector2(.015,0)];
        const fruit=mesh(new T.LatheGeometry(points,16),fruitMat); fruit.position.copy(center); fruit.rotation.z=.2;
      } else ellipsoid(center,v(.105,.09,.105),fruitMat);
    }
  }
  return batchModel(group);
}

export function disposePlantModel(root:T.Object3D) {
  const geometries=new Set<T.BufferGeometry>(), materials=new Set<T.Material>();
  root.traverse(obj=>{if(obj instanceof T.Mesh){geometries.add(obj.geometry);for(const mat of Array.isArray(obj.material)?obj.material:[obj.material])materials.add(mat);}});
  geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose());
}
