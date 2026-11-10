import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export function readPdf(input){
  if(!input||typeof input.filename!=='string'||!input.filename.toLowerCase().endsWith('.pdf')||typeof input.data!=='string'||input.data.length>2_666_668||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.data))throw Error('Neplatné PDF.');
  const data=Buffer.from(input.data,'base64');if(!data.length||data.length>2_000_000)throw Error('Limit PDF je 2 MB.');
  return new Promise((resolve,reject)=>{
    const env={...process.env,PYTHONIOENCODING:'utf-8'};for(const key of Object.keys(env))if(key.startsWith('OPENAI_'))delete env[key];
    const child=spawn(process.env.OFFERLENS_PYTHON||'python',[fileURLToPath(new URL('./document_text.py',import.meta.url)),input.filename],{env,windowsHide:true,stdio:['pipe','pipe','ignore']});
    let chunks=[],bytes=0,done=false;
    const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);if(error){child.kill();reject(error)}else resolve(result)};
    const timer=setTimeout(()=>finish(Error('Čtení PDF překročilo 15 sekund.')),15000);
    child.on('error',()=>finish(Error('Python pro PDF není dostupný.')));child.stdin.on('error',()=>{});
    child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>600_000)return finish(Error('Příliš velký text.'));chunks.push(chunk)});
    child.on('close',code=>{try{const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(code||typeof result.content!=='string'||result.content.length>8000||!Array.isArray(result.locators))throw Error('PDF musí mít text do 8 000 znaků; delší nabídku rozdělte bez ztráty podmínek.');finish(null,result)}catch(error){finish(error)}});
    child.stdin.end(data);
  });
}
