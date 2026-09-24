import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.json':'application/json'};
const port=Number(process.env.PORT||3000);
createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let target=resolve(root,'.'+path);
  if(target!==resolve(root)&&!target.startsWith(resolve(root)+sep)){res.writeHead(403).end();return;}
  if((await stat(target)).isDirectory())target=resolve(target,'index.html');
  const bytes=await readFile(target);res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404).end('Não encontrado');}
}).listen(port,'127.0.0.1',()=>console.log(`Celestial Rankings: http://localhost:${port}`));
