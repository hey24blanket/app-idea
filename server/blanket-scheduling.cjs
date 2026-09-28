const {z}=require('zod');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v,'날짜를 확인해 주세요.');
function workload(state,user){
 const rows=Object.values(state.projects||{}).filter(p=>p.workspaceId===user.workspaceId&&(p.creatorId===user.id||p.visibility==='shared')&&(p.owner===user.id||p.owner==='together')&&!p.archived&&p.milestones.some(m=>m.status!=='done')).map(p=>({id:p.id,title:p.title,weeklyMinutes:p.weeklyMinutes||0,together:p.owner==='together'}));
 const available=state.users[user.id].blanketCapacity??null;
 const allocated=rows.reduce((n,p)=>n+p.weeklyMinutes,0);
 return {available,allocated,over:available===null?null:Math.max(0,allocated-available),rows};
}
async function capacity(store,user,raw){const minutes=z.number().int().min(15).max(10080).parse(raw.weeklyMinutes);return store.mutate(s=>{s.users[user.id].blanketCapacity=minutes;return workload(s,user);});}
async function revise(store,user,raw){
 const v=z.object({projectId:z.string(),revision:z.number().int(),title:z.string().trim().min(1).max(100),weeklyMinutes:z.number().int().min(15).max(10080),pace:z.enum(['relaxed','focused']),startDate:day,targetDate:day.or(z.literal('')),archived:z.boolean()}).parse(raw);
 return store.mutate(s=>{const {project,assigned}=require('./blanket.cjs');const p=project(s,user,v.projectId);if(!assigned(p,user))throw fail('담당자 또는 만든 사람이 수정할 수 있습니다.',403);if(p.revision!==v.revision)throw fail('다른 기기에서 변경됐습니다. 다시 불러온 뒤 수정해 주세요.',409);
 const previous={at:new Date().toISOString(),actorId:user.id,title:p.title,weeklyMinutes:p.weeklyMinutes,pace:p.pace,startDate:p.startDate,targetDate:p.targetDate,archived:!!p.archived,dates:p.milestones.map(m=>({id:m.id,due:m.due}))};
 // Existing effort estimates already include calibration. Do not multiply them again.
 const usable=v.weeklyMinutes*(v.pace==='relaxed'?.75:1);let minutes=0;
 for(const m of p.milestones){if(m.status==='done')continue;minutes+=m.minutes;const days=Math.max(0,Math.ceil(minutes/usable*7)-1);m.due=new Date(Date.parse(v.startDate+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);}
 Object.assign(p,{title:v.title,weeklyMinutes:v.weeklyMinutes,pace:v.pace,startDate:v.startDate,targetDate:v.targetDate,archived:v.archived});p.scheduleHistory=[...(p.scheduleHistory||[]),previous].slice(-20);p.revision++;return p;
 });
}
module.exports={workload,capacity,revise};
