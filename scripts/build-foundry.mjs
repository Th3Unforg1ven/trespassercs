import { mkdir, readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { makeTemplate } from '../foundry/src/templates.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const target=path.join(root,'output/foundry/trespasser-csb');
await mkdir(target,{recursive:true});
async function copy(from,to) {
  await mkdir(path.dirname(to),{recursive:true});
  await copyFile(from,to);
}
for(const name of ['bridge.mjs','templates.mjs','module.mjs']) await copy(path.join(root,'foundry/src',name),path.join(target,'src',name));
for(const name of ['model.js','portrait.js','haven-model.js'])await copy(path.join(root,'dist',name),path.join(target,'src/models',name));
for(const name of ['module.json','README.md'])await copy(path.join(root,'foundry',name),path.join(target,name));
await copy(path.join(root,'foundry/styles/trespasser.css'),path.join(target,'styles/trespasser.css'));
for(const name of ['PirataOne-Regular.ttf','PirataOne-OFL.txt','Lusitana-Regular.ttf','Lusitana-OFL.txt','IMFellEnglish-Italic.woff2','IMFellEnglish-OFL.txt'])await copy(path.join(root,'dist/assets/fonts',name),path.join(target,'assets/fonts',name));
await mkdir(path.join(target,'templates'),{recursive:true});
for(const locale of ['pt','en']) {
  const actors=['character','haven'].map((kind,i)=>{
    const template=makeTemplate(kind,locale);
    return {id:`tp${locale}${kind==='character'?'Character001':'Haven0000001'}`,type:template.type,name:template.name,data:template.system,flags:template.flags};
  });
  await writeFile(path.join(target,`templates/trespasser-${locale}.json`),JSON.stringify({isCustomSystemExport:true,actors,items:[]},null,2));
}
// Load the project's existing ZIP library; no install-time dependencies or network.
const context={setTimeout,clearTimeout,setImmediate,clearImmediate};
runInNewContext(await readFile(path.join(root,'dist/vendor/jszip.js'),'utf8'),context);
const zip=new context.JSZip();
async function pack(dir,relative='trespasser-csb'){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name),name=`${relative}/${entry.name}`;
    if(entry.isDirectory())await pack(file,name);else zip.file(name,(await readFile(file)).toString('base64'),{base64:true});
  }
}
await pack(target);
const zipPath=path.join(root,'output/foundry/trespasser-csb-0.1.0.zip');
await writeFile(zipPath,await zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6}}));
console.log(`Package: ${zipPath}`);
