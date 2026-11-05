// Contract tests against an unpacked public CSB release, not a Foundry runtime.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { makeTemplate, templateDefaults, walkComponents } from '../foundry/src/templates.mjs';
import { characterProps, havenProps } from '../foundry/src/bridge.mjs';
import { createCharacter, derive, SKILLS } from '../dist/model.js';
import { createHaven, deriveHaven, HAVEN_SKILLS } from '../dist/haven-model.js';
const dir=path.resolve(process.argv[2]??'tmp/csb-6.1.2');
const read=relative=>readFile(path.join(dir,relative),'utf8');
assert.equal(JSON.parse(await read('system.json')).version,'6.1.2');
const context=vm.createContext({console});
vm.runInContext(await read('lib/math.js'),context);
// Only these host helpers are needed by CSB's native lookup() in our formulas.
context.foundry={utils:{getProperty:(o,key)=>String(key).split('.').reduce((v,k)=>v?.[k],o)}};
context.castToPrimitive=value=>typeof value==='string' && /^[-+]?\d+$/.test(value)?Number(value):value;
context.quoteString=JSON.stringify;context.UncomputableError=Error;context.Logger=console;
let importer=await read('module/formulas/FormulaFunctionImporter.js');
importer=importer.replace(/^import .*;\r?\n/gm,'').replace('export class FormulaFunctionImporter','class FormulaFunctionImporter');
vm.runInContext(importer+'\nglobalThis.ImportFunctions = FormulaFunctionImporter;',context);
function calculate(template,props){
  const scope={...templateDefaults(template),...props};
  const math=context.math.create(context.math.all);
  math.import(context.ImportFunctions.importCustomFunctions(math,scope,{computedTokens:{}}),{override:true});
  for(const {name,value} of template.system.hidden){
    assert.ok(value.startsWith('${')&&value.endsWith('}$'));
    scope[name]=math.evaluate(value.slice(2,-2),new Map(Object.entries(scope)));
  }
  return scope;
}
let comparisons=0;
for(const kind of ['character','haven'])for(const locale of ['pt','en']){
  const template=makeTemplate(kind,locale);
  const filenames={panel:'Panel',label:'Label',textField:'TextField',numberField:'NumberField',checkbox:'Checkbox',select:'Dropdown',textArea:'RichTextArea',dynamicTable:'DynamicTable',tab:'Tab',tabbedPanel:'TabbedPanel'};
  const types=new Set();walkComponents(template,c=>types.add(c.type));
  for(const type of types)assert.ok((await read(`module/sheets/components/${filenames[type]}.js`)).includes(`return '${type}'`),`Unsupported component ${type}`);
  for(let level=0;level<=9;level++)for(let scenario=0;scenario<6;scenario++){
    if(kind==='character'){
      const c=createCharacter();c.level=level;
      Object.keys(c.attributes).forEach((key,i)=>c.attributes[key]=(scenario+i)%6);
      c.keyAttribute=Object.keys(c.attributes)[scenario%4];
      c.trained=SKILLS.filter((_,i)=>(i+scenario)%2===0).map(s=>s.key);
      c.resources.recoveryTotal=17;c.resources.endurance=1;c.resources.focus=27;
      c.bonuses={hp:-2,endurance:3,guard:1,accuracy:-1,initiative:2,resist:1,prevail:-2,tenacity:3,speed:-1,focus:2};
      c.armor.forEach((a,i)=>a.ar=scenario%3===0?1:(i===0?scenario:0));
      c.inventory=Array.from({length:scenario},(_,i)=>({id:String(i),name:'Item',slots:0.5+i,notes:''}));
      const expected=derive(c),actual=calculate(template,characterProps(c));
      for(const key of ['skill','hpMax','enduranceMax','recoveryMax','focusStart','armor','guard','accuracy','initiative','resist','prevail','tenacity','speed','speedBonus','explore','encounter','slots','usedSlots']){assert.equal(actual[key],expected[key],`${kind} ${locale} ${level}/${scenario}: ${key}`);comparisons++;}
      assert.equal(actual.skillSides,Number(expected.skillDie.slice(1)));
      assert.equal(actual.checkAttribute,c.attributes.might);
      assert.equal(actual.checkSkill,c.trained.includes('acrobatics')?expected.skill:0);
    }else{
      const h=createHaven();h.level=level;h.mercenaryLevel=level||1;
      Object.keys(h.attributes).forEach((key,i)=>h.attributes[key]=(scenario+i)%6);
      h.trained=HAVEN_SKILLS.filter((_,i)=>(i+scenario)%2===0).map(s=>s.key);
      for(const key of Object.keys(h.hirelings)){h.hirelings[key]=scenario;h.hirelingRates[key]+=7;}
      h.bonuses={growth:-2,decline:1,expenses:scenario===0?-200:150};
      h.builds=Array.from({length:scenario},()=>({name:'Obra',clock:0,segments:6,notes:''}));
      h.finishedBuildings=Array.from({length:scenario+1},()=>({name:'Casa',notes:''}));
      const expected=deriveHaven(h),actual=calculate(template,havenProps(h));
      for(const key of ['skill','buildSlots','buildingLimit','growth','decline','hirelingExpenses','weeklyExpenses','totalHirelings','activeBuilds','buildingCount','freeBuildSlots','remainingBuildingCapacity']){assert.equal(actual[key],expected[key],`${kind} ${locale} ${level}/${scenario}: ${key}`);comparisons++;}
    }
  }
}
// CSB-deleted rows must not inflate totals.
const p=characterProps(createCharacter());p.inventory={'0':{name:'Deleted',slots:20,$deleted:true},'1':{name:'Live',slots:1.5}};
assert.equal(calculate(makeTemplate(),p).usedSlots,1.5);
console.log(`CSB 6.1.2: native component names checked; ${comparisons} derived-value comparisons passed using CSB math.js + native lookup(). Live Foundry testing remains pending.`);

