import * as T from 'three';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPlantModel, disposePlantModel, type ModelOptions } from '../src/components/plant-model';

const forms: ModelOptions['form'][] = ['root','bush','vine','stalk','head','leafy'];
for (const form of forms) for (const stage of ['seed','sprout','seedling','flowering','mature']) {
  const model=buildPlantModel({form,stage,progress:50,health:5,fruitShape:form==='root'?'root':'round',fruitColor:'#DB7A37',flowerColor:'#EFC445'});
  model.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(model);
  assert.ok(bounds.max.y<3 && bounds.min.y> -1);
  model.traverse(obj=>{if(obj instanceof T.Mesh){const arr=obj.geometry.attributes.position.array;assert.ok(Array.from(arr).every(Number.isFinite));}});
  assert.ok(model.getObjectByName('soil-shell'));
  let meshes=0;
  model.traverse(obj=>{if(obj instanceof T.Mesh) meshes++;});
  assert.ok(meshes<=12, `Excess draw calls for ${form}/${stage}: ${meshes}`);
  disposePlantModel(model);
}
// Offline geometry proof sheet: project the actual meshes, including back views.
let panels='';
for(let col=0;col<3;col++) {
  const model=buildPlantModel({form:'root',stage:'fruiting',progress:70,health:85,fruitShape:'root',fruitColor:'#DB7A37',flowerColor:'#EFC445'});
  if(col>0) model.getObjectByName('soil-shell')!.visible=false;
  model.updateMatrixWorld(true);
  const camera=new T.PerspectiveCamera(38,1,.05,30);
  camera.position.set(col===2?-2.4:2.4,1.6,col===2?-3.5:3.5);camera.lookAt(0,.25,0);camera.updateMatrixWorld(true);
  const faces:{z:number;path:string}[]=[];
  model.traverseVisible(obj=>{
    if(!(obj instanceof T.Mesh))return;
    const geo=obj.geometry as T.BufferGeometry, pos=geo.getAttribute('position'), index=geo.index;
    const mat=obj.material as T.MeshStandardMaterial;
    for(let i=0;i<(index?.count||pos.count);i+=3) {
      const world=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(pos,index?index.getX(i+j):i+j).applyMatrix4(obj.matrixWorld));
      const normal=world[1].clone().sub(world[0]).cross(world[2].clone().sub(world[0])).normalize();
      const light=.55+.45*Math.abs(normal.dot(new T.Vector3(1,2,3).normalize()));
      const color=mat.color.clone().multiplyScalar(light).getHexString();
      const projected=world.map(p=>p.project(camera));
      faces.push({z:projected.reduce((a,p)=>a+p.z,0)/3,path:`<path d="M${projected.map(p=>`${((p.x+1)*200).toFixed(1)},${((1-p.y)*200).toFixed(1)}`).join('L')}Z" fill="#${color}"/>`});
    }
  });
  faces.sort((a,b)=>b.z-a.z);
  panels+=`<g transform="translate(${col*400} 30)"><rect width="400" height="400" fill="#E5EBDD"/>${faces.map(f=>f.path).join('')}</g>`;
  disposePlantModel(model);
}
const path=join(tmpdir(),'sprouty-carrot-3d.svg');
writeFileSync(path,`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="430">${panels}</svg>`);
console.log(`PASS: 30 species/stage combinations, finite geometry, bounds, root visibility. Preview: ${path}`);
