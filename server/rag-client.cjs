const crypto=require('node:crypto');
const ISSUER='https://app-idea-git-build-daily-pitch-blanket2.vercel.app';
const TARGET='https://saju-grap.vercel.app/api/blanket-rag';
const PATH='integrations/sajugrap-signing.json';
async function key(store,create=false){
 let value=(await store.read(PATH))?.value;
 if(!value&&create){const pair=crypto.generateKeyPairSync('ed25519');const next={privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'}),publicKey:pair.publicKey.export({format:'jwk'})};try{await store.write(PATH,next);value=next;}catch(e){if(![409,422].includes(e.upstream))throw e;value=(await store.read(PATH))?.value;}}
 if(!value)throw new Error('RAG_KEY_NOT_READY');return value;
}
async function publicKey(store){return {key:(await key(store)).publicKey};}
async function request(store,uid,input){
 const k=await key(store,true),now=Math.floor(Date.now()/1000);
 const payload=Buffer.from(JSON.stringify({iss:ISSUER,aud:'sajugrap-rag',scope:'rag:read',sub:uid,iat:now,exp:now+60,jti:crypto.randomUUID(),body:crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex')})).toString('base64url');
 const signature=crypto.sign(null,Buffer.from(payload),k.privateKey).toString('base64url');
 const response=await fetch(TARGET,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${payload}.${signature}`},body:JSON.stringify(input),signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw new Error(`RAG_UPSTREAM_${response.status}`);return response.json();
}
module.exports={request,publicKey};
