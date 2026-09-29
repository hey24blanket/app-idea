const {z}=require('zod');
const {project,assigned}=require('./blanket.cjs');
async function remove(store,user,input){
 const items=z.array(z.object({id:z.string().min(1),revision:z.number().int()})).min(1).max(100).parse(input.projects);
 return store.mutate(s=>{
  // Validate the entire selection before deleting anything.
  for(const item of items){const p=project(s,user,item.id);if(!assigned(p,user))throw Object.assign(new Error('담당자 또는 만든 사람만 삭제할 수 있습니다.'),{status:403});if(p.revision!==item.revision)throw Object.assign(new Error('변경된 프로젝트가 있습니다. 새로고침 후 다시 선택해 주세요.'),{status:409});}
  for(const item of items)delete s.projects[item.id];
  return {deleted:items.map(p=>p.id)};
 });
}
module.exports={remove};
