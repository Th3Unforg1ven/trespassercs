import { ATTRS, SKILLS, PLIGHTS, createCharacter } from './models/model.js';
import { HAVEN_ATTRS, HAVEN_SKILLS, HIRELING_TYPES, createHaven } from './models/haven-model.js';
import { MODULE_ID, REVISION, ARMOR_SLOTS, MAGIC_SLOTS, STANDARD_STATES, characterProps, havenProps } from './bridge.mjs';

const expr = value => '${' + value + '}$';
export const CHARACTER_FORMULAS = {
  skill:'2 + floor(level / 3)', skillSides:'6 + 2 * floor(level / 3)',
  hpMax:'max(0, (level + 1) * (5 + attr_might) + bonus_hp)',
  enduranceMax:'level == 0 ? 0 : max(0, 10 + attr_spirit + bonus_endurance)',
  recoveryMax:'level == 0 ? 0 : res_recoveryTotal',
  focusStart:'level == 0 ? 0 : max(0, skill + bonus_focus)',
  armor:ARMOR_SLOTS.map(s => `armor_${s}_ar`).join(' + '),
  guard:'armor + (armor >= 6 ? 0 : attr_agility) + bonus_guard',
  accuracy:'(level == 0 ? max(attr_might, attr_agility) : (equalText(keyAttribute, "might") ? attr_might : (equalText(keyAttribute, "agility") ? attr_agility : (equalText(keyAttribute, "intellect") ? attr_intellect : attr_spirit)))) + skill + bonus_accuracy',
  initiative:'attr_agility + skill + bonus_initiative', resist:'attr_spirit + skill + bonus_resist',
  prevail:'attr_intellect + skill + bonus_prevail', tenacity:'attr_might + attr_spirit + bonus_tenacity',
  speed:'max(0, 5 + bonus_speed)', speedBonus:'armor >= 6 ? 2 : max(2, attr_agility)',
  explore:'attr_intellect + (trained_perception ? skill : 0)', encounter:'attr_agility + (trained_stealth ? skill : 0)',
  slots:'5 + attr_might', usedSlots:'sum(lookup("inventory", "slots"))',
};
export const HAVEN_FORMULAS = {
  skill:'2 + floor(level / 3)', buildSlots:'1 + floor(level / 3)', buildingLimit:'3 * (level + 1)',
  growth:'attr_appeal + (trained_hospitality ? skill : 0) + bonus_growth',
  decline:'attr_allegiance + (trained_faith ? skill : 0) + bonus_decline',
  hirelingExpenses:HIRELING_TYPES.map(t => `hireling_${t.key} * rate_${t.key}${t.key === 'mercenary' ? ' * mercenaryLevel' : ''}`).join(' + '),
  weeklyExpenses:'max(0, hirelingExpenses + bonus_expenses)',
  totalHirelings:HIRELING_TYPES.map(t => `hireling_${t.key}`).join(' + '),
  activeBuilds:'count(lookup("builds", "name"))', buildingCount:'count(lookup("finishedBuildings", "name"))',
  freeBuildSlots:'max(0, buildSlots - activeBuilds)', remainingBuildingCapacity:'max(0, buildingLimit - buildingCount)',
};