// The real CSB phrase/roll parser, with only Foundry's dice backend substituted.
context.Logger={debug(){},error:console.error,warn:console.warn};
context.foundry.utils.mergeObject=(target,source)=>Object.assign(target,source);
for(const file of ['Formula','ComputablePhrase']){
  const source=(await read(`module/formulas/${file}.js`)).replace(/^import .*;\r?\n/gm,'').replace(/export default class/g,'class').replace(/^export default \w+;\r?$/gm,'').replace(/^export const /gm,'const ');
  vm.runInContext(source+`\nglobalThis.Native${file} = ${file};`,context);
}
let diceCalls=0;
context.Roll=class {
  constructor(formula){
    assert.match(formula,/^1d(?:6|8|10|12|20)(?:\s*\+\s*\d+)*$/,`Unresolved roll: ${formula}`);
    this.formula=formula;this.total=10;diceCalls++;
  }
  async evaluate(){return this;}
  toJSON(){return {formula:this.formula,total:this.total};}
};
for(const kind of ['character','haven'])for(const locale of ['pt','en']){
  const template=makeTemplate(kind,locale),record=kind==='character'?createCharacter():createHaven();
  const props=calculate(template,kind==='character'?characterProps(record):havenProps(record));
  const labels=[];walkComponents(template,c=>{if(c.type==='label')labels.push(c);});
  for(const c of labels){
    if(c.value)assert.ok((await context.NativeComputablePhrase.computeMessage(c.value,props)).result!==undefined);
    if(c.rollMessage)assert.ok((await context.NativeComputablePhrase.computeMessage(c.rollMessage,props)).result.includes('10'));
  }
}
assert.equal(diceCalls,30);
console.log(`Native CSB phrase parser: all display labels and ${diceCalls} chat roll expressions passed (mock dice backend, not live Foundry).`);
