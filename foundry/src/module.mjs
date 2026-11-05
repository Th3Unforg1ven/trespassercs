import { MODULE_ID, REVISION, MAX_IMPORT_BYTES, parseExport, blankRecord, buildActorData } from './bridge.mjs';
import { makeTemplate, templateDefaults } from './templates.mjs';

const t = (pt,en) => game.i18n.lang.startsWith('pt') ? pt : en;
const expected = () => {
  if (!game.user.isGM) throw new Error(t('Apenas o mestre pode importar e instalar templates.','Only the GM can import and install templates.'));
  if(game.system.id !== 'custom-system-builder' || game.system.version !== '6.1.2' || Number(game.release.generation) !== 14)
    throw new Error(t('Este pacote foi preparado para Foundry 14 + CSB 6.1.2.','This package targets Foundry 14 + CSB 6.1.2.'));
};
let installation;
async function installTemplates(locale) {
  expected();
  if(installation) await installation;
  installation = (async()=>{
    const results = {};
    for(const kind of ['character','haven']) {
      const existing = game.actors.find(a => a.type === '_template' && a.getFlag(MODULE_ID,'kind') === kind && a.getFlag(MODULE_ID,'locale') === locale && a.getFlag(MODULE_ID,'revision') === REVISION);
      // Existing user-edited templates are never overwritten.
      results[kind] = existing ?? await Actor.create(makeTemplate(kind,locale));
    }
    return results;
  })();
  try { return await installation; } finally { installation = null; }
}

async function uploadPortrait(portrait) {
  if(!portrait?.dataUrl)return null;
  const image = new Image();
  image.src = portrait.dataUrl;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width=640;canvas.height=800;
  const ctx = canvas.getContext('2d');
  const scale=Math.max(640/image.naturalWidth,800/image.naturalHeight)*portrait.zoom;
  const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
  ctx.drawImage(image,(640-w)*portrait.x/100,(800-h)*portrait.y/100,w,h);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.9));
  if(!blob)throw new Error('Portrait conversion failed.');
  const picker=foundry.applications.apps.FilePicker.implementation;
  const folder='trespasser-portraits';
  try { await picker.browse('data',folder); }
  catch { await picker.createDirectory('data',folder); }
  const filename=`portrait-${foundry.utils.randomID()}.webp`;
  const result=await picker.upload('data',folder,new File([blob],filename,{type:'image/webp'}),{}, {notify:false});
  if(!result?.path)throw new Error(t('Não foi possível enviar o retrato. Nenhuma ficha foi criada.','Portrait upload failed. No actor was created.'));
  return result.path;
}

async function createRecord(kind,record,locale) {
  expected();
  const templates=await installTemplates(locale), template=templates[kind].toObject();
  const data=buildActorData(record,template);
  data.system.props={...templateDefaults(template),...data.system.props};
  if(kind==='character' && record.portrait?.dataUrl) data.img=await uploadPortrait(record.portrait);
  data.ownership[game.user.id]=CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  const actor=await Actor.create(data);
  if(!actor)throw new Error('Actor creation failed.');
  await actor.sheet.render({force:true});
  return actor;
}

export class TrespasserPortal extends foundry.applications.api.DialogV2 {
  constructor(options={}) {
    const initial=game.i18n.lang.startsWith('pt')?'pt':'en';
    const content=document.createElement('div');
    content.innerHTML=`<p>${t('Fichas de personagem e refúgio para Trespasser v2.1.3.','Character and haven records for Trespasser v2.1.3.')}</p>
      <div class="form-group"><label>${t('Idioma dos novos templates','New template language')}</label><select name="locale"><option value="pt" ${initial==='pt'?'selected':''}>Português · English terms</option><option value="en" ${initial==='en'?'selected':''}>English</option></select></div>
      <div class="form-group"><label for="tp-import-file">${t('JSON exportado pelo site','JSON exported from the website')}</label><input id="tp-import-file" name="record" type="file" accept=".json,application/json"></div>
      <p class="tp-note">${t('Importar cria uma nova ficha. Depois, atribua a propriedade ao jogador no Foundry. O site e o Foundry salvam separadamente.','Import creates a new actor. Then assign ownership to the player in Foundry. Website and Foundry saves are separate.')}</p>
      <p class="tp-note">${t('Versão de teste: validação dentro do Foundry ainda pendente.','Test release: in-Foundry validation is still pending.')}</p>`;
    const action = (id,label,fn)=>({action:id,label,callback:async(_event,button)=>{
      try { expected(); return await fn(button.form); }
      catch(error){ console.error('Trespasser CSB',error);ui.notifications.error(error.message); return null; }
    }});
    super({window:{title:'Trespasser · CSB'},position:{width:560},classes:['trespasser-portal'],content,
      buttons:[
        action('install',t('Instalar templates','Install templates'),async form=>{
          await installTemplates(form.elements.locale.value);ui.notifications.info(t('Templates disponíveis na lista de Atores.','Templates available in the Actors directory.'));
        }),
        action('character',t('Novo personagem','New character'),form=>createRecord('character',blankRecord('character'),form.elements.locale.value)),
        action('haven',t('Novo refúgio','New haven'),form=>createRecord('haven',blankRecord('haven'),form.elements.locale.value)),
        action('import',t('Importar JSON','Import JSON'),async form=>{
          const file=form.elements.record.files[0];
          if(!file)throw new Error(t('Selecione um arquivo JSON.','Choose a JSON file.'));
          if(file.size>MAX_IMPORT_BYTES)throw new Error('Maximum: 4 MB.');
          const {kind,record}=parseExport(await file.text());
          return createRecord(kind,record,form.elements.locale.value);
        })
      ],...options});
  }
}

Hooks.once('init',()=>{
  game.settings.registerMenu(MODULE_ID,'records',{
    name:'Trespasser · Registros / Records',label:'Abrir / Open',hint:'Templates & JSON import · Character / Haven',
    icon:'fas fa-book-open',type:TrespasserPortal,restricted:true
  });
});
Hooks.once('ready',()=>{
  game.modules.get(MODULE_ID).api={open:()=>new TrespasserPortal().render({force:true})};
  if(game.user.isGM && (game.system.version!=='6.1.2' || Number(game.release.generation)!==14))
    ui.notifications.warn('Trespasser CSB: target Foundry 14 / Custom System Builder 6.1.2.');
});

// Works with both CSB sheet implementations, without replacing their submit logic.
function themeSheet(app,element) {
  const actor=app.document??app.actor;
  if(actor?.documentName!=='Actor')return;
  const root=element instanceof HTMLElement?element:element?.[0];
  if(!root)return;
  const own=Boolean(actor.getFlag(MODULE_ID,'kind')) || Boolean(root.querySelector('.tp-root'));
  if(own)root.classList.add('trespasser-csb');
}
Hooks.on('renderApplicationV2',themeSheet);
Hooks.on('renderActorSheet',themeSheet);