export function makeTemplate(kind = 'character', locale = 'pt') {
  if (!['character','haven'].includes(kind) || !['pt','en'].includes(locale)) throw new Error('Invalid template choice');
  const defaults = kind === 'character' ? characterProps(createCharacter()) : havenProps(createHaven());
  const t = (pt, en) => locale === 'pt' ? pt : en;
  const both = (pt,en) => locale === 'pt' ? `${pt} · ${en}` : en;
  let seq = 0;
  const base = (type,key,extra={}) => ({type,key,size:'full-size',cssClass:'',role:0,permission:0,editRole:0,escapeHTML:true,...extra});
  const text = (key,pt,en,extra={}) => base('textField',key,{label:both(pt,en),defaultValue:String(defaults[key]??''),cssClass:'tp-input',...extra});
  const num = (key,pt,en,min=0,max=1000000000,extra={}) => base('numberField',key,{label:both(pt,en),defaultValue:String(defaults[key]??0),minVal:String(min),maxVal:String(max),allowDecimal:false,allowRelative:true,showControls:true,controlsStyle:'hover',cssClass:'tp-number',...extra});
  const check = (key,pt,en,extra={}) => base('checkbox',key,{label:both(pt,en),defaultChecked:false,...extra});
  const rich = (key,pt,en) => base('textArea',key,{label:both(pt,en),defaultValue:'',style:'sheet',cssClass:'tp-prose'});
  const pick = (key,pt,en,options,extra={}) => base('select',key,{label:both(pt,en),selectedOptionType:'custom',options,defaultValue:String(defaults[key]??options[0]?.key??''),...extra});
  const label = (value,cssClass='') => base('label',`tp_label_${seq++}`,{value,prefix:'',suffix:'',style:'label',cssClass});
  const value = (pt,en,formula) => label(`${both(pt,en)}: ${expr(formula)}`,'tp-derived');
  const panel = (contents,flow='vertical',cssClass='') => base('panel',`tp_panel_${seq++}`,{flow,align:'left',verticalAlign:'top',contents,cssClass});
  const section = (pt,en,contents,flow='vertical') => panel([label(t(pt,en),'tp-heading'),panel(contents,flow)],'vertical','tp-card');
  const tab = (key,pt,en,contents) => base('tab',key,{name:t(pt,en),contents});
  const roll = (key,pt,en,formula) => {
    // CSB resolves :property: inside a roll before passing it to Foundry Roll.
    const dice = formula.replace(/\b(attr_\w+|checkAttribute|checkSkill|initiative|accuracy)\b/g, ':$1:');
    return base('label',key,{value:t(pt,en),style:'button',icon:'dice-d20',rollMessage:`${t(pt,en)}: ${expr('[' + dice + ']')}`,rollMessageToChat:true,cssClass:'tp-roll'});
  };
  const column = (component) => ({...component,colName:component.label??'',label:'',align:'left',readonlyPredefined:false});
  const table = (key,columns) => base('dynamicTable',key,{rowLayout:columns.map(column),predefinedLines:[],hiddenColumns:[],canPlayerAdd:true,head:true,deleteWarning:true,sortOption:'manual',cssClass:'tp-table',labelWhenEmpty:t('Nenhum registro. Use + para adicionar.','No entries. Use + to add.')});
  const clockColumns = () => [text('name','Nome','Name'),num('clock','Relógio','Clock',0,10000),num('segments','Segmentos','Segments',1,10000,{defaultValue:'6'}),rich('notes','Notas','Notes')];
  const attrs = kind === 'character' ? ATTRS : HAVEN_ATTRS, skills = kind === 'character' ? SKILLS : HAVEN_SKILLS;
  const attributePanel = section('Atributos','Attributes',attrs.map(a=>panel([num(`attr_${a.key}`,a.pt,a.en,0,5),roll(`roll_${a.key}`,'Testar','Check',`1d20 + attr_${a.key}`)])),'grid-4');
  // A skill does not have a fixed attribute in Trespasser: choose it for each check.
  const skillPanel = section('Perícias','Skills',[
    panel(skills.map(s=>check(`trained_${s.key}`,s.pt,s.en)),'grid-3'),
    panel([pick('rollAttribute','Atributo do teste','Check attribute',attrs.map(a=>({key:a.key,value:t(a.pt,a.en)}))),pick('rollSkill','Perícia do teste','Check skill',skills.map(s=>({key:s.key,value:t(s.pt,s.en)})))],'grid-2'),
    roll('roll_skill','Testar perícia','Skill check','1d20 + checkAttribute + checkSkill'),
    label(t('Escolha o atributo e a perícia. Bônus de treino só se a perícia estiver marcada. Compare o resultado com o TN da mesa.','Choose the attribute and skill. Training bonus applies only when checked. Compare the result with the table’s TN.'),'tp-note')
  ]);
  let header, tabs, formulas;
  if (kind === 'character') {
    formulas = {...CHARACTER_FORMULAS};
    header = [panel([text('player','Jogador','Player'),text('lineage','Linhagem','Lineage'),text('calling','Vocação','Calling')],'grid-3'),text('motto','Lema','Motto')];
    const resources = panel([
      panel([num('res_hp','Pontos de vida','Hit points',0,1000000000,{maxVal:expr('hpMax')}),value('Máximo','Maximum','hpMax')]),
      panel([num('res_recovery','Dados de recuperação','Recovery dice',0,1000000000,{maxVal:expr('recoveryMax')}),num('res_recoveryTotal','Reserva diária','Daily pool')]),
      panel([num('res_endurance','Resistência','Endurance',0,1000000000,{maxVal:expr('enduranceMax')}),value('Máximo','Maximum','enduranceMax')]),
      panel([num('res_focus','Foco','Focus'),value('Inicial','Starting','focusStart')]),
      num('res_resolve','Determinação','Resolve',0,3)
    ],'grid-5','tp-resources');
    const health = section('Saúde & ferimentos','Health & injuries',[
      panel(PLIGHTS.map(p=>check(`plight_${p.key}`,p.pt,p.en,{tooltip:t(p.descriptionPt,p.descriptionEn)})),'grid-2'),
      ...[0,1,2].map(i=>panel([text(`injury_${i}_name`, `Ferimento ${i+1}`,`Injury ${i+1}`),num(`injury_${i}_clock`,'Relógio','Clock',0,100)],'grid-2')),
      rich('plights','Outras aflições e notas','Other plights and notes'),
      label(t('Aflições são marcadas manualmente; seus efeitos não alteram valores automaticamente.','Plights are tracked manually; their effects do not change values automatically.'),'tp-note')
    ]);
    const advancement = section('Avanço & alinhamento','Advancement & alignment',[
      panel([num('level','Nível','Level',0,9),num('xp','Experiência','Experience'),value('Próximo nível','Next level','level == 0 or level == 9 ? "—" : 10 * (level + 1)')],'grid-3'),
      ...[0,1].map(i=>panel([text(`alignment_${i}_name`,`Traço ${i+1}`,`Trait ${i+1}`),num(`alignment_${i}_deny`,'Negar','Deny',0,3),num(`alignment_${i}_affirm`,'Afirmar','Affirm',0,3)],'grid-3'))
    ]);
    const combatLabels = [['initiative','Iniciativa','Initiative'],['accuracy','Precisão','Accuracy'],['guard','Guarda','Guard'],['resist','Resistir','Resist'],['prevail','Prevalecer','Prevail'],['tenacity','Tenacidade','Tenacity']];
    const combat = section('Movimento & ataque','Movement & attack',[
      panel([value('Velocidade','Speed','speed'),value('Bônus','Bonus','speedBonus'),label(`${both('Dado de perícia','Skill die')}: d${expr('skillSides')}`,'tp-derived'),roll('roll_skill_die','Rolar dado de perícia','Roll skill die','1d:skillSides:')],'grid-4'),
      panel(combatLabels.map(([key,pt,en])=>panel([value(pt,en,key),...(['initiative','accuracy'].includes(key)?[roll(`roll_${key}`,'Testar','Check',`1d20 + ${key}`)]:[])])),'grid-3'),
      ...[0,1].map(i=>section(i?'Mão secundária':'Mão principal',i?'Off hand':'Main hand',[
        text(`weapon_${i}_name`,'Arma','Weapon'),text(`weapon_${i}_damage`,'Dano (expressão)','Damage (expression)'),text(`weapon_${i}_range`,'Alcance','Range'),text(`weapon_${i}_properties`,'Propriedades','Properties')],'grid-2'))
    ]);
    const stateNames = ['Preciso','Impreciso','Protegido','Desprotegido','Fortificado','Frágil','Acelerado','Impedido','Regenerando','Afligido','Forte','Fraco','Ágil','Lento','Determinado','Exausto','Sangrando','Cego','Em chamas','Cambaleando','Derrubado'];
    tabs = [
      tab('tp_character','Personagem','Character',[
        panel([text('pastLife','Vida passada','Past life'),text('crafts','Ofícios','Crafts'),pick('keyAttribute','Atributo-chave','Key attribute',ATTRS.map(a=>({key:a.key,value:t(a.pt,a.en)})))],'grid-3'),
        attributePanel,skillPanel,panel([value('Explorar','Explore','explore'),value('Encontro','Encounter','encounter'),value('Bônus de perícia','Skill bonus','skill')],'grid-3'),health,advancement,section('Características & talentos','Features & talents',[rich('features','Características, habilidades e benefícios','Features, abilities and benefits')])
      ]),
      tab('tp_combat','Combate','Combat',[combat,section('Feitos','Deeds',[table('deeds',[text('name','Nome','Name'),pick('kind','Tipo','Kind',[{key:'light',value:t('Leve','Light')},{key:'heavy',value:t('Pesado','Heavy')},{key:'mighty',value:t('Poderoso','Mighty')},{key:'special',value:t('Especial','Special')}]),num('cost','Custo','Cost',0,10000),num('focus','Custo crescente','Increasing cost',0,10000),rich('description','Efeito','Effect')]),label(t('Custos e gastos são controlados manualmente.','Costs and spending are tracked manually.'),'tp-note')]),section('Estados','States',STANDARD_STATES.map((key,i)=>num(`state_${key}`,stateNames[i],key,0,10)),'grid-3'),section('Outros estados','Other states',[table('otherStates',[text('name','Nome','Name'),num('intensity','Intensidade','Intensity',0,10)])])]),
      tab('tp_equipment','Equipamento','Equipment',[
        section('Inventário','Inventory',[panel([text('coins','Moedas','Coins'),value('Espaços usados','Used slots','usedSlots'),value('Capacidade','Capacity','slots')],'grid-3'),table('inventory',[text('name','Item','Item'),num('slots','Espaços','Slots',0,1000,{defaultValue:'1',allowDecimal:true}),rich('notes','Notas','Notes')])]),
        section('Armadura','Armor',ARMOR_SLOTS.map((slot,i)=>section(['Cabeça','Corpo','Braços','Pernas','Exterior','Escudo'][i],['Head','Body','Arms','Legs','Outer','Shield'][i],[text(`armor_${slot}_name`,'Nome','Name'),text(`armor_${slot}_weight`,'Peso','Weight'),num(`armor_${slot}_ar`,'Proteção','Armor',0,1000),text(`armor_${slot}_die`,'Dado','Die'),text(`armor_${slot}_properties`,'Propriedades','Properties'),check(`armor_${slot}_spent`,'Gasto','Spent')],'grid-3'))),
        section('Itens mágicos','Magic items',MAGIC_SLOTS.map((slot,i)=>section(['Amuleto','Anel','Talismã'][i],['Amulet','Ring','Talisman'][i],[text(`magic_${slot}_name`,'Nome','Name'),rich(`magic_${slot}_effect`,'Efeito','Effect')])))
      ]),
      tab('tp_notes','Anotações','Notes',[rich('notes','Registro de aventura','Adventure log'),section('Ajustes manuais','Manual adjustments',Object.keys(createCharacter().bonuses).map(key=>num(`bonus_${key}`,key,key,-10000,10000,{allowDecimal:true})),'grid-3')])
    ];
    header = [...header,resources];
  } else {
    formulas = {...HAVEN_FORMULAS};
    header = [panel([text('leadership','Liderança','Leadership'),text('location','Localização','Location')],'grid-2'),panel([num('level','Nível','Level',0,9),num('partyLevel','Nível do grupo','Party level',0,9),num('populationRank','Grau de população','Population rank'),num('wealth','Riqueza','Wealth')],'grid-4')];
    tabs = [
      tab('tp_haven','Refúgio','Haven',[attributePanel,skillPanel,
        section('População & manutenção','Population & upkeep',[panel([value('Crescimento','Growth','growth'),value('Declínio','Decline','decline'),value('Despesas semanais','Weekly expenses','weeklyExpenses')],'grid-3'),pick('populationMode','População','Population',[{key:'growth',value:t('Crescimento','Growth')},{key:'decline',value:t('Declínio','Decline')}]),rich('arrivals','Chegadas','Arrivals')]),
        section('Evento','Event',[text('event_name','Evento','Event'),panel([num('event_clock','Relógio','Clock',0,10000),num('event_segments','Segmentos','Segments',1,10000)],'grid-2'),rich('event_notes','Notas do evento','Event notes')])]),
      tab('tp_buildings','Construções','Buildings',[
        panel([value('Espaços de obra','Build slots','buildSlots'),value('Obras ativas','Active builds','activeBuilds'),value('Limite de construções','Building limit','buildingLimit'),value('Concluídas','Completed','buildingCount')],'grid-4'),
        section('Em construção','Under construction',[table('builds',clockColumns())]),section('Concluídas','Completed',[table('finishedBuildings',[text('name','Nome','Name'),rich('notes','Notas','Notes')])]),
        section('Projetos','Projects',[table('projects',clockColumns())]),section('Fortalezas','Strongholds',[table('strongholds',[...clockColumns(),text('project','Projeto','Project'),text('arrivals','Chegadas','Arrivals')])])
      ]),
      tab('tp_industry','Trabalho','Industry',[
        section('Contratados','Hirelings',[panel([value('Total contratado','Total hired','totalHirelings'),value('Despesas','Expenses','hirelingExpenses'),num('mercenaryLevel','Nível dos mercenários','Mercenary level',1,9)],'grid-3'),...HIRELING_TYPES.map(h=>panel([num(`hireling_${h.key}`,h.pt,h.en,0,10000),num(`rate_${h.key}`,'Pagamento (cp)','Rate (cp)')],'grid-2'))]),
        section('Cadeias de produção','Production chains',[table('productionChains',[text('name','Nome','Name'),num('cost','Custo','Cost'),text('hirelings','Contratados','Hirelings'),text('output','Produção','Output'),rich('notes','Notas','Notes')])]),rich('storedItems','Itens armazenados','Stored items')
      ]),
      tab('tp_notes','Anotações','Notes',[rich('notes','Registro do refúgio','Haven log'),section('Ajustes manuais','Manual adjustments',[num('bonus_growth','Crescimento','Growth',-10000,10000),num('bonus_decline','Declínio','Decline',-10000,10000),num('bonus_expenses','Despesas','Expenses',-1000000000,1000000000)],'grid-3')])
    ];
  }
  // Native CSB formulas; there is no JavaScript evaluation of imported values.
  formulas.checkAttribute = attrs.reduceRight((rest,a)=>`equalText(rollAttribute, "${a.key}") ? attr_${a.key} : (${rest})`,'0');
  formulas.checkSkill = skills.reduceRight((rest,s)=>`equalText(rollSkill, "${s.key}") ? (trained_${s.key} ? skill : 0) : (${rest})`,'0');
  const system = {
    header:{type:'panel',key:'custom_header',contents:[panel(header,'vertical','tp-root')]},
    body:{type:'panel',key:'custom_body',contents:[panel([base('tabbedPanel','tp_tabs',{contents:tabs})],'vertical','tp-root')]},
    display:{width:960,height:850,fix_size:false,pp_width:160,pp_height:200},
    hidden:Object.entries(formulas).map(([name,formula])=>({name,value:expr(formula)})),
    // Trespasser initiative is a TN check, not a d20 ranking. Don't replace the world's initiative rule.
    initiativeFormula:'', attributeBar:{}, templateSystemUniqueVersion:REVISION
  };
  return {name:`Trespasser · ${kind==='character'?t('Personagem','Character'):t('Refúgio','Haven')} [${locale.toUpperCase()}]`,type:'_template',system,flags:{[MODULE_ID]:{kind,locale,revision:REVISION}},ownership:{default:2}};
}

export function walkComponents(template, visitor) {
  const visit = (c,inTable=false) => { visitor(c,inTable); for(const child of c.contents??[])visit(child,inTable); for(const child of c.rowLayout??[])visit(child,true); };
  visit(template.system.header);visit(template.system.body);
}

export function templateDefaults(template) {
  const props = {};
  walkComponents(template,(c,inTable)=>{
    if(inTable)return;
    if(c.type==='numberField') props[c.key]=Number(c.defaultValue??0);
    else if(c.type==='checkbox')props[c.key]=Boolean(c.defaultChecked);
    else if(['textField','textArea','select'].includes(c.type))props[c.key]=c.defaultValue??'';
    else if(c.type==='dynamicTable')props[c.key]={};
  });
  return props;
}
