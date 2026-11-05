import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../dist/model.js';
import { createHaven } from '../dist/haven-model.js';
import { characterProps, havenProps, buildActorData, parseExport, prose, MODULE_ID, MAX_IMPORT_BYTES } from '../foundry/src/bridge.mjs';
import { makeTemplate, walkComponents, templateDefaults } from '../foundry/src/templates.mjs';

test('CSB import accepts website envelopes and rejects other formats/versions',()=>{
  for(const kind of ['character','haven']) {
    const record=kind==='haven'?createHaven('Porto'):createCharacter('Ágata');
    const json=JSON.stringify({format:`trespasser-${kind}`,version:1,rules:'2.1.3',[kind]:record});
    assert.equal(parseExport(json).record.name,record.name);
    assert.equal(parseExport(json).kind,kind);
  }
  for(const value of [null,{}, {format:'trespasser-character',version:2,rules:'2.1.3',character:createCharacter()}, {format:'trespasser-character',version:1,rules:'2.0.0'}]) assert.throws(()=>parseExport(JSON.stringify(value)));
  assert.throws(()=>parseExport('{'));
  assert.throws(()=>parseExport(' '.repeat(MAX_IMPORT_BYTES+1)));
  assert.throws(()=>parseExport(JSON.stringify({format:'trespasser-character',version:1,rules:'2.1.3',character:{level:99}})));
});

test('all imported character properties are editable component keys, including variable length data',()=>{
  const c=createCharacter('Teste');
  c.trained=['alchemy','stealth'];c.plightSelections=['angry'];
  c.resources={hp:43,recovery:7,recoveryTotal:13,endurance:2,focus:24,resolve:3};
  c.notes='<img src=x onerror=alert(1)>\nÁéíóú';c.states={burning:2,homebrew:3};
  c.inventory=Array.from({length:23},(_,i)=>({id:`item-${i}`,name:`Item ${i}`,slots:0.5,notes:'<b>nota</b>'}));
  c.deeds=Array.from({length:9},(_,i)=>({id:`deed-${i}`,name:`Deed ${i}`,kind:'heavy',cost:2,focus:4,description:'<script>evil</script>'}));
  const p=characterProps(c),template=makeTemplate();
  const editable=new Set();walkComponents(template,(component,inTable)=>{if(!inTable && ['numberField','textField','textArea','select','checkbox','dynamicTable'].includes(component.type))editable.add(component.key);});
  assert.deepEqual(Object.keys(p).filter(key=>!editable.has(key)),[]);
  assert.equal(Object.keys(p.inventory).length,23);assert.equal(Object.keys(p.deeds).length,9);
  assert.equal(p.res_focus,24);assert.equal(p.res_recoveryTotal,13);assert.equal(p.res_endurance,2);
  assert.equal(p.otherStates[0].name,'homebrew');assert.equal(p.otherStates[0].intensity,3);
  assert.ok(!p.notes.includes('<img'));assert.ok(p.notes.includes('&lt;img'));
  assert.ok(p.deeds[0].description.includes('&lt;script&gt;'));
  assert.equal(p.inventory[0].slots,0.5);
});

test('all haven data is mapped to editable fields without dropping long tables',()=>{
  const h=createHaven('Porto');h.trained=['faith'];h.bonuses.expenses=-100;h.hirelings.mercenary=3;h.hirelingRates.mercenary=127;h.mercenaryLevel=4;
  for(const key of ['builds','projects','strongholds'])h[key]=[{id:key,name:'Torre',clock:2,segments:12,notes:'<hello>',project:'Cais',arrivals:'Ana'}];
  h.finishedBuildings=[{id:'f',name:'Forja',notes:'24'}];h.productionChains=[{id:'p',name:'Minério',cost:103,hirelings:'2',output:'Metal',notes:'Paga'}];
  const p=havenProps(h),editable=new Set();
  walkComponents(makeTemplate('haven'),(c,inTable)=>{if(!inTable && ['numberField','textField','textArea','select','checkbox','dynamicTable'].includes(c.type))editable.add(c.key);});
  assert.deepEqual(Object.keys(p).filter(key=>!editable.has(key)),[]);
  assert.equal(p.strongholds[0].project,'Cais');assert.equal(p.hireling_mercenary,3);assert.equal(p.rate_mercenary,127);
  assert.equal(p.productionChains[0].cost,103);assert.equal(p.event_segments,6);
});

test('creation payload has private ownership, linked HP token and no imported identity/permissions',()=>{
  const template={_id:'template12345678',...makeTemplate()};
  const c=createCharacter('Novo');c.ownership={default:3};c._id='existingactor';
  const actor=buildActorData(c,template);
  assert.equal(actor.type,'character');assert.equal(actor.system.template,template._id);
  assert.deepEqual(actor.ownership,{default:0});assert.equal(actor._id,undefined);
  assert.equal(actor.prototypeToken.actorLink,true);assert.equal(actor.prototypeToken.bar1.attribute,'attributeBar.res_hp');
  assert.equal(actor.flags[MODULE_ID].sourceId,c.id);
  actor.system.header.contents=[];assert.notEqual(template.system.header.contents.length,0);
  assert.throws(()=>buildActorData(c,{...template,type:'character'}));
});

test('templates have unique root keys and native defaults for every boolean/table',()=>{
  for(const kind of ['character','haven'])for(const locale of ['pt','en']){
    const template=makeTemplate(kind,locale),keys=new Set(),defaults=templateDefaults(template);
    walkComponents(template,(c,inTable)=>{
      assert.match(c.key,/^[A-Za-z0-9_]+$/);
      if(!inTable){assert.ok(!keys.has(c.key),`duplicate ${c.key}`);keys.add(c.key);}
      if(c.type==='dynamicTable')assert.ok(c.canPlayerAdd);
      if(c.type==='checkbox'&&!inTable)assert.equal(defaults[c.key],false);
    });
    assert.equal(defaults.rollAttribute,kind==='character'?'might':'military');
    assert.equal(template.system.initiativeFormula,'');
  }
});

test('resource defaults and token maximum use independent daily recovery pool',()=>{
  const template=makeTemplate(),all={};walkComponents(template,c=>{all[c.key]=c;});
  assert.equal(all.res_hp.maxVal,'${hpMax}$');
  assert.equal(all.res_recovery.maxVal,'${recoveryMax}$');
  assert.equal(all.res_focus.maxVal,'1000000000');
  assert.equal(all.res_resolve.maxVal,'3');
  assert.equal(templateDefaults(template).res_recoveryTotal,10);
});

test('plain imported prose escapes HTML and preserves line breaks',()=>{
  assert.equal(prose('A&B\n<script>"x"</script>'),'<p>A&amp;B<br>&lt;script&gt;&quot;x&quot;&lt;/script&gt;</p>');
  assert.equal(prose(''),'');
});
