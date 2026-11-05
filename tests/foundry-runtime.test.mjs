import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../dist/model.js';
import { MODULE_ID } from '../foundry/src/bridge.mjs';

test('GM portal installs idempotently, imports fresh private actors, and rejects invalid/unauthorized writes',async()=>{
  const callbacks={},menus=[],actors=[],errors=[];
  let serial=0;
  globalThis.Hooks={once:(key,fn)=>{callbacks[key]=fn;},on:()=>{}};
  globalThis.document={createElement:()=>({innerHTML:''})};
  globalThis.CONST={DOCUMENT_OWNERSHIP_LEVELS:{OWNER:3}};
  globalThis.foundry={applications:{api:{DialogV2:class{constructor(options){this.options=options;}}}}};
  globalThis.game={user:{id:'gm00000000000001',isGM:true},i18n:{lang:'pt-BR'},system:{id:'custom-system-builder',version:'6.1.2'},release:{generation:14},actors,
    settings:{registerMenu:(...args)=>menus.push(args)}};
  globalThis.ui={notifications:{error:message=>errors.push(message),info:()=>{}}};
  globalThis.Actor={create:async data=>{
    const raw={...structuredClone(data),_id:`actor${String(++serial).padStart(11,'0')}`};
    const actor={...raw,id:raw._id,toObject:()=>structuredClone(raw),getFlag:(ns,key)=>raw.flags?.[ns]?.[key],sheet:{render:async()=>{}}};
    actors.push(actor);return actor;
  }};
  const {TrespasserPortal}=await import('../foundry/src/module.mjs');
  callbacks.init();assert.equal(menus[0][2].restricted,true);
  const portal=new TrespasserPortal(),buttons=Object.fromEntries(portal.options.buttons.map(b=>[b.action,b]));
  const form={elements:{locale:{value:'pt'},record:{files:[]}}};
  const click=action=>buttons[action].callback({}, {form});
  await click('install');assert.equal(actors.length,2);
  await click('install');assert.equal(actors.length,2);
  // The installer must not restore or overwrite the user's customized template.
  actors[0].name='Customized';await click('install');assert.equal(actors[0].name,'Customized');
  await click('character');assert.equal(actors.length,3);assert.equal(actors[2].system.props.trained_stealth,false);
  await click('haven');assert.equal(actors.length,4);assert.equal(actors[3].flags[MODULE_ID].kind,'haven');
  const character=createCharacter('Imported');character.resources.focus=29;character.notes='Long note';
  const text=JSON.stringify({format:'trespasser-character',version:1,rules:'2.1.3',character});
  form.elements.record.files=[{size:text.length,text:async()=>text}];
  await click('import');await click('import');
  assert.equal(actors.length,6);assert.notEqual(actors[4]._id,actors[5]._id);
  assert.equal(actors[4].system.props.res_focus,29);assert.equal(actors[4].ownership.default,0);assert.equal(actors[4].ownership[game.user.id],3);
  const originalConsoleError=console.error;console.error=()=>{};
  try{
    form.elements.record.files=[{size:3,text:async()=>'{'}];await click('import');assert.equal(actors.length,6);
    game.user.isGM=false;await click('character');assert.equal(actors.length,6);
    game.user.isGM=true;game.system.version='5.2.1';await click('install');assert.equal(actors.length,6);
    assert.equal(errors.length,3);
  }finally{console.error=originalConsoleError;}
});
