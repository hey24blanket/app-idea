const crypto=require('node:crypto');
const {promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt);
const {hash,token,defaults}=require('./domain.cjs');
const COOKIE='vault_session';
async function passwordHash(password,salt){return (await scrypt(password,salt,64)).toString('hex');}
function equal(a,b){const x=Buffer.from(a||'');const y=Buffer.from(b||'');return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function cookie(req){const cookies=String(req.headers.cookie||'').split(';').map(s=>s.trim());return cookies.find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';}
function authenticate(req,state){const digest=hash(cookie(req));const session=(state.sessions||[]).find(s=>s.digest===digest&&s.expiresAt>Date.now());if(!session)throw Object.assign(new Error('AUTH_REQUIRED'),{status:401});const u=state.users[session.uid];if(!u)throw Object.assign(new Error('AUTH_REQUIRED'),{status:401});return {...u,id:session.uid};}
function setSession(res,value){res.setHeader('Set-Cookie',`${COOKIE}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`);}
async function login(store,input,req,res){
  const username=String(input.username||'').trim().toLowerCase();const password=String(input.password||'');
  if(!/^[a-z0-9_-]{3,40}$/.test(username)||password.length>200)throw Object.assign(new Error('LOGIN_FAILED'),{status:401});
  const state=await store.state();const entry=Object.entries(state.users).find(([,u])=>u.username===username);const now=Date.now();
  const key=hash(username).slice(0,24);const failure=state.loginFailures?.[key];
  if(failure?.until>now)throw Object.assign(new Error('LOGIN_RATE_LIMIT'),{status:429});
  const candidate=await passwordHash(password,entry?.[1].salt||'constant-time-missing-user');
  if(!entry||!equal(candidate,entry[1].passwordHash)){
    await store.mutate(s=>{s.loginFailures ||= {};const f=s.loginFailures[key]||{count:0};f.count++;f.until=now+(f.count>=5?900000:0);s.loginFailures[key]=f;});
    throw Object.assign(new Error('LOGIN_FAILED'),{status:401});
  }
  const t=token();await store.mutate(s=>{s.sessions=(s.sessions||[]).filter(v=>v.expiresAt>now);s.sessions.push({uid:entry[0],digest:hash(t),expiresAt:now+30*86400000});s.sessions=s.sessions.slice(-30);delete s.loginFailures?.[key];});setSession(res,t);return {ok:true};
}
async function join(store,input,res){
  const username=String(input.username||'').trim().toLowerCase(),password=String(input.password||''),name=String(input.name||'').trim();
  if(!/^[a-z0-9_-]{3,40}$/.test(username)||password.length<12||password.length>200||!name||name.length>40)throw Object.assign(new Error('INVALID_ACCOUNT'),{status:400});
  const inviteHash=hash(String(input.invite||''));const salt=token();const ph=await passwordHash(password,salt);const session=token();const uid=crypto.randomUUID();
  await store.mutate(s=>{
    const invite=s.invites.find(i=>i.digest===inviteHash&&!i.usedAt&&i.expiresAt>Date.now());if(!invite)throw Object.assign(new Error('INVITE_INVALID'),{status:403});
    if(Object.values(s.users).some(u=>u.username===username))throw Object.assign(new Error('USERNAME_TAKEN'),{status:409});
    s.users[uid]={username,name,salt,passwordHash:ph,role:invite.role,workspaceId:s.workspaceId,profile:{...defaults(name),...(invite.profileSeed||{}),name,automatic:false},archive:[],feedback:{},jobs:{},subscriptions:[],createdAt:new Date().toISOString()};
    invite.usedAt=new Date().toISOString();s.sessions.push({uid,digest:hash(session),expiresAt:Date.now()+30*86400000});
  });setSession(res,session);return {ok:true};
}
module.exports={authenticate,login,join,cookie,hash,passwordHash};
