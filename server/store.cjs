const REPO = process.env.VAULT_DATA_REPO || 'hey24blanket/markov-blanket-data';
const BRANCH = process.env.VAULT_DATA_BRANCH || 'main';
class GitHubStore {
  constructor(){this.token=process.env.GITHUB_ACCESS_TOKEN;}
  async request(path,opts={}) {
    if(!this.token) throw Object.assign(new Error('STORAGE_NOT_CONFIGURED'),{status:503});
    const r=await fetch(`https://api.github.com/repos/${REPO}${path}`,{...opts,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${this.token}`,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',...opts.headers},signal:AbortSignal.timeout(15000)});
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw Object.assign(new Error(`STORAGE_${r.status}`),{status:r.status===404?503:502,upstream:r.status});
    return data;
  }
  async assertPrivate(){const r=await this.request('');if(!r.private)throw Object.assign(new Error('STORAGE_MUST_BE_PRIVATE'),{status:503});}
  async read(path){
    try { const d=await this.request(`/contents/${path}?ref=${encodeURIComponent(BRANCH)}`);if(!d.content)throw new Error('STORAGE_CONTENT_UNAVAILABLE');return {sha:d.sha,value:JSON.parse(Buffer.from(d.content.replace(/\n/g,''),'base64').toString())}; }
    catch(e){if(e.upstream===404)return null;throw e;}
  }
  async write(path,value,sha){return this.request(`/contents/${path}`,{method:'PUT',body:JSON.stringify({message:`Update ${path.split('/')[0]}`,branch:BRANCH,content:Buffer.from(JSON.stringify(value)).toString('base64'),...(sha?{sha}:{})})});}
  async mutate(fn){
    for(let i=0;i<5;i++){
      const current=await this.read('state.json');
      if(!current)throw Object.assign(new Error('SETUP_REQUIRED'),{status:503});
      const state=current.value;
      const result=fn(state);
      try{await this.write('state.json',state,current.sha);return result;}catch(e){if(![409,422].includes(e.upstream)||i===4)throw e;}
    }
  }
  async state(){const d=await this.read('state.json');if(!d)throw Object.assign(new Error('SETUP_REQUIRED'),{status:503});return d.value;}
  async savePitch(uid,pitch){
    const path=`pitches/${uid}/${pitch.runKey||pitch.issueDate}.json`;
    const current=await this.read(path);
    if(current && current.value.contentHash!==pitch.contentHash)throw new Error('PITCH_ALREADY_PUBLISHED');
    if(!current)await this.write(path,pitch);
    return current?.value||pitch;
  }
  async pitch(uid,date){return (await this.read(`pitches/${uid}/${date}.json`))?.value||null;}
}
module.exports={GitHubStore};
