const {z}=require('zod');
const taxonomy=require('./taxonomy.json');
const {hash}=require('./domain.cjs');
const CE='https://chunking-express-git-build-foundation-blanket2.vercel.app';
const ids=new Set(taxonomy.domains.flatMap(d=>[d.id,...d.topics.map(t=>t.id)]));
const Selection=z.object({categoryIds:z.array(z.string().refine(x=>ids.has(x))).max(30),excludedIds:z.array(z.string().refine(x=>ids.has(x))).max(30),formats:z.array(z.enum(['software','interaction','animation','physical','life'])).max(5)});
const Document=z.object({id:z.string().min(1).max(100),title:z.string().min(1).max(300),text:z.string().min(1).max(18000),categoryIds:z.array(z.string().refine(x=>ids.has(x))).max(30),revision:z.number().int().positive(),sources:z.array(z.object({title:z.string().max(1000),url:z.string().max(2000).refine(x=>!x||/^https?:\/\//.test(x))})).max(30),reviewer:z.enum(['user','ai']),reviewedAt:z.string().datetime()});
const Bundle=z.object({schema:z.literal('markov-knowledge-v1'),documents:z.array(Document).max(300)});
function terms(s){return new Set((String(s).toLowerCase().match(/[\p{L}\p{N}]{2,}/gu)||[]).flatMap(w=>w.length>3?[w,...Array.from({length:w.length-1},(_,i)=>w.slice(i,i+2))]:[w]));}
function overlap(a,b){const x=terms(a),y=terms(b);return [...x].filter(v=>y.has(v)).length/Math.max(1,Math.sqrt(x.size*y.size));}
function matches(categories,selected){return categories.some(c=>selected.some(s=>c===s||c.startsWith(s+'.')||s.startsWith(c+'.')));}
function publicKnowledge(user){return {taxonomy,selection:user.exploration||{categoryIds:[],excludedIds:[],formats:[]},count:user.knowledge?.count||0,updatedAt:user.knowledge?.updatedAt||null,source:CE};}
async function importKnowledge(store,uid,raw){const bundle=Bundle.parse(raw);if(new Set(bundle.documents.map(d=>d.id)).size!==bundle.documents.length)throw new Error('KNOWLEDGE_DUPLICATE_ID');const key=hash(JSON.stringify(bundle));const path=`knowledge/${uid}/${key}.json`;if(!await store.read(path))await store.write(path,bundle);await store.mutate(s=>{s.users[uid].knowledge={path,count:bundle.documents.length,updatedAt:new Date().toISOString(),version:key};});return {count:bundle.documents.length};}
async function retrieve(store,user,date){
 const selection=user.exploration||{categoryIds:[],excludedIds:[],formats:[]};
 const allowed=taxonomy.domains.filter(d=>!selection.excludedIds.includes(d.id)&&(!selection.categoryIds.length||matches([d.id],selection.categoryIds)));
 const used=user.archive.slice(-14).flatMap(p=>p.categoryIds||[]);
 const ranked=allowed.map(d=>({d,n:used.filter(x=>x===d.id||x.startsWith(d.id+'.')).length,tie:hash(date+user.id+d.id)})).sort((a,b)=>a.n-b.n||a.tie.localeCompare(b.tie));
 const focus=ranked.slice(0,2).map(x=>x.d.id);
 const documents=user.knowledge?(await store.read(user.knowledge.path))?.value.documents||[]:[];
 const query=[user.profile.interests,user.profile.skills,...focus.map(id=>taxonomy.domains.find(d=>d.id===id)?.name)].join(' ');
 const candidates=documents.filter(d=>!matches(d.categoryIds,selection.excludedIds)&&(!selection.categoryIds.length||matches(d.categoryIds,selection.categoryIds)));
 const ordered=candidates.map(d=>({d,score:overlap(query,d.title+' '+d.text)+(matches(d.categoryIds,focus)?.3:0)})).sort((a,b)=>b.score-a.score);
 const selected=[];const counts={};for(const {d}of ordered){const cat=d.categoryIds[0]||'unknown';if((counts[cat]||0)>=2||selected.reduce((n,x)=>n+x.text.length,0)+d.text.length>32000)continue;selected.push(d);counts[cat]=(counts[cat]||0)+1;if(selected.length===4)break;}
 return {focus,selection,knowledgeStatus:documents.length?'connected':'not_connected',knowledgeVersion:user.knowledge?.version||null,evidence:selected.map(d=>({id:'rag:'+d.id,title:d.title,status:'imported_approved',observedAt:d.reviewedAt,revision:d.revision,reviewer:d.reviewer,categoryIds:d.categoryIds,text:d.text,sources:d.sources}))};
}
module.exports={taxonomy,Selection,Bundle,publicKnowledge,importKnowledge,retrieve,overlap,matches};
