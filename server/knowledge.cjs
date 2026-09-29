const {z}=require('zod');
const taxonomy=require('./taxonomy.json');
const {hash}=require('./domain.cjs');
const rag=require('./rag-client.cjs');
const CE='https://chunking-express-git-build-foundation-blanket2.vercel.app';
const ids=new Set(taxonomy.domains.flatMap(d=>[d.id,...d.topics.map(t=>t.id)]));
const Selection=z.object({categoryIds:z.array(z.string().refine(x=>ids.has(x)||/^cat:[A-Za-z0-9_-]{1,1800}$/.test(x))).max(30),excludedIds:z.array(z.string().refine(x=>ids.has(x)||/^cat:[A-Za-z0-9_-]{1,1800}$/.test(x))).max(30),formats:z.array(z.enum(['software','interaction','animation','physical','life'])).max(5)});
const Document=z.object({id:z.string().min(1).max(100),title:z.string().min(1).max(300),text:z.string().min(1).max(18000),categoryIds:z.array(z.string().refine(x=>ids.has(x))).max(30),revision:z.number().int().positive(),sources:z.array(z.object({title:z.string().max(1000),url:z.string().max(2000).refine(x=>!x||/^https?:\/\//.test(x))})).max(30),reviewer:z.enum(['user','ai']),reviewedAt:z.string().datetime()});
const Bundle=z.object({schema:z.literal('markov-knowledge-v1'),documents:z.array(Document).max(300)});
function terms(s){return new Set((String(s).toLowerCase().match(/[\p{L}\p{N}]{2,}/gu)||[]).flatMap(w=>w.length>3?[w,...Array.from({length:w.length-1},(_,i)=>w.slice(i,i+2))]:[w]));}
function overlap(a,b){const x=terms(a),y=terms(b);return [...x].filter(v=>y.has(v)).length/Math.max(1,Math.sqrt(x.size*y.size));}
function matches(categories,selected){return categories.some(c=>selected.some(s=>c===s||c.startsWith(s+'.')||s.startsWith(c+'.')));}
async function publicKnowledge(user,store){
 const selection=user.exploration||{categoryIds:[],excludedIds:[],formats:[]};
 try{const live=await rag.request(store,user.id,{action:'inventory'});return {...live,selection};}
 catch{return {status:'unavailable',selection,categories:[],checkedAt:null};}
}
async function importKnowledge(store,uid,raw){const bundle=Bundle.parse(raw);if(new Set(bundle.documents.map(d=>d.id)).size!==bundle.documents.length)throw new Error('KNOWLEDGE_DUPLICATE_ID');const key=hash(JSON.stringify(bundle));const path=`knowledge/${uid}/${key}.json`;if(!await store.read(path))await store.write(path,bundle);await store.mutate(s=>{s.users[uid].knowledge={path,count:bundle.documents.length,updatedAt:new Date().toISOString(),version:key};});return {count:bundle.documents.length};}
async function retrieve(store,user,date){
 const selection=user.exploration||{categoryIds:[],excludedIds:[],formats:[]};
 const live=await rag.request(store,user.id,{action:'inventory'});
 const valid=new Set(live.categories.map(c=>c.id));
 const selected=selection.categoryIds.filter(x=>valid.has(x)),excluded=selection.excludedIds.filter(x=>valid.has(x));
 const used=(user.archive||[]).slice(-14).flatMap(p=>p.categoryIds||[]);
 const allowed=live.categories.filter(c=>c.searchable>0&&!excluded.includes(c.id)&&(!selected.length||selected.includes(c.id)||selected.includes(c.parentId))).filter(c=>!c.parentId||selected.includes(c.id));
 const focus=allowed.sort((a,b)=>used.filter(x=>x===a.id).length-used.filter(x=>x===b.id).length||hash(date+user.id+a.id).localeCompare(hash(date+user.id+b.id))).slice(0,2).map(c=>c.id);
 const query=[user.profile.interests,user.profile.skills,...live.categories.filter(c=>focus.includes(c.id)).map(c=>c.path.join(' '))].join(' ').slice(0,5000)||'새로운 창작과 인터랙션 아이디어';
 const result=await rag.request(store,user.id,{action:'search',query,categoryIds:selected.length?selected:focus,excludedIds:excluded});
 if(!result.results.length)throw Object.assign(new Error('RAG_NO_MATCH'),{status:409});
 return {focus,selection,knowledgeStatus:'connected',knowledgeVersion:result.version,observedAt:result.checkedAt,searchVerified:result.searchVerified,evidence:result.results.map(d=>({id:'rag:'+d.id,title:d.title,status:'firebase_active',observedAt:result.checkedAt,revision:d.revision,categoryIds:d.categoryIds,text:d.text,sources:d.sources}))};
}
module.exports={taxonomy,Selection,Bundle,publicKnowledge,importKnowledge,retrieve,overlap,matches};
