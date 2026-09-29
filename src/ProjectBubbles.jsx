import React,{useEffect,useRef,useState} from 'react';
import {Pause,Play} from 'lucide-react';
import './project-bubbles.css';
export default function ProjectBubbles({projects,onSelect,tone,selecting=false,selectedIds=[],canSelect=()=>true}){
 const root=useRef(null),nodes=useRef(new Map()),bodies=useRef([]),drag=useRef(null),select=useRef(onSelect);
 const[paused,setPaused]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const pausedRef=useRef(paused);pausedRef.current=paused||selecting;
 select.current=onSelect;
 const signature=projects.map(p=>p.id).join('|');
 useEffect(()=>{
  const host=root.current;let width=0,height=0,frame=0,last=0;const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  function paint(){for(const b of bodies.current){const el=nodes.current.get(b.id);if(el){el.style.width=el.style.height=`${b.r*2}px`;el.style.fontSize=`${Math.max(11,Math.min(19,b.r*.24))}px`;el.style.transform=`translate3d(${b.x-b.r}px,${b.y-b.r}px,0)`;}}}
  function resize(){width=host.clientWidth;height=host.clientHeight;const n=projects.length,cols=Math.max(1,Math.ceil(Math.sqrt(n*width/height))),rows=Math.max(1,Math.ceil(n/cols));const cellW=width/cols,cellH=height/rows;const radius=Math.max(20,Math.min(90,cellW*.43,cellH*.43));bodies.current=projects.map((p,i)=>({id:p.id,x:(i%cols+.5)*cellW,y:(Math.floor(i/cols)+.5)*cellH,r:radius*(.88+(i%3)*.06),vx:Math.cos(i*2.4)*.55,vy:Math.sin(i*2.4+.5)*.55}));paint();}
  function tick(now){const dt=Math.min(2,(now-last)/16.67||1);last=now;
   if(!pausedRef.current&&!media.matches&&!document.hidden){const bs=bodies.current;
    for(const b of bs){if(drag.current?.id===b.id)continue;b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.x<b.r){b.x=b.r;b.vx=Math.abs(b.vx);}if(b.x>width-b.r){b.x=width-b.r;b.vx=-Math.abs(b.vx);}if(b.y<b.r){b.y=b.r;b.vy=Math.abs(b.vy);}if(b.y>height-b.r){b.y=height-b.r;b.vy=-Math.abs(b.vy);}}
    for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i],b=bs[j],dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||.001,min=a.r+b.r+3;if(dist>=min)continue;const nx=dx/dist,ny=dy/dist,over=(min-dist)/2;const heldA=drag.current?.id===a.id,heldB=drag.current?.id===b.id;if(!heldA){a.x-=nx*over;a.y-=ny*over;}if(!heldB){b.x+=nx*over;b.y+=ny*over;}const impulse=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;if(impulse>0){if(!heldA){a.vx-=impulse*nx;a.vy-=impulse*ny;}if(!heldB){b.vx+=impulse*nx;b.vy+=impulse*ny;}}}
    for(const b of bs){b.x=Math.max(b.r,Math.min(width-b.r,b.x));b.y=Math.max(b.r,Math.min(height-b.r,b.y));const speed=Math.hypot(b.vx,b.vy);if(speed>2){b.vx*=2/speed;b.vy*=2/speed;}}
    paint();
   }frame=requestAnimationFrame(tick);
  }
  const observer=new ResizeObserver(resize);observer.observe(host);resize();frame=requestAnimationFrame(tick);return()=>{observer.disconnect();cancelAnimationFrame(frame);drag.current=null;};
 },[signature]);
 function down(e,id){if(e.button!==0)return;const b=bodies.current.find(b=>b.id===id);if(!b)return;const rect=root.current.getBoundingClientRect();drag.current={id,x:e.clientX,y:e.clientY,dx:e.clientX-rect.left-b.x,dy:e.clientY-rect.top-b.y,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}
 function move(e){const d=drag.current;if(!d)return;const b=bodies.current.find(b=>b.id===d.id),rect=root.current.getBoundingClientRect();if(!b)return;if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>6)d.moved=true;b.x=Math.max(b.r,Math.min(rect.width-b.r,e.clientX-rect.left-d.dx));b.y=Math.max(b.r,Math.min(rect.height-b.r,e.clientY-rect.top-d.dy));nodes.current.get(b.id).style.transform=`translate3d(${b.x-b.r}px,${b.y-b.r}px,0)`;}
 function up(e){const d=drag.current;if(!d)return;drag.current=null;if(!d.moved)select.current(d.id);}
 return <section className="project-universe" aria-label="진행 중인 프로젝트"><div ref={root} className="project-bubble-field">{projects.map((p,i)=><button key={p.id} ref={el=>{if(el)nodes.current.set(p.id,el);else nodes.current.delete(p.id);}} className={`project-bubble ${tone(p.owner)} shade-${i%4} ${selectedIds.includes(p.id)?'is-selected':''}`} disabled={selecting&&!canSelect(p)} aria-pressed={selecting?selectedIds.includes(p.id):undefined} aria-label={`${p.title} ${selecting?'선택':'프로젝트 열기'}`} title={p.title} onPointerDown={e=>down(e,p.id)} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{drag.current=null;}} onClick={e=>{if(e.detail===0)onSelect(p.id);}}><span>{p.title}</span></button>)}</div>{!projects.length&&<p className="bubble-empty">진행 중인 프로젝트가 없어요.</p>}{projects.length>0&&<button className="bubble-motion" aria-label={paused?'공 움직이기':'공 움직임 멈추기'} aria-pressed={paused} onClick={()=>setPaused(p=>!p)}>{paused?<Play size={17}/>:<Pause size={17}/>}</button>}</section>;
}
