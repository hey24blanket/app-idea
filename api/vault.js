const {GitHubStore}=require('../server/store.cjs');
const auth=require('../server/auth.cjs');
const {ProfileSchema,localClock,markdown,token,hash}=require('../server/domain.cjs');
const jobs=require('../server/jobs.cjs');
const webpush=require('web-push');
const safeMessage={AUTH_REQUIRED:'로그인이 필요합니다.',LOGIN_FAILED:'아이디와 비밀번호를 확인해 주세요.',LOGIN_RATE_LIMIT:'로그인을 여러 번 시도했습니다. 15분 뒤 다시 시도해 주세요.',INVITE_INVALID:'초대 코드가 만료되었거나 이미 사용되었습니다.',INVALID_ACCOUNT:'아이디는 영문·숫자 3자 이상, 비밀번호는 12자 이상으로 입력해 주세요.',USERNAME_TAKEN:'이미 사용 중인 아이디입니다.',STORAGE_NOT_CONFIGURED:'서버 저장소 연결을 준비 중입니다.',SETUP_REQUIRED:'초기 계정 설정을 준비 중입니다.',MODEL_NOT_CONFIGURED:'AI 연결을 준비 중입니다.',PROFILE_REQUIRED:'먼저 관심 있는 것들을 적어 주세요.',RUN_BUSY:'이미 검토하고 있습니다. 잠시 후 이어집니다.',RUN_FAILED:'오늘 검토를 마치지 못했습니다. 기록은 보존되어 있습니다.',RETRY_LIMIT:'오늘의 재시도 한도에 도달했습니다.',DUPLICATE_PITCH:'이전 제안과 겹쳐 발행을 보류했습니다.',PITCH_TOO_LONG:'한 장 분량으로 편집하지 못해 발행을 보류했습니다.',MODEL_INVALID_JSON:'AI 응답 형식을 확인하지 못했습니다. 저장한 단계부터 다시 이어갑니다.'};
function body(req){if(typeof req.body==='string')return JSON.parse(req.body);return req.body||{};}
function safeUser(user){return {id:user.id,name:user.name,username:user.username,role:user.role,profile:user.profile,archive:user.archive,feedback:user.feedback,jobs:Object.fromEntries(Object.entries(user.jobs).map(([date,j])=>[date,{status:j.status,error:j.error?safeMessage[j.error]||'검토 중 문제가 생겼습니다.':null,stages:Object.keys(j.nodes),nextRetryAt:j.nextRetryAt}])),subscriptionCount:user.subscriptions.length};}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const action=String(req.query?.action||'session');
  try{
    if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
    if(req.method==='POST'){
      const origin=req.headers.origin;const host=req.headers['x-forwarded-host']||req.headers.host;
      if(!origin||new URL(origin).host!==host)return res.status(403).json({error:'ORIGIN_REJECTED'});
      if(Number(req.headers['content-length']||0)>40000)return res.status(413).json({error:'PAYLOAD_TOO_LARGE'});
    }
    const store=new GitHubStore();
    if(action==='status')return res.status(200).json({version:'1.0.0',storage:!!process.env.GITHUB_ACCESS_TOKEN,models:!!(process.env.OPENAI_API_KEY&&process.env.GEMINI_API_KEY),schedule:!!process.env.CRON_SECRET,push:!!(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY)});
    if(action==='cron'){
      if(!process.env.CRON_SECRET||req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).json({error:'UNAUTHORIZED'});
      await store.assertPrivate();return res.status(200).json(await jobs.tick(store));
    }
    await store.assertPrivate();
    const state=await store.state();
    if(['login','join'].includes(action)){
      if(req.method!=='POST')return res.status(405).end();
      return res.status(200).json(action==='login'?await auth.login(store,body(req),req,res):await auth.join(store,body(req),res));
    }
    const user=auth.authenticate(req,state),uid=user.id;
    if(action==='session')return res.status(200).json({user:safeUser(user),vapidPublicKey:process.env.VAPID_PUBLIC_KEY||null,today:localClock(user.profile.timezone).date,scheduleReady:!!process.env.CRON_SECRET});
    if(action==='pitch'){
      const date=String(req.query.date||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return res.status(400).json({error:'INVALID_DATE'});
      const pitch=await store.pitch(uid,date);if(!pitch)return res.status(404).json({error:'문서가 없습니다.'});
      if(req.query.format==='md'){res.setHeader('Content-Type','text/markdown; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="markov-${date}.md"`);return res.status(200).send(markdown(pitch));}
      return res.status(200).json({pitch});
    }
    if(req.method!=='POST')return res.status(405).end();const input=body(req);
    if(action==='logout'){await store.mutate(s=>{s.sessions=s.sessions.filter(v=>v.digest!==auth.hash(auth.cookie(req)));});res.setHeader('Set-Cookie','vault_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');return res.status(200).json({ok:true});}
    if(action==='profile'){
      const profile=ProfileSchema.parse(input);if(profile.automatic&&!process.env.CRON_SECRET)throw Object.assign(new Error('예약 실행 연결 후 자동 발행을 켤 수 있습니다.'),{status:409});
      await store.mutate(s=>{s.users[uid].profile=profile;s.users[uid].name=profile.name;});return res.status(200).json({ok:true});
    }
    if(action==='start')return res.status(200).json(await jobs.startRun(store,uid));
    if(action==='advance'){
      const date=String(input.date||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Object.assign(new Error('INVALID_DATE'),{status:400});
      return res.status(200).json(await jobs.advance(store,uid,date));
    }
    if(action==='feedback'){
      const {date,value}=input;if(!user.archive.some(p=>p.issueDate===date)||!['interested','try_small','later','not_for_me','too_much_now',''].includes(value))throw Object.assign(new Error('INVALID_FEEDBACK'),{status:400});
      await store.mutate(s=>{s.users[uid].feedback[date]={value,reason:String(input.reason||'').slice(0,500),updatedAt:new Date().toISOString()};});return res.status(200).json({ok:true});
    }
    if(action==='subscribe'){
      if(!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)throw Object.assign(new Error('알림 연결을 준비 중입니다.'),{status:503});
      const sub=input.subscription;if(!jobs.safePublicUrl(sub?.endpoint)||typeof sub?.keys?.p256dh!=='string'||typeof sub?.keys?.auth!=='string')throw Object.assign(new Error('INVALID_SUBSCRIPTION'),{status:400});
      await store.mutate(s=>{const u=s.users[uid];u.subscriptions=[...u.subscriptions.filter(v=>v.endpoint!==sub.endpoint),sub].slice(-3);});return res.status(200).json({ok:true});
    }
    if(action==='unsubscribe'){await store.mutate(s=>{s.users[uid].subscriptions=s.users[uid].subscriptions.filter(v=>v.endpoint!==input.endpoint);});return res.status(200).json({ok:true});}
    if(action==='invite'){
      if(user.role!=='owner')return res.status(403).json({error:'FORBIDDEN'});const invite=token();
      await store.mutate(s=>{s.invites=s.invites.filter(i=>i.expiresAt>Date.now()&&!i.usedAt);if(s.invites.length>=5)throw new Error('INVITE_LIMIT');s.invites.push({digest:hash(invite),role:'member',expiresAt:Date.now()+7*86400000});});return res.status(200).json({invite});
    }
    return res.status(404).json({error:'NOT_FOUND'});
  }catch(e){const status=e.status|| (e.name==='ZodError'?400:500);const message=safeMessage[e.message]||(e.message.startsWith('MODEL_')?'AI 연결에 문제가 생겼습니다. 저장한 검토 기록은 유지됩니다.':e.message.startsWith('STORAGE_')?'서버 저장소 연결을 확인하고 있습니다.':status<500?e.message:'처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');console.error('vault_request_failed',{action,code:e.message?.slice(0,90)});return res.status(status).json({error:message,code:e.message?.slice(0,90)});}
};
