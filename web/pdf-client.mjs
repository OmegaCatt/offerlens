export async function importPdf(file){
  if(!file||file.size>2_000_000||!file.name.toLowerCase().endsWith('.pdf'))throw Error('Vyberte textové PDF do 2 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  const response=await fetch('/api/pdf',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({filename:file.name,data:btoa(binary)})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'PDF nelze načíst.');return result;
}
export function sourceLocation(raw,quote){
  const index=raw.indexOf(quote);if(index<0||!quote)return '';
  return [...raw.slice(0,index).matchAll(/^\[(Strana \d+)\]$/gm)].at(-1)?.[1]||'';
}
