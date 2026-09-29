const { z } = require('zod');
const crypto = require('node:crypto');
const line = z.string().trim().min(1).max(500);
const PitchSchema = z.object({
  title: line.max(55), hook: line.max(140), genre: line.max(40),
  whyYou: z.array(line.max(180)).min(1).max(2),
  experience: z.array(line.max(130)).length(3),
  mvp: z.array(line.max(130)).min(1).max(3),
  excluded: z.array(line.max(90)).min(1).max(2),
  approach: z.array(line.max(160)).min(1).max(3),
  firstExperiment: z.object({ action: line.max(200), minutes: z.number().int().min(10).max(120), success: line.max(130), change: line.max(130) }),
  opportunity: line.max(170), objection: line.max(170), decision: line.max(170),
  unknowns: z.array(line.max(130)).min(1).max(3),
  sourceIds: z.array(z.string().max(100)).max(5),
});
const ProfileSchema = z.object({
  name: z.string().trim().min(1).max(40), interests: z.string().max(3000),
  skills: z.string().max(2000), projects: z.string().max(3000), exclusions: z.string().max(1500),
  weeklyMinutes: z.number().int().min(0).max(10080).nullable(),
  timezone: z.string().refine(v => {try {new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}}),
  deliveryTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  mode: z.enum(['discover','deepen_existing']), automatic: z.boolean(),
});
const defaults = name => ({name, interests:'',skills:'',projects:'',exclusions:'',weeklyMinutes:null,timezone:'Asia/Seoul',deliveryTime:'09:00',mode:'discover',automatic:false});
const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const token = () => crypto.randomBytes(32).toString('base64url');
function localClock(timezone, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}
function validatePitch(raw, sourceIds = []) {
  const pitch = PitchSchema.parse(raw);
  if (pitch.sourceIds.some(s=>!sourceIds.includes(s))) throw new Error('UNKNOWN_SOURCE');
  if (JSON.stringify(pitch).length > 2450) throw new Error('PITCH_TOO_LONG');
  return pitch;
}
function markdown(p, owner='unassigned') {
  const q = value => JSON.stringify(value);
  return `---\nschema_version: "1.0"\ntitle: ${q(p.title)}\nproject_id: null\nbase_revision: null\nkind: exploration\ndomain: [${q(p.genre)}]\nowner: ${owner}\npace: relaxed\npriority: normal\ntimezone: ${p.timezone||'Asia/Seoul'}\nstart_after: null\ntarget_date: null\ntarget_kind: none\nvisibility: private\ncapacity_hours_per_week:\n  member_a: null\n  member_b: null\nrelated_project_ids: []\n---\n\n## 하려는 일\n${p.hook}\n\n## 현재 상태\n미착수. IDEA VAULT ${p.issueDate} 제안에서 가져온 초안.\n\n## 제약과 가용 시간\n담당과 가용 시간은 아직 정하지 않았습니다. 첫 실험의 제한 시간은 ${p.firstExperiment.minutes}분입니다.\n\n## 끝났다고 볼 기준\n- ${p.firstExperiment.success}\n- 결과와 다음 판단을 기록하기\n\n## 원하는 도움과 이번에 하지 않을 것\n첫 행동: ${p.firstExperiment.action}\n변경/중단 기준: ${p.firstExperiment.change}\n이번에 제외: ${p.excluded.join(', ')}\n\n## 자료와 관련 작업\n출처: IDEA VAULT ${p.id}, revision ${p.revision||1}\n${(p.evidence||[]).map(e=>`- ${e.title}: ${e.url||'내 관심 기록'} (${e.status})`).join('\n')}\n`;
}
module.exports = {PitchSchema,ProfileSchema,defaults,hash,token,localClock,validatePitch,markdown};
