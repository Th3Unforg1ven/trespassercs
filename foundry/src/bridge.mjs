import { normalizeCharacter, createCharacter } from './models/model.js';
import { normalizeHaven, createHaven } from './models/haven-model.js';

export const MODULE_ID = 'trespasser-csb';
export const REVISION = 1;
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
export const ARMOR_SLOTS = ['head', 'body', 'arms', 'legs', 'outer', 'shield'];
export const MAGIC_SLOTS = ['amulet', 'ring', 'talisman'];
export const STANDARD_STATES = ['accurate','inaccurate','guarded','unguarded','fortified','frail','hastened','hindered','mending','afflicted','strong','weak','swift','slow','willful','weary','bleeding','blinded','burning','staggered','toppled'];
export const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Imported prose is plain text, never template code or arbitrary HTML.
export const prose = text => text ? `<p>${escapeHtml(text).replace(/\r\n|\r|\n/g, '<br>')}</p>` : '';
const rows = (list, rich = []) => Object.fromEntries(list.map((item, index) => [String(index),
  Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'id').map(([key, value]) => [key, rich.includes(key) ? prose(value) : value]))]));

export function characterProps(input) {
  const c = normalizeCharacter(input), p = {};
  for (const key of ['player','motto','lineage','pastLife','calling','crafts','level','xp','keyAttribute','coins']) p[key] = c[key];
  for (const key of ['features','notes','plights']) p[key] = prose(c[key]);
  for (const [key, value] of Object.entries(c.attributes)) p[`attr_${key}`] = value;
  for (const [key, value] of Object.entries(c.resources)) p[`res_${key}`] = value;
  for (const [key, value] of Object.entries(c.bonuses)) p[`bonus_${key}`] = value;
  for (const key of c.trained) p[`trained_${key}`] = true;
  for (const key of c.plightSelections) p[`plight_${key}`] = true;
  c.alignments.forEach((item, i) => Object.entries(item).forEach(([key, value]) => { p[`alignment_${i}_${key}`] = value; }));
  c.injuries.forEach((item, i) => Object.entries(item).forEach(([key, value]) => { p[`injury_${i}_${key}`] = value; }));
  c.weapons.forEach((item, i) => Object.entries(item).forEach(([key, value]) => { p[`weapon_${i}_${key}`] = value; }));
  c.armor.forEach(item => Object.entries(item).filter(([key]) => key !== 'slot').forEach(([key, value]) => { p[`armor_${item.slot}_${key}`] = value; }));
  c.magicItems.forEach(item => Object.entries(item).filter(([key]) => key !== 'slot').forEach(([key, value]) => { p[`magic_${item.slot}_${key}`] = key === 'effect' ? prose(value) : value; }));
  for (const key of STANDARD_STATES) p[`state_${key}`] = c.states[key] || 0;
  p.otherStates = rows(Object.entries(c.states).filter(([key]) => !STANDARD_STATES.includes(key)).map(([name,intensity]) => ({name,intensity})));
  p.inventory = rows(c.inventory, ['notes']);
  p.deeds = rows(c.deeds, ['description']);
  return p;
}

export function havenProps(input) {
  const h = normalizeHaven(input), p = {};
  for (const key of ['leadership','location','level','partyLevel','populationRank','populationMode','wealth','mercenaryLevel']) p[key] = h[key];
  for (const key of ['arrivals','storedItems','notes']) p[key] = prose(h[key]);
  for (const [key,value] of Object.entries(h.attributes)) p[`attr_${key}`] = value;
  for (const [key,value] of Object.entries(h.bonuses)) p[`bonus_${key}`] = value;
  for (const key of h.trained) p[`trained_${key}`] = true;
  for (const [key,value] of Object.entries(h.event)) p[`event_${key}`] = key === 'notes' ? prose(value) : value;
  for (const [key,value] of Object.entries(h.hirelings)) p[`hireling_${key}`] = value;
  for (const [key,value] of Object.entries(h.hirelingRates)) p[`rate_${key}`] = value;
  for (const key of ['builds','projects','finishedBuildings','strongholds','productionChains']) p[key] = rows(h[key], ['notes']);
  return p;
}

export function parseExport(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error('JSON muito grande / JSON too large (4 MB).');
  const data = JSON.parse(text);
  if (!data || data.version !== 1 || data.rules !== '2.1.3') throw new Error('Use o JSON exportado pela ficha Trespasser v2.1.3 / Use a Trespasser v2.1.3 export.');
  if (data.format === 'trespasser-character') return {kind:'character', record:normalizeCharacter(data.character)};
  if (data.format === 'trespasser-haven') return {kind:'haven', record:normalizeHaven(data.haven)};
  throw new Error('Formato de ficha não reconhecido / Unrecognized record format.');
}

export function blankRecord(kind) { return kind === 'haven' ? createHaven() : createCharacter(); }
export function buildActorData(record, template) {
  const meta = template.flags?.[MODULE_ID];
  if (!meta || !['character','haven'].includes(meta.kind) || template.type !== '_template' || !template._id) throw new Error('Template Trespasser inválido / Invalid Trespasser template.');
  const kind = meta.kind;
  const c = kind === 'haven' ? normalizeHaven(record) : normalizeCharacter(record);
  return {
    name:c.name || (kind === 'haven' ? 'Refúgio / Haven' : 'Personagem / Character'), type:'character',
    img:kind === 'haven' ? 'icons/svg/castle.svg' : 'icons/svg/mystery-man.svg',
    system:{...structuredClone(template.system), template:template._id, props:kind === 'haven' ? havenProps(c) : characterProps(c)},
    flags:{[MODULE_ID]:{kind,locale:meta.locale,revision:REVISION,sourceId:c.id}},
    prototypeToken:{actorLink:true, bar1:{attribute:kind === 'character' ? 'attributeBar.res_hp' : null}, bar2:{attribute:null}},
    ownership:{default:0},
  };
}
