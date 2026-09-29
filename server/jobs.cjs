const {hash,token,localClock}=require('./domain.cjs');
const council=require('./council.cjs');
const webpush=require('web-push');
const knowledge=require('./knowledge.cjs');
function safePublicUrl(endpoint){try{const u=new URL(endpoint);return u.protocol==='https:'&&['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}}
function briefFor(user,date){
  const p=user.profile;const prior=user.archive.slice(-90).map(a=>({id:a.runKey||a.issueDate,title:a.title,hook:a.hook,genre:a.genre,concept:a.concept||null,categoryIds:a.categoryIds||[],feedback:user.feedback[a.runKey||a.issueDate]||null}));
  return {issueDate:date,profile:p,evidence:[{id:'profile',title:'내가 입력한 관심·역량·현재 작업',status:'user_provided',observedAt:new Date().toISOString()},{id:'history',title:'지난 제안에 남긴 명시적 반응',status:'user_provided',observedAt:new Date().toISOString()}],prior,policy:{noReactionIsNotRejection:true,laterIsTimingNotTaste:true,externalApiFacts:'unverified unless explicitly sourced',smallExperimentOnly:!p.weeklyMinutes}};
}
async function startRun(store,uid,input={}){
  const initial=await store.state(),u=initial.users[uid],date=localClock(u.profile.timezone).date;
  const draft=input.draftId?u.conversations?.[input.draftId]:null;
  if(input.draftId&&(!draft||draft.revision!==input.revision||!draft.pitch||draft.lease?.until>Date.now()))throw Object.assign(new Error('기획서 버전을 다시 확인해 주세요.'),{status:409});
  if(draft?.runKey)return {date:draft.runKey,status:u.jobs[draft.runKey].status};
  if(!draft&&u.jobs[date])return {date,status:u.jobs[date].status};
  const retrieved=await knowledge.retrieve(store,{...u,id:uid},date);
  const prior=await Promise.all(u.archive.slice(-20).map(async a=>{const p=store.pitch?await store.pitch(uid,a.runKey||a.issueDate):null;return {...a,concept:p?{hook:p.hook,experience:p.experience,mvp:p.mvp}:a.concept};}));
  const now=Date.now();return store.mutate(s=>{
    const u=s.users[uid],key=draft?`${date}--${draft.id}`:date;
    if(u.jobs[key])return {date:key,status:u.jobs[key].status};
    if(!draft&&!u.profile.interests.trim())throw Object.assign(new Error('PROFILE_REQUIRED'),{status:400});
    const liveDraft=draft?u.conversations?.[draft.id]:null;
    if(draft&&(!liveDraft||liveDraft.revision!==input.revision||liveDraft.lease?.until>Date.now()))throw Object.assign(new Error('기획서가 변경되었습니다. 다시 확인해 주세요.'),{status:409});
    u.usage ||= {};const month=date.slice(0,7);u.usage[month] ||= {runs:0,modelCalls:0};
    if(u.usage[month].runs>=62)throw Object.assign(new Error('MONTHLY_LIMIT'),{status:429});
    if(Object.keys(u.jobs).filter(k=>k.startsWith(date)).length>=6)throw Object.assign(new Error('DAILY_CALL_LIMIT'),{status:429});
    u.usage[month].runs++;
    const brief=briefFor({...u,archive:prior},date);
    brief.exploration={...retrieved,evidence:undefined};brief.evidence.push(...retrieved.evidence);
    brief.work=Object.values(s.projects||{}).filter(p=>p.workspaceId===u.workspaceId&&(p.creatorId===uid||p.visibility==='shared')&&!p.archivedAt).slice(0,12).map(p=>({title:p.title,owner:p.owner===uid?'me':p.owner==='together'?'together':'other',milestones:p.milestones.map(m=>({title:m.title,complete:!!m.completion,minutes:m.minutes}))}));
    if(draft){brief.approvedBrief={revision:draft.revision,pitch:draft.pitch,originalRequest:draft.messages[0]?.text};brief.evidence.push({id:'conversation',title:'확정한 대화 기획 v'+draft.revision,status:'user_confirmed'});liveDraft.runKey=key;liveDraft.approvedAt=new Date().toISOString();}
    u.jobs[key]={date,status:'queued',brief,nodes:{},attempts:{},createdAt:now,lease:null,nextRetryAt:0};
    return {date:key,status:'queued'};
  });
}
async function advance(store,uid,date){
  const lease=token();let job;
  await store.mutate(s=>{
    const j=s.users[uid]?.jobs[date];if(!j)throw Object.assign(new Error('RUN_NOT_FOUND'),{status:404});
    if(j.status==='published'){job=null;return;}
    if(j.status==='failed')throw Object.assign(new Error('RUN_FAILED'),{status:409});
    if(j.nextRetryAt>Date.now()||j.lease?.until>Date.now())throw Object.assign(new Error('RUN_BUSY'),{status:409});
    j.lease={id:lease,until:Date.now()+145000};j.status='running';job=structuredClone(j);
  });
  if(!job)return {status:'published'};
  const group=!job.nodes.A0||!job.nodes.B0?['A0','B0']:!job.nodes.A1||!job.nodes.B1?['A1','B1']:!job.nodes.F?['F']:['N'];
  const pending=group.filter(x=>!job.nodes[x]);
  try{
    for(const stage of pending){if((job.attempts[stage]||0)>=2)throw new Error('RETRY_LIMIT');}
    await store.mutate(s=>{const u=s.users[uid],j=u.jobs[date];if(j.lease?.id!==lease)throw new Error('LEASE_LOST');const used=Object.values(j.attempts).reduce((a,b)=>a+b,0);if(used+pending.length>10)throw new Error('DAILY_CALL_LIMIT');u.usage ||= {};u.usage[date.slice(0,7)] ||= {runs:1,modelCalls:0};if(u.usage[date.slice(0,7)].modelCalls+pending.length>620)throw new Error('MONTHLY_CALL_LIMIT');j.activeStages=pending;for(const stage of pending)j.attempts[stage]=(j.attempts[stage]||0)+1;u.usage[date.slice(0,7)].modelCalls+=pending.length;});
    const context={brief:job.brief,...(group[0]==='A1'?{A0:job.nodes.A0.value,B0:job.nodes.B0.value}:['F','N'].includes(group[0])?{...(group[0]==='N'?{finalPitch:job.nodes.F.value}:{}),...(job.noveltyRejection?{reviseBecause:job.noveltyRejection}:{}),A0:job.nodes.A0.value,B0:job.nodes.B0.value,A1:job.nodes.A1.value,B1:job.nodes.B1.value}:{})};
    const results=await Promise.allSettled(pending.map(async stage=>{
      const result=await council.call(stage,context);
      await store.mutate(s=>{const j=s.users[uid].jobs[date];if(j.lease?.id!==lease)throw new Error('LEASE_LOST');j.nodes[stage]=result;j.activeStages=(j.activeStages||[]).filter(x=>x!==stage);});
      return result;
    }));
    const error=results.find(r=>r.status==='rejected');if(error)throw error.reason;
    const state=await store.state();const complete=state.users[uid].jobs[date];
    if(complete.nodes.F&&complete.nodes.N){
      const gate=complete.nodes.N.value;
      if(gate.duplicate||!gate.preservesIntent){
        if((complete.attempts.F||0)>=2)throw new Error(gate.duplicate?'DUPLICATE_PITCH':'INTENT_MISMATCH');
        await store.mutate(s=>{const j=s.users[uid].jobs[date];j.noveltyRejection=gate.reason;j.lastGate=gate;delete j.nodes.F;delete j.nodes.N;j.lease=null;j.activeStages=[];j.status='queued';j.activeStages=[];});return {status:'queued',date};
      }
      const raw=complete.nodes.F.value;
      const signature=hash(raw.title.replace(/[\s\p{P}]/gu,'').toLowerCase());
      if(state.users[uid].archive.some(p=>p.signature===signature))throw new Error('DUPLICATE_PITCH');
      const pitch={...raw,id:`${uid}_${date}`,issueDate:job.date,runKey:date,novelty:complete.nodes.N.value,categoryIds:job.brief.exploration?.focus||[],timezone:job.brief.profile.timezone,revision:1,evidence:job.brief.evidence,contentHash:hash(JSON.stringify(raw)),publishedAt:new Date().toISOString(),council:complete.nodes};
      await store.savePitch(uid,pitch);
      await store.mutate(s=>{const u=s.users[uid];if(!u.archive.some(p=>(p.runKey||p.issueDate)===date))u.archive.push({issueDate:job.date,runKey:date,categoryIds:pitch.categoryIds,concept:{hook:pitch.hook,experience:pitch.experience,mvp:pitch.mvp},title:pitch.title,hook:pitch.hook,genre:pitch.genre,signature,publishedAt:pitch.publishedAt});const j=u.jobs[date];j.status='published';j.lease=null;j.error=null;j.notification={status:'pending',attempts:0};});
      return {status:'published',date};
    }
    await store.mutate(s=>{const j=s.users[uid].jobs[date];if(j.lease?.id===lease){j.lease=null;j.activeStages=[];j.status='queued';j.error=null;}});
    return {status:'queued',date};
  }catch(e){await store.mutate(s=>{const j=s.users[uid].jobs[date];if(j.lease?.id===lease){j.lease=null;j.activeStages=[];j.error=e.message;j.status=pending.some(x=>(j.attempts[x]||0)>=2)||['DUPLICATE_PITCH','INTENT_MISMATCH','DAILY_CALL_LIMIT','MONTHLY_CALL_LIMIT'].includes(e.message)?'failed':'retry';j.nextRetryAt=Date.now()+60000;}});throw e;}
}
async function sendPush(store,uid,date){
  const state=await store.state(),u=state.users[uid],j=u.jobs[date];if(!j||j.status!=='published'||j.notification?.status==='sent')return;
  if(localClock(u.profile.timezone).time<u.profile.deliveryTime)return;
  if(!u.subscriptions.length||!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)return;
  const claim=token();let permitted=false;
  await store.mutate(s=>{permitted=false;const n=s.users[uid].jobs[date].notification;if(n.status==='sent'||n.leaseUntil>Date.now()||n.attempts>=3||n.retryAt>Date.now())return;n.claim=claim;n.leaseUntil=Date.now()+90000;n.attempts++;permitted=true;});
  if(!permitted)return;
  if(!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)throw new Error('PUSH_NOT_CONFIGURED');
  webpush.setVapidDetails('https://app-idea-cyan-chi.vercel.app',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
  const expired=[];let success=0;
  for(const sub of u.subscriptions){if(!safePublicUrl(sub.endpoint))continue;try{await webpush.sendNotification(sub,JSON.stringify({title:'오늘의 제안이 도착했어요',body:'당신을 위한 한 장을 열어보세요.',url:`/?date=${date}`,tag:`pitch-${date}`}),{TTL:3600,timeout:15000});success++;}catch(e){if([404,410].includes(e.statusCode))expired.push(sub.endpoint);}}
  await store.mutate(s=>{const user=s.users[uid],n=user.jobs[date].notification;if(n.claim!==claim)return;user.subscriptions=user.subscriptions.filter(v=>!expired.includes(v.endpoint));n.status=success?'sent':'retry';n.providerAcceptedAt=success?new Date().toISOString():null;n.retryAt=Date.now()+300000;n.leaseUntil=0;});
}
async function tick(store){
  const state=await store.state();let processed=0;
  for(const [uid,u]of Object.entries(state.users)){
    if(!u.profile.automatic)continue;const clock=localClock(u.profile.timezone);const [h,m]=u.profile.deliveryTime.split(':').map(Number);const start=Math.max(0,h*60+m-60);const [ch,cm]=clock.time.split(':').map(Number);if(ch*60+cm<start)continue;
    try{const r=await startRun(store,uid);if(r.status!=='published')await advance(store,uid,r.date);await sendPush(store,uid,r.date);processed++;}catch(e){console.error('daily_stage_failed',{code:e.message});}
  }return {processed};
}
module.exports={startRun,advance,tick,sendPush,safePublicUrl,briefFor};
