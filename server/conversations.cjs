const {token,localClock}=require('./domain.cjs');
const council=require('./council.cjs');
const fail=(message,status=409)=>Object.assign(new Error(message),{status});
async function chat(store,uid,input){
 const text=String(input.message||'').trim();if(!text||text.length>6000)throw fail('1~6,000자로 입력해 주세요.',400);
 const id=input.id||token().slice(0,24),lease=token();let context;
 await store.mutate(s=>{const u=s.users[uid];u.conversations||={};const exists=u.conversations[id];if(input.id&&!exists)throw fail('대화를 찾을 수 없습니다.',404);const d=exists||{id,revision:0,messages:[],versions:[],createdAt:new Date().toISOString()};if(d.lease?.until>Date.now())throw fail('초안을 정리하고 있습니다.');if(d.runKey)throw fail('확정한 대화입니다. 새 대화로 시작해 주세요.');if((input.revision||0)!==d.revision)throw fail('다른 창에서 수정되었습니다. 새로고침해 주세요.');if(d.messages.length>=40)throw fail('이 대화는 20회까지 수정할 수 있습니다. 새 대화를 시작해 주세요.');const day=localClock(u.profile.timezone).date;u.chatUsage||={};if((u.chatUsage[day]||0)>=30)throw fail('오늘 대화 생성 30회를 모두 사용했습니다.',429);u.chatUsage[day]=(u.chatUsage[day]||0)+1;d.lease={id:lease,until:Date.now()+120000};u.conversations[id]=d;context={brief:{profile:u.profile,evidence:[{id:'profile',title:'내 관심과 역량'},{id:'conversation',title:'사용자가 설명한 구상'}]},previousDraft:d.pitch||null,messages:[...d.messages,{role:'user',text}]};});
 try{const result=await council.call('D',context);return await store.mutate(s=>{const d=s.users[uid].conversations[id];if(d.lease?.id!==lease)throw fail('초안 생성 상태가 변경되었습니다.');d.revision++;d.messages.push({role:'user',text},{role:'assistant',text:result.value.reply});d.pitch=result.value.pitch;d.versions.push({revision:d.revision,pitch:d.pitch,at:new Date().toISOString()});d.lease=null;return d;});}catch(e){await store.mutate(s=>{const d=s.users[uid].conversations[id];if(d.lease?.id===lease)d.lease=null;});throw e;}
}
function list(user){return Object.values(user.conversations||{}).map(({lease,...d})=>({...d,busy:!!(lease?.until>Date.now())})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
module.exports={chat,list};
