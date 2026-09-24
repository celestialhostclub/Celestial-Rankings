import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
for(const name of ['app.js','data.js','motion.js'])execFileSync(process.execPath,['--check',new URL('public/'+name,root).pathname]);
for(const name of ['index.html','styles.css','club-logo.png','arena-background.png','player-emblem.png'])readFileSync(new URL('public/'+name,root));
console.log('Site estático validado. Arquivos prontos em public/.');
if(process.argv.includes('--original')){
 const manifest=JSON.parse(readFileSync(new URL('source-manifest.json',root)));
 for(const [name,hash] of Object.entries(manifest.sha256))if(createHash('sha256').update(readFileSync(new URL(name,root))).digest('hex')!==hash)throw Error('Arquivo alterado: '+name);
 console.log('Todos os arquivos originais são idênticos à versão exportada.');
}
