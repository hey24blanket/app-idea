// Deliberately fictional review data. Stored separately from real projects.
const {localClock}=require('./domain.cjs');
function samples(user){
 const today=localClock(user.profile?.timezone||'Asia/Seoul').date;
 const start=new Date(today+'T00:00:00Z');start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7));
 const date=n=>new Date(start.getTime()+n*86400000).toISOString().slice(0,10);
 const rows=[
 ['사주그랩','상담 첫 답변 비교','앱',0,0,45,['같은 질문으로 답변 3개 수집','질문 이해·구체성·말투 비교'],'세 답변의 차이를 한 문장씩 적었나요?'],
 ['수채화 작은 연작','색 조합 3개 테스트','그림',1,0,30,['종이에 같은 형태를 세 번 그리기','서로 다른 녹색 조합 적용'],'마음에 드는 조합을 하나 골랐나요?'],
 ['가을 캠핑','저녁 메뉴 고르기','생활',2,1,25,['각자 먹고 싶은 메뉴 2개 적기','조리 시간과 도구를 보고 2개 선택'],'두 사람이 메뉴에 동의했나요?'],
 ['한글파파','학습 흐름 직접 써보기','앱',0,1,40,['학습 세트 하나를 처음부터 사용','막히는 화면을 캡처'],'막힌 지점과 수정 방향을 기록했나요?'],
 ['짧은 애니메이션','오프닝 6컷 그리기','영상',1,2,60,['시작과 마지막 장면을 정하기','사이 장면 4컷을 러프로 연결'],'소리 없이도 장면 흐름이 읽히나요?'],
 ['아이와 그림책','함께 읽을 책 고르기','가족',2,2,20,['각자 한 권씩 골라 표지 보기','아이에게 먼저 읽고 싶은 책 묻기'],'아이의 선택과 이유를 들어봤나요?'],
 ['인터랙션 아트','커서에 반응하는 점 실험','아트',0,3,60,['점 하나를 화면에 표시','커서 거리로 크기와 속도 조절'],'가까이·멀리 이동할 때 차이가 보이나요?'],
 ['주말 사진 산책','촬영 주제 정하기','사진',1,3,20,['빛·그림자·질감 중 한 주제 선택','산책 경로에 촬영 지점 3개 표시'],'주제와 경로가 정해졌나요?'],
 ['마코프 블랭킷','샘플 보드 함께 보기','함께',2,3,30,['각자 눈에 먼저 들어오는 작업 고르기','불편한 위치와 표현을 3개 메모'],'다음에 바꿀 우선순위 하나를 골랐나요?'],
 ['사운드 일기','주변 소리 3개 녹음','음악',0,4,25,['실내·거리·자연 소리를 짧게 녹음','파일 이름에 장소와 느낌 기록'],'서로 다른 소리 3개를 저장했나요?'],
 ['작은 굿즈','엽서 레이아웃 스케치','디자인',1,4,45,['그림 하나와 문장 하나 고르기','여백이 다른 레이아웃 2개 만들기'],'실제 엽서 크기로 비교했나요?'],
 ['캠핑 준비','공용 준비물 점검','생활',2,5,35,['집에 있는 장비 확인','없는 품목과 담당자만 적기'],'중복 구매 없이 준비 목록을 만들었나요?'],
 ['언리얼 첫 장면','작은 공간 한 개 만들기','게임',0,5,75,['바닥·벽·조명 하나씩 배치','카메라 높이와 이동 속도 조절'],'직접 걸어 다닐 수 있나요?'],
 ['작업실 정리','그림 재료 한 칸 정리','생활',1,6,20,['자주 쓰는 재료만 꺼내기','손이 닿는 한 칸에 다시 배치'],'다음 그림을 바로 시작할 수 있나요?'],
 ['우리의 한 주','이번 주의 점 돌아보기','함께',2,6,20,['각자 좋았던 일 하나 말하기','다음 주에 이어갈 일 하나 선택'],'다음 한 걸음을 함께 골랐나요?']
 ];
 const result=Object.fromEntries(rows.map((r,i)=>{const [title,task,category,who,day,minutes,steps,check]=r;const owner=[user.id,'sample-partner','together'][who];const done=i<3;const id=`sample-${i+1}`;return [id,{id,workspaceId:user.workspaceId,creatorId:user.id,visibility:who===0?'private':'shared',owner,title,category,summary:task,sample:true,stage:done?'done':i<9?'active':'waiting',weeklyMinutes:minutes,startDate:date(0),targetDate:date(day),pace:'focused',revision:1,assumptions:[],sourceMD:`# ${title}\n\n${task}\n\n체험용 샘플입니다.`,milestones:[{id:'m1',title:task,why:'이번 주에 끝낼 수 있는 작은 결과부터 만듭니다.',steps,minutes,checks:[check],ifStuck:'범위를 절반으로 줄여 10분만 시도해 보세요.',due:date(day),status:done?'done':'todo',completion:done?{actorId:owner==='together'?user.id:owner,answers:[true],note:'샘플 완료 기록입니다.',actualMinutes:minutes,completedAt:date(day)+'T09:00:00Z'}:null}]}];}));
 const papa=result['sample-4'];
 papa.milestones[0].stage='active';
 papa.milestones.push({id:'m2',title:'막힌 화면 한 곳 수정하기',why:'실제 사용에서 막힌 지점을 먼저 해결합니다.',steps:['앞 단계에서 남긴 캡처 하나를 고르기','수정 전후를 같은 흐름으로 비교하기'],minutes:45,checks:['같은 지점을 다시 통과할 수 있나요?'],ifStuck:'화면 한 곳과 동작 한 개만 수정해 보세요.',due:date(3),status:'todo',stage:'waiting',completion:null},{id:'m3',title:'다시 써보고 피드백 남기기',why:'수정이 실제 학습 흐름에 도움이 되었는지 확인합니다.',steps:['수정한 학습 세트를 처음부터 다시 사용하기','남은 불편과 다음 수정 한 가지를 기록하기'],minutes:25,checks:['수정 전후의 차이와 남은 문제를 기록했나요?'],ifStuck:'한 세트만 확인하고 나머지는 다음에 봐도 괜찮아요.',due:date(5),status:'todo',stage:'waiting',completion:null});
 return result;

}
async function seed(store,user,reset=false){return store.mutate(s=>{const u=s.users[user.id];if(!u.sampleInitialized||reset){u.sampleProjects=samples(user);u.sampleInitialized=true;}else if((u.sampleContextVersion||0)<2&&u.sampleProjects?.['sample-4']){const p=u.sampleProjects['sample-4'];const fresh=samples(user)['sample-4'];if(p.milestones.length===1){p.milestones.push(...fresh.milestones.slice(1));p.milestones[0].stage=p.milestones[0].stage||p.stage||'active';p.revision++;}}u.sampleContextVersion=2;return {ok:true};});}
async function clear(store,user){return store.mutate(s=>{s.users[user.id].sampleProjects={};s.users[user.id].sampleInitialized=true;return {ok:true};});}
function scoped(store,user){return {mutate:fn=>store.mutate(s=>{const virtual={...s,projects:s.users[user.id].sampleProjects||{}};const result=fn(virtual);s.users[user.id].sampleProjects=virtual.projects;return result;})};}
module.exports={samples,seed,clear,scoped};
