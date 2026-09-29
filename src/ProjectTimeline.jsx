import React,{useState} from 'react';
import {ChevronDown,ChevronRight,Check,ArrowUpRight} from 'lucide-react';
const DAY=86400000;
const stamp=d=>Date.parse(d+'T00:00:00Z');
export function segmentRange(p,m,index){
 const previous=p.milestones[index-1];
 const end=m.due;
 const candidate=index?previous?.due:p.startDate;
 const start=candidate&&candidate<=end?candidate:end;
 return {start,end};
}
export default function ProjectTimeline({projects,days,today,tone,ownerName,onSelect}){
 const[collapsed,setCollapsed]=useState({});const start=stamp(days[0]),end=stamp(days.at(-1));
 const todayIndex=days.indexOf(today);
 return <div className="project-timeline" style={{'--timeline-days':days.length}}><div className="timeline-head"><div><span>프로젝트 / 세그먼트</span></div><div className="timeline-dates">{days.map((d,i)=><span key={d} className={d===today?'today':''}>{days.length<=7?<><small>{['일','월','화','수','목','금','토'][new Date(stamp(d)).getUTCDay()]}</small>{Number(d.slice(8))}</>:i%7===0||d===today?Number(d.slice(8)):''}</span>)}</div></div>{projects.map(p=>{const done=p.milestones.filter(m=>m.status==='done').length;return <section key={p.id} className={`timeline-project ${tone(p.owner)}`}><div className="timeline-project-heading"><button aria-expanded={!collapsed[p.id]} onClick={()=>setCollapsed(s=>({...s,[p.id]:!s[p.id]}))}>{collapsed[p.id]?<ChevronRight size={13}/>:<ChevronDown size={13}/>}<span>{p.title}</span></button><span>{ownerName(p.owner)} · {done}/{p.milestones.length}</span></div>{!collapsed[p.id]&&p.milestones.map((m,i)=>{const range=segmentRange(p,m,i),a=stamp(range.start),b=stamp(range.end),visible=Number.isFinite(a)&&Number.isFinite(b)&&b>=start&&a<=end;const left=Math.max(0,(a-start)/DAY),right=Math.min(days.length,(b-start)/DAY+1);return <div className="timeline-row" key={m.id}><button className="timeline-label" onClick={()=>onSelect(p.id)} title={m.title}>{m.status==='done'?<Check size={12}/>:<span className="timeline-status-dot"/>}<span>{m.title}</span></button><div className="timeline-track">{todayIndex>=0&&<i className="timeline-today-line" style={{left:`${(todayIndex+.5)/days.length*100}%`}}/>}{visible?<button onClick={()=>onSelect(p.id)} className={`timeline-segment ${m.status==='done'?'complete':''}`} style={{left:`${left/days.length*100}%`,width:`${(right-left)/days.length*100}%`}} aria-label={`${p.title} · ${m.title} · ${range.start}부터 ${range.end}까지 계획`} title={`${m.title} · ${range.start} ~ ${range.end} · ${m.minutes}분`}><span>{m.status==='done'?<Check size={12}/>:<ArrowUpRight size={12}/>} {m.title}</span></button>:<span className="timeline-outside">{m.due?m.due.slice(5).replace('-','/'):'날짜 미정'}</span>}</div></div>;})}</section>;})}{!projects.length&&<p className="day-empty">표시할 프로젝트가 없어요.</p>}<div className="timeline-foot"><span><i/> 오늘</span><span>막대는 계획 범위 · 세그먼트를 눌러 기록 보기</span></div></div>;
}
