const KEY='rotationIQ.v2', POS=[1,2,3,4,5], PN={1:'PG',2:'SG',3:'SF',4:'PF',5:'C'}, F={rep:{periods:4,sec:600},domestic:{periods:2,sec:1080}};
const DEFAULT=[['rodion','Rodion Prystupa',94,[4,5]],['jacob','Jacob Nguyen',36,[4,5]],['archer','Archer Kenny',16,[2,3]],['max','Max Payne',10,[2,3]],['bill','Bill Pham',20,[1,2,3,4]],['alvin','Alvin Chen',86,[1,2,3]],['ethan','Ethan Poon',90,[3,4]],['tom',"Thomas O'Sullivan",22,[1,2,3]],['tate','Tate Power',72,[2,3,4]]];
let state=load(),undoStack=[],redoStack=[],filter='all';
if(!state.plan)state.plan='balanced'; if(!state.tactic)state.tactic='balanced'; if(!state.chemistry)state.chemistry={}; if(!state.opponent)state.opponent={press:false,zone:false,scoring:false,rebound:false,shooting:false,ballhandling:false};
function fresh(){return {mode:'rep',period:1,remaining:600,running:false,team:0,opp:0,lineup:{1:'alvin',2:'tom',3:'archer',4:'ethan',5:'rodion'},roster:DEFAULT.map(x=>({id:x[0],name:x[1],number:x[2],positions:x[3],hot:false,rest:false,foul:false,on:0,stint:0,restSec:0})),timeline:[],timeouts:[],plan:'balanced',tactic:'balanced',chemistry:{},opponent:{press:false,zone:false,scoring:false,rebound:false,shooting:false,ballhandling:false}}}
function load(){try{let x=JSON.parse(localStorage.getItem(KEY));if(!x)return fresh();let base=fresh();x.roster=(x.roster||base.roster).map((p0,i)=>{let d=DEFAULT.find(d=>d[0]===p0.id)||DEFAULT[i];return {...p0,name:(!p0.name||p0.name===d?.[1]?.split(' ')[0])?d?.[1]:p0.name,number:p0.number??d?.[2]??'',positions:p0.positions||d?.[3]||[]}});return x}catch{return fresh()}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function fiveKey(lineup=state.lineup){return POS.map(pos=>lineup[pos]||'').join('|')}
function chemistryEntry(key){if(!state.chemistry[key])state.chemistry[key]={sec:0,net:0,events:0,stints:0};let e=state.chemistry[key];if(e.events==null)e.events=e.uses||0;if(e.stints==null)e.stints=0;return e}
function scoreBand(){let d=state.team-state.opp;return d>=6?'LEAD 6+':d>=3?'LEAD 3-5':d>=1?'LEAD 1-2':d<=-6?'TRAIL 6+':d<=-3?'TRAIL 3-5':d<=-1?'TRAIL 1-2':'TIED'}
function clockPhase(){let ratio=state.remaining/periodSec();return ratio>=.75?'START':ratio<=.25?'CLOSING':'MIDDLE'}
function gameContext(){return 'Q'+state.period+' · '+clockPhase()+' · '+scoreBand()}
function timeoutInsight(){
  let r=rec(),tactical=state.opponent&&Object.values(state.opponent).some(Boolean),d=state.team-state.opp,reasons=[];
  if(r)reasons.push(r.r[0]||('clean '+PN[r.pos]+' rotation'));
  if(state.roster.some(x=>x.hot&&!court(x.id)))reasons.push('HOT option available');
  if(state.roster.some(x=>x.foul&&court(x.id)))reasons.push('protect foul trouble');
  if(tactical)reasons.push('opponent tactical flags active');
  if(state.plan==='protect'&&d>0)reasons.push('protect the lead');
  if(state.plan==='chase'&&d<0)reasons.push('chase the game');
  return {r,reasons};
}
function callTimeout(){
  act(()=>{
    let x=timeoutInsight();
    state.timeouts=state.timeouts||[];
    state.timeouts.push({q:state.period,t:state.remaining,team:state.team,opp:state.opp,context:gameContext(),plan:state.plan,recommendation:x.r?{in:x.r.in,out:x.r.out,pos:x.r.pos,reasons:x.r.r.slice(0,4)}:null});
    if(state.timeouts.length>20)state.timeouts.shift();
  });
  toast('Timeout captured');
}
function renderTimeout(){
  let el=document.getElementById('timeoutBoard');if(!el)return;
  let x=timeoutInsight(),d=state.team-state.opp,hot=state.roster.filter(p=>p.hot).map(p=>p.name),foul=state.roster.filter(p=>p.foul&&court(p.id)).map(p=>p.name);
  let title=d>0?'Protect the lead':d<0?'Chase the game':'Set the next action';
  let detail=x.r?('Consider '+p(x.r.in).name+' for '+p(x.r.out).name+' at '+PN[x.r.pos]+'.'):'No clean positional change is required.';
  el.innerHTML='<div class="timeout-top"><div><span class="eyebrow">TIMEOUT · Q'+state.period+'</span><strong>'+tm(state.remaining)+' · '+state.team+'–'+state.opp+'</strong><small>'+gameContext()+'</small></div><button class="primary-btn" id="callTimeout">Capture timeout</button></div><div class="timeout-grid"><div><span>DECISION</span><strong>'+title+'</strong><small>'+detail+'</small></div><div><span>HOT</span><strong>'+(hot.length?hot.join(', '):'None')+'</strong><small>Use HOT tags as coach input.</small></div><div><span>FOUL</span><strong>'+(foul.length?foul.join(', '):'None')+'</strong><small>Protect players carrying foul tags.</small></div></div>';
  document.getElementById('callTimeout').onclick=callTimeout;
}

function contextKey(lineup=state.lineup){return fiveKey(lineup)+'||'+gameContext()}
function contextEntry(lineup=state.lineup){let key=contextKey(lineup);if(!state.chemistry[key])state.chemistry[key]={sec:0,net:0,events:0,stints:0,context:true};return state.chemistry[key]}
function contextBonus(lineup=state.lineup){let e=state.chemistry[contextKey(lineup)];if(!e||e.sec<45)return 0;return Math.max(-4,Math.min(4,e.net/5))}
function trackChemistry(seconds){
  if(seconds<=0)return;
  let e=chemistryEntry(fiveKey()); e.sec+=seconds;
  let ce=contextEntry(); ce.sec+=seconds;
}
function chemistryScore(lineup=state.lineup){
  let e=state.chemistry[fiveKey(lineup)]; if(!e||e.sec<30)return 0;
  return Math.max(-5,Math.min(5,e.net/5));
}
function chemistryBonus(lineup){
  let e=state.chemistry[fiveKey(lineup)];
  if(!e||e.sec<30)return 0;
  return Math.max(-5,Math.min(5,chemistryScore(lineup)*1.2));
}
function noteChemistry(lineup,reasons){
  let e=state.chemistry[fiveKey(lineup)];
  if(!e||e.sec<30)return;
  let b=chemistryBonus(lineup);
  if(b>=3)reasons.push('proven five-man unit');
  else if(b<=-3)reasons.push('chemistry warning');
  else if(b>0)reasons.push('building chemistry');
}
function chemistryLabel(lineup=state.lineup){
  let e=state.chemistry[fiveKey(lineup)];
  if(!e||e.sec<30)return {label:'NEW UNIT',cls:'new'};
  let score=chemistryScore(lineup);
  return score>=2?{label:'STRONG',cls:'strong'}:score<=-2?{label:'WATCH',cls:'watch'}:{label:'BUILDING',cls:'building'};
}
function snap(){return JSON.parse(JSON.stringify({...state,running:false}))}
function act(fn){undoStack.push(snap());if(undoStack.length>50)undoStack.shift();redoStack=[];fn();save();render()}
function undo(){if(!undoStack.length)return;redoStack.push(snap());state=undoStack.pop();save();render();toast('Undone')}
function redo(){if(!redoStack.length)return;undoStack.push(snap());state=redoStack.pop();save();render();toast('Redone')}
function p(id){return state.roster.find(x=>x.id===id)}
function court(id){return Object.values(state.lineup).includes(id)}
function tm(s){s=Math.max(0,Math.ceil(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function min(s){return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')}
function periodSec(){return F[state.mode].sec}
function structure(){let missing=POS.filter(x=>!state.lineup[x]),seen=new Set(),dupes=[],invalid=[];Object.values(state.lineup).forEach(id=>seen.has(id)?dupes.push(id):seen.add(id));POS.forEach(x=>{let q=p(state.lineup[x]);if(q&&!q.positions.includes(x))invalid.push(q.name+' at '+PN[x])});return {missing,dupes,invalid,clean:!missing.length&&!dupes.length&&!invalid.length}}
let timerFrame=null;
function tick(now){
  if(!state.running)return;
  const current=now||performance.now();
  if(state.lastTick==null)state.lastTick=current;
  const d=Math.max(0,Math.min(1,(current-state.lastTick)/1000));
  if(d>0){
    state.lastTick=current;
    state.remaining=Math.max(0,state.remaining-d);
    trackChemistry(d);
    state.roster.forEach(x=>court(x.id)?(x.on+=d,x.stint+=d):(x.restSec+=d));
    if(state.remaining<=0){state.remaining=0;state.running=false;state.lastTick=null;timerFrame=null;toast(state.period===F[state.mode].periods?'Final siren':'End of period');}
    render();
  }
  if(state.running){timerFrame=requestAnimationFrame(tick);}
}
function toggleClock(){
  if(state.remaining<=0&&state.period<F[state.mode].periods){nextQ();return;}
  if(state.running){
    tick(performance.now());
    state.running=false;
    state.lastTick=null;
    if(timerFrame)cancelAnimationFrame(timerFrame);
    timerFrame=null;
  }else{
    state.running=true;
    state.lastTick=performance.now();
    if(timerFrame)cancelAnimationFrame(timerFrame);
    timerFrame=requestAnimationFrame(tick);
  }
  save();
  render();
}
function nextQ(){if(state.period>=F[state.mode].periods)return;act(()=>{state.period++;state.remaining=periodSec();state.running=false;state.roster.forEach(x=>x.stint=0)})}
function opponentWeight(x){
  let o=state.opponent||{},s=0,r=[];
  if(o.press){
    if(x.positions.includes(1)) {s+=14;r.push('press-break ball handler')}
    if(x.positions.includes(2)||x.positions.includes(3)) {s+=5;r.push('pressure release')}
  }
  if(o.zone){
    if(x.hot)s+=12;
    if(x.positions.includes(2)||x.positions.includes(3)) {s+=10;r.push('zone spacing')}
    if(x.positions.includes(4)||x.positions.includes(5)) {s+=5;r.push('inside presence')}
  }
  if(o.scoring&&x.positions.includes(1)) {s+=7;r.push('defensive guard')}
  if(o.rebound&&(x.positions.includes(4)||x.positions.includes(5))) {s+=12;r.push('rebounding size')}
  if(o.shooting&&(x.positions.includes(2)||x.positions.includes(3))) {s+=10;r.push('perimeter defence')}
  if(o.ballhandling&&x.positions.includes(1)) {s+=9;r.push('ball pressure')}
  return {s,r};
}
function renderOpponent(){
  let el=document.getElementById('opponentBoard');if(!el)return;
  let labels={press:'Opponent press',zone:'Opponent zone',scoring:'Their scorer is hurting us',rebound:'We need defensive rebounding',shooting:'Protect the perimeter',ballhandling:'We need more ball pressure'};
  let active=Object.keys(labels).filter(k=>state.opponent[k]);
  el.innerHTML='<div class="opponent-summary"><span class="eyebrow">LIVE OPPONENT READ</span><strong>'+(active.length?active.length+' tactical flag'+(active.length===1?'':'s'):'No tactical flags')+'</strong><small>These inputs shape lineup suggestions without taking control away from the coach.</small></div>'+
    '<div class="opponent-grid">'+Object.entries(labels).map(([k,v])=>'<button class="opponent-flag '+(state.opponent[k]?'active':'')+'" data-opponent="'+k+'"><span>'+v+'</span><b>'+(state.opponent[k]?'ON':'OFF')+'</b></button>').join('')+'</div>';
}
function rec(){let best=null,avg=state.roster.reduce((a,x)=>a+x.on,0)/state.roster.length;state.roster.filter(x=>court(x.id)).forEach(out=>{POS.forEach(pos=>{if(state.lineup[pos]!==out.id)return;state.roster.filter(x=>!court(x.id)&&x.positions.includes(pos)).forEach(i=>{let s=0,r=[];if(i.hot){s+=20;r.push('HOT hand')}if(i.rest){s+=22;r.push('fresh')}if(out.rest){s+=30;r.push('REST requested')}if(out.foul){s+=24;r.push('foul protection')}if(out.hot)s-=45;if(Math.abs(i.on-out.on)>90){s+=12;r.push('minutes balance')}
if(state.plan==='hot'&&i.hot){s+=25;r.push('hot-hand plan')}if(state.plan==='hot'&&out.hot){s-=30;r.push('keep HOT player on court')}if(state.plan==='foul'&&out.foul){s+=18;r.push('foul plan')}if(state.plan==='protect'){if(i.foul)s-=18;if(i.on<avg)s+=7;r.push('workload protection')}if(state.plan==='chase'&&i.hot){s+=12;r.push('scoring option')}if(state.plan==='chase'&&i.on<avg)s+=5;let ow=opponentWeight(i);s+=ow.s;r.push(...ow.r);let projected={...state.lineup};projected[pos]=i.id;let cb=chemistryBonus(projected),xb=contextBonus(projected);if(cb){s+=cb;r.push(cb>=3?'proven five-man unit':cb<=-3?'chemistry warning':'building chemistry')}if(xb){s+=xb*1.5;r.push(xb>=2?'proven in this game state':xb<=-2?'state-specific warning':'works in this game state')}s+=Math.min(15,i.restSec/60*1.2)-Math.min(12,i.stint/60);if(!best||s>best.s)best={s,in:i.id,out:out.id,pos:pos,r:r}})})});return best}
function sub(outId,inId,pos,source){let o=p(outId),i=p(inId);if(!o||!i||!i.positions.includes(pos))return;state.lineup[pos]=inId;o.stint=0;i.stint=0;i.rest=false;chemistryEntry(fiveKey()).events++;chemistryEntry(fiveKey()).stints++;state.timeline.push({q:state.period,t:state.remaining,out:outId,in:inId,pos:pos,source:source||'Coach'});if(state.timeline.length>60)state.timeline.shift()}
function applyRec(){let r=rec();if(!r)return toast('No clean positional rotation');act(()=>sub(r.out,r.in,r.pos,'Coach assistant'))}
function manual(id){let i=p(id),best=null;i.positions.forEach(pos=>{if(!state.lineup[pos])return;let o=p(state.lineup[pos]),s=(o.rest?30:0)+(o.foul?20:0)-(o.hot?30:0)+Math.max(0,5-o.stint/60);if(!best||s>best.s)best={s,out:o.id,pos:pos}});if(!best)return toast('No safe positional replacement');act(()=>sub(best.out,id,best.pos,'Coach'))}
function status(id,k){act(()=>{let x=p(id);x[k]=!x[k];if(k==='rest'&&x.rest)x.stint=0})}
function score(team,d){
  act(()=>{
    let key=fiveKey(),e=chemistryEntry(key),ce=contextEntry();
    state[team==='team'?'team':'opp']=Math.max(0,state[team==='team'?'team':'opp']+d);
    e.net+=team==='team'?d:-d;e.events++;ce.net+=team==='team'?d:-d;ce.events++;
  })
}
function tacticalFive(){
  let best=null, avg=state.roster.reduce((a,x)=>a+x.on,0)/state.roster.length;
  let weights={balanced:0,offense:0,defense:0};
  function walk(pos,used,lineup,total){
    if(pos>5){if(!best||total>best.score)best={score:total,lineup:{...lineup}};return}
    state.roster.filter(x=>!used.has(x.id)&&x.positions.includes(pos)).forEach(x=>{
      let s=100;
      if(court(x.id))s+=8;
      if(x.hot)s+=22;
      if(x.foul)s-=45;
      if(x.rest)s-=30;
      if(x.on<avg)s+=4;
      if(state.tactic==='offense'){
        if(x.hot)s+=18;
        if(x.positions.includes(1)||x.positions.includes(2)||x.positions.includes(3))s+=8;
        if(x.on<avg)s+=4;
      }
      if(state.tactic==='defense'){
        if(x.foul)s-=20;
        if(x.positions.includes(1)||x.positions.includes(2))s+=8;
        if(x.on<avg)s+=6;
      }
      lineup[pos]=x.id;used.add(x.id);walk(pos+1,used,lineup,total+s);used.delete(x.id);delete lineup[pos];
    });
  }
  walk(1,new Set(),{},0); return best;
}
function applyTactical(){
  let t=tacticalFive(); if(!t)return toast('No valid tactical five is available');
  act(()=>{
    POS.forEach(pos=>{
      let next=t.lineup[pos],out=state.lineup[pos]; if(next===out)return;
      if(out&&p(out))p(out).stint=0;
      if(next&&p(next)){p(next).stint=0;p(next).rest=false}
      state.lineup[pos]=next;
      if(out&&next)state.timeline.push({q:state.period,t:state.remaining,out,in:next,pos,source:state.tactic==='offense'?'Offensive 5':'Defensive 5'});
    });
    if(state.timeline.length>60)state.timeline=state.timeline.slice(-60);
  });
  toast((state.tactic==='offense'?'Offensive':'Defensive')+' 5 applied');
}
function renderTactical(){
  let el=document.getElementById('tacticalFive'),t=tacticalFive(); if(!el)return;
  let label=state.tactic==='offense'?'Offensive 5':state.tactic==='defense'?'Defensive 5':'Balanced 5';
  if(!t){el.innerHTML='<div class="muted">No valid tactical five is available.</div>';return}
  let changed=POS.filter(pos=>state.lineup[pos]!==t.lineup[pos]).length;
  el.innerHTML='<div class="tactical-label">'+label+'</div>'+POS.map(pos=>'<div class="tactical-player"><span>'+PN[pos]+'</span><strong>'+p(t.lineup[pos]).name+'</strong>'+tags(p(t.lineup[pos]))+'</div>').join('')+
    '<div class="tactical-footer"><span>'+changed+' change'+(changed===1?'':'s')+' from current five</span><button class="secondary-btn" id="applyTactical">'+(state.tactic==='offense'?'Apply offensive 5':state.tactic==='defense'?'Apply defensive 5':'Apply balanced 5')+'</button></div>';
  document.getElementById('applyTactical').onclick=applyTactical;
}
function closingFive(){
  let best=null;
  function walk(pos,used,lineup,total){
    if(pos>5){if(!best||total>best.score)best={score:total,lineup:{...lineup}};return}
    state.roster.filter(x=>!used.has(x.id)&&x.positions.includes(pos)).forEach(x=>{
      let s=100;
      if(court(x.id))s+=8;
      if(x.hot){s+=25;if(state.plan==='hot'||state.plan==='chase')s+=15}
      if(x.foul)s-=40;
      if(x.rest)s-=25;
      s+=Math.min(15,x.restSec/60*1.5);
      if(state.plan==='protect'&&x.foul)s-=20;
      if(state.plan==='protect'&&x.on<state.roster.reduce((a,q)=>a+q.on,0)/state.roster.length)s+=5;
      if(state.plan==='chase'&&x.on<state.roster.reduce((a,q)=>a+q.on,0)/state.roster.length)s+=6;
      let projected={...lineup};projected[pos]=x.id;let partial=POS.slice(0,pos).every(q=>projected[q]);
      if(partial){let cb=chemistryBonus(projected);s+=cb;}
      lineup[pos]=x.id;used.add(x.id);walk(pos+1,used,lineup,total+s);used.delete(x.id);delete lineup[pos];
    });
  }
  walk(1,new Set(),{},0);
  return best;
}
function applyClosing(){
  let c=closingFive();
  if(!c)return toast('No valid closing five is available');
  act(()=>{
    POS.forEach(pos=>{
      let next=c.lineup[pos],out=state.lineup[pos];
      if(next===out)return;
      if(out&&p(out))p(out).stint=0;
      if(next&&p(next)){p(next).stint=0;p(next).rest=false}
      state.lineup[pos]=next;
      if(out&&next)state.timeline.push({q:state.period,t:state.remaining,out:out,in:next,pos:pos,source:'Closing five'});
    });
    if(state.timeline.length>60)state.timeline=state.timeline.slice(-60);
  });
  toast('Closing five applied');
}
function renderClosing(){
  let el=document.getElementById('closingFive'),c=closingFive();
  if(!el)return;
  if(!c){el.innerHTML='<div class="muted">No valid five-player positional combination is available.</div>';return}
  let changed=POS.filter(pos=>state.lineup[pos]!==c.lineup[pos]).length;
  el.innerHTML=POS.map(pos=>'<div class="closing-player"><span class="closing-pos">'+PN[pos]+'</span><strong>'+p(c.lineup[pos]).name+'</strong><span class="closing-tags">'+tags(p(c.lineup[pos]))+'</span></div>').join('')+
    '<div class="closing-footer"><span>'+changed+' change'+(changed===1?'':'s')+' from current five</span><button class="secondary-btn" id="applyClosing">Apply closing 5</button></div>';
  document.getElementById('applyClosing').onclick=applyClosing;
}
function plan(){document.querySelectorAll('#planSwitch button').forEach(b=>b.classList.toggle('active',b.dataset.plan===state.plan));let d=state.team-state.opp,txt={balanced:'Prioritise clean positional structure and sustainable minutes.',protect:'Protect the lead: favour workload balance and reduce unnecessary risk to players in foul trouble.',chase:'Chase the game: favour fresh players and tagged HOT options while keeping positional structure.',hot:'Hot hand: give explicit HOT tags extra weight, but never override the coach.',foul:'Foul trouble: protect players carrying a FOUL tag and use safe positional replacements.'}[state.plan];document.getElementById('planInsight').innerHTML='<strong>'+txt+'</strong><span>Score '+state.team+'–'+state.opp+' · '+(d>0?'leading by '+d:d<0?'trailing by '+Math.abs(d):'game level')+'</span>';let choices=[];let tempState=snap();for(let n=0;n<3;n++){let r=rec();if(!r)break;choices.push(r);state.lineup[r.pos]=r.in}state=tempState;document.getElementById('nextRotations').innerHTML=choices.length?choices.map((r,i)=>'<div class="next-rotation"><span class="next-number">'+(i+1)+'</span><div><strong>'+p(r.in).name+' for '+p(r.out).name+'</strong><small>'+PN[r.pos]+' · '+(r.r[0]||'structure preserved')+'</small></div></div>').join(''):'<div class="muted">No three-step positional plan is available yet.</div>'}
function coachNow(){
  let el=document.getElementById('coachNow');if(!el)return;
  let r=rec(),d=state.team-state.opp,clock=state.remaining,hotBench=state.roster.filter(x=>x.hot&&!court(x.id)),foulOn=state.roster.filter(x=>x.foul&&court(x.id)),long=state.roster.filter(x=>court(x.id)&&x.stint>=180);
  let title='Stay with the plan',detail='No urgent rotation signal. Coach control remains the final call.';
  if(hotBench.length){title='🔥 HOT player available';detail=hotBench[0].name+' is tagged HOT on the bench. Consider the next clean positional opportunity.';}
  else if(foulOn.length){title='⚠ Protect foul trouble';detail=foulOn.map(x=>x.name).join(', ')+' '+(foulOn.length===1?'is':'are')+' carrying a FOUL tag.';}
  else if(long.length){title='Manage a long stint';detail=long[0].name+' has been on for '+min(long[0].stint)+'. A fresh positional option may be due.';}
  else if(state.plan==='hot'&&r){title='Feed the hot hand';detail='Hot-hand plan is active. The engine will prefer HOT options without breaking positional structure.';}
  else if(state.plan==='protect'&&d>0){title='Protect the lead';detail='You lead by '+d+'. Workload balance and foul protection are weighted more heavily.';}
  else if(state.plan==='chase'&&d<0){title='Chase the game';detail='You trail by '+Math.abs(d)+'. Freshness and HOT options receive extra weight.';}
  else if(clock<90){title='Finish the period';detail='Less than 90 seconds remain. Think about your closing group and next stoppage.';}
  el.innerHTML='<div class="coach-now-title">'+title+'</div><div class="coach-now-detail">'+detail+'</div>';
}
function renderChemistry(){
  let el=document.getElementById('chemistryBoard');if(!el)return;
  let entries=Object.entries(state.chemistry).filter(([,e])=>e.sec>0&&!e.context).sort((a,b)=>b[1].sec-a[1].sec).slice(0,5);
  let current=chemistryEntry(fiveKey()),label=chemistryLabel(),currentNames=POS.map(pos=>p(state.lineup[pos])?.name||'Open').join(' · ');
  let rows=entries.map(([key,e])=>{let names=key.split('|').map(id=>p(id)?.name||'—').join(' · ');let score=e.net>0?'+'+e.net:String(e.net);return '<div class="chemistry-row"><div><strong>'+names+'</strong><small>'+min(e.sec)+' together · '+e.events+' events</small></div><span class="chemistry-net">'+score+'</span></div>'}).join('');
  el.innerHTML='<div class="chemistry-current"><div><span class="eyebrow">CURRENT FIVE</span><strong>'+currentNames+'</strong></div><span class="chemistry-badge '+label.cls+'">'+label.label+'</span></div>'+
    '<div class="chemistry-stat-grid"><div><small>TIME TOGETHER</small><strong>'+min(current.sec)+'</strong></div><div><small>NET SCORE</small><strong>'+(current.net>0?'+':'')+current.net+'</strong></div><div><small>EVENTS</small><strong>'+current.events+'</strong></div></div>'+
    '<div class="chemistry-list">'+(rows||'<div class="muted">Play the game and Rotation IQ will learn which five-man combinations are working.</div>')+'</div>';
}
function renderGameIntelligence(){let el=document.getElementById('gameIntelligence');if(!el)return;let ctx=gameContext(),current=contextEntry(),rows=Object.entries(state.chemistry).filter(([k,e])=>e.context&&e.sec>0).sort((a,b)=>b[1].sec-a[1].sec).slice(0,6);let label=current.sec<45?'LEARNING':current.net>=5?'WORKING':current.net<=-5?'WATCH':'NEUTRAL';el.innerHTML='<div class="intel-current"><div><span class="eyebrow">CURRENT GAME STATE</span><strong>'+ctx+'</strong><small>'+min(current.sec)+' tracked in this situation</small></div><span class="intel-badge '+label.toLowerCase()+'">'+label+'</span></div>'+'<div class="intel-grid"><div><small>STATE NET</small><strong>'+(current.net>0?'+':'')+current.net+'</strong></div><div><small>PHASE</small><strong>'+clockPhase()+'</strong></div><div><small>SCORE</small><strong>'+state.team+'–'+state.opp+'</strong></div></div>'+'<div class="intel-history">'+(rows.length?rows.map(([k,e])=>{let parts=k.split('||'),five=parts[0].split('|').map(id=>p(id)?.name||'—').join(' · '),n=e.net>0?'+'+e.net:String(e.net);return '<div class="intel-row"><div><strong>'+parts[1]+'</strong><small>'+five+'</small></div><span>'+n+'</span></div>'}).join(''):'<div class="muted">Rotation IQ will learn which lineups perform in different game situations.</div>')+'</div>'}
function renderCommand(){let d=state.team-state.opp,ctx=gameContext(),hot=state.roster.filter(x=>x.hot).length,long=state.roster.filter(x=>court(x.id)&&x.stint>=180),title='Ready for tip-off',sub='Rotation IQ will surface the next coaching decision as the game develops.',lead=d===0?'EVEN':(d>0?'+'+d:'−'+Math.abs(d)),st=long.length?min(long[0].stint):'—';if(d>0){title='You are controlling the game';sub='Protect the structure and manage the next clean rotation.'}if(d<0){title='Time to respond';sub='Freshness, HOT options and positional fit are being prioritised.'}if(hot){title='HOT hand detected';sub='A HOT tag is active — the engine will protect that option where structure allows.'}if(long.length){title='Rotation window approaching';sub=long[0].name+' has logged a long stint. A positional change may be due.'}let label=d>2?'Lakers momentum':d< -2?'Opponent momentum':'EVEN',pct=Math.max(8,Math.min(92,50+d*7));document.getElementById('liveQuarter').textContent='Q'+state.period;document.getElementById('livePhase').textContent=clockPhase();document.getElementById('liveSituation').textContent=scoreBand();document.getElementById('commandTitle').textContent=title;document.getElementById('commandSub').textContent=sub;document.getElementById('commandLead').textContent=lead;document.getElementById('commandStint').textContent=st;document.getElementById('commandHot').textContent=hot;document.getElementById('momentumLabel').textContent=label;document.getElementById('momentumBar').style.width=pct+'%';document.getElementById('momentumBar').setAttribute('aria-label',label);}function render(){renderCommand();clock();lineup();roster();minutes();timeline();recommend();coachNow();plan();renderTactical();renderClosing();renderChemistry();renderGameIntelligence();renderOpponent();renderTimeout();document.querySelectorAll('#modeSwitch button').forEach(b=>b.classList.toggle('active',b.dataset.mode===state.mode));document.getElementById('teamScore').textContent=state.team;document.getElementById('oppScore').textContent=state.opp;document.querySelectorAll('#statusFilter button').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter))}
function clock(){document.getElementById('clockDisplay').textContent=tm(state.remaining);document.getElementById('periodLabel').textContent='Q'+state.period;document.getElementById('clockToggle').textContent=state.remaining===0&&state.period<F[state.mode].periods?'Next quarter':state.running?'Pause':'Start'}
function tags(x){return (x.hot?'<span class="tag hot">HOT</span>':'')+(x.foul?'<span class="tag foul">FOUL</span>':'')+(x.rest?'<span class="tag rest">REST</span>':'')}
function lineup(){let el=document.getElementById('courtPositions');el.innerHTML=POS.map(pos=>{let x=p(state.lineup[pos]);return '<div class="position-slot"><div class="pos-label">'+PN[pos]+'</div>'+(x?'<div class="player-chip '+(x.hot?'hot ':'')+(x.rest?'rest ':'')+(x.foul?'foul':'')+'"><strong>'+x.name+'</strong><small>'+min(x.on)+'</small><div class="tag-row">'+tags(x)+'</div></div>':'<div class="player-chip"><strong>Open</strong><small>Assign</small></div>')+'</div>'}).join('');let s=structure(),pill=document.getElementById('structurePill');pill.textContent=s.clean?'5 / 5 positions':(5-s.missing.length-s.invalid.length)+' / 5 positions';pill.style.color=s.clean?'var(--accent)':'var(--warning)';document.getElementById('lineupNote').textContent=s.clean?'Structure is clean. Positional balance comes before equal minutes.':'Structure warning: '+s.missing.map(x=>'missing '+PN[x]).concat(s.invalid.map(x=>'natural-position mismatch: '+x)).join(' · ')+'.'}
function roster(){let list=state.roster.filter(x=>filter==='all'||(filter==='hot'&&x.hot)||(filter==='rest'&&x.rest)||(filter==='foul'&&x.foul));document.getElementById('rosterGrid').innerHTML=list.map(x=>'<article class="roster-card '+(court(x.id)?'on-court':'')+'"><div class="player-top"><div><div class="player-name">'+x.name+'</div><div class="player-pos">'+x.positions.map(y=>PN[y]).join(' · ')+(court(x.id)?' · ON COURT':'')+'</div></div><div class="player-min">'+min(x.on)+'</div></div><div class="status-row"><button class="status-btn hot '+(x.hot?'active':'')+'" data-status="hot" data-id="'+x.id+'">🔥 HOT</button><button class="status-btn rest '+(x.rest?'active':'')+'" data-status="rest" data-id="'+x.id+'">REST</button><button class="status-btn foul '+(x.foul?'active':'')+'" data-status="foul" data-id="'+x.id+'">⚠ FOUL</button></div>'+(court(x.id)?'':'<button class="sub-btn" data-sub="'+x.id+'">Sub '+x.name+' in</button>')+'</article>').join('')||'<div class="muted">No players match this filter.</div>'}
function minutes(){let max=Math.max(1,...state.roster.map(x=>x.on));document.getElementById('minutesBoard').innerHTML=state.roster.slice().sort((a,b)=>b.on-a.on).map(x=>'<div class="minute-row"><div class="minute-name">'+x.name+'</div><div class="bar"><span style="width:'+Math.min(100,x.on/max*100)+'%"></span></div><div class="minute-value">'+min(x.on)+'</div><div class="rest-value">'+(court(x.id)?'ON':'REST')+'</div></div>').join('')}
function timeline(){document.getElementById('timelineSummary').textContent=state.timeline.length?state.timeline.length+' substitution'+(state.timeline.length===1?'':'s'):'No substitutions yet';document.getElementById('timeline').innerHTML=state.timeline.slice().reverse().map(e=>'<div class="timeline-item"><strong>Q'+e.q+' · '+tm(e.t)+'</strong><small>'+p(e.out)?.name+' → '+p(e.in)?.name+'</small><small>'+PN[e.pos]+' · '+e.source+'</small></div>').join('')||'<div class="muted">Your live substitution history will appear here.</div>'}
function recommend(){let el=document.getElementById('recommendation'),b=document.getElementById('applyRecommendation'),r=rec();if(!r){el.innerHTML='<div class="rec-empty">No safe positional substitution is available right now. Coach control wins.</div>';b.disabled=true;b.style.opacity=.5;return}let o=p(r.out),i=p(r.in);el.innerHTML='<div class="rec-title">'+i.name+' for '+o.name+'</div><div class="rec-sub">Move at '+PN[r.pos]+'. The five-position structure stays intact while the engine responds to workload and coach tags.</div><div class="rec-move"><div class="move-line"><span class="move-player">'+o.name+'</span><span class="arrow">→</span><span class="move-player">'+i.name+'</span></div><div class="reason-list">'+(r.r.length?r.r:['structure preserved']).slice(0,5).map(x=>'<span class="reason">'+x+'</span>').join('')+'</div></div>';b.disabled=false;b.style.opacity=1}
function toast(m){let t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),1800)}
function newGame(){if(!confirm('Start a new game? Current game data will be cleared.'))return;act(()=>{let roster=state.roster.map(x=>({...x,on:0,stint:0,restSec:0,hot:false,rest:false,foul:false}));state=fresh();state.roster=roster})}
function resetMinutes(){act(()=>state.roster.forEach(x=>{x.on=0;x.stint=0;x.restSec=0}))}
function setup(){let root=document.getElementById('modalRoot'),rows=state.roster.map(x=>'<div class="setup-row" data-id="'+x.id+'"><div class="field"><label>Name</label><input data-name value="'+x.name.replace(/"/g,'&quot;')+'"></div><div class="field"><label>Natural positions</label><div class="position-picks">'+POS.map(y=>'<button type="button" data-pos="'+y+'" class="'+(x.positions.includes(y)?'active':'')+'">'+PN[y]+'</button>').join('')+'</div></div></div>').join('');root.innerHTML='<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>Team setup</h2><button class="icon-btn" id="closeSetup">×</button></div><div class="modal-body"><p class="muted">Edit names and natural positions. The engine uses these positions to preserve structure.</p>'+rows+'<div class="modal-actions"><button class="secondary-btn" id="cancelSetup">Cancel</button><button class="primary-btn" id="saveSetup">Save team</button></div></div></div></div>';root.querySelectorAll('[data-pos]').forEach(b=>b.onclick=()=>b.classList.toggle('active'));document.getElementById('closeSetup').onclick=()=>root.innerHTML='';document.getElementById('cancelSetup').onclick=()=>root.innerHTML='';document.getElementById('saveSetup').onclick=saveSetup}
function saveSetup(){act(()=>document.querySelectorAll('.setup-row').forEach(row=>{let x=p(row.dataset.id);x.name=row.querySelector('[data-name]').value.trim()||x.name;let pos=[...row.querySelectorAll('[data-pos].active')].map(b=>+b.dataset.pos);if(pos.length)x.positions=pos}));document.getElementById('modalRoot').innerHTML='';toast('Team setup saved')}
function bind(){document.getElementById('undoBtn').onclick=undo;document.getElementById('redoBtn').onclick=redo;document.getElementById('newGameBtn').onclick=newGame;document.getElementById('setupBtn').onclick=setup;document.getElementById('clockToggle').onclick=()=>state.remaining===0&&state.period<F[state.mode].periods?nextQ():toggleClock();document.getElementById('clockReset').onclick=()=>act(()=>{state.running=false;state.lastTick=null;state.remaining=periodSec();if(timerFrame)cancelAnimationFrame(timerFrame);timerFrame=null});document.getElementById('applyRecommendation').onclick=applyRec;document.getElementById('resetMinutesBtn').onclick=resetMinutes;document.querySelectorAll('#planSwitch button').forEach(b=>b.onclick=()=>act(()=>{state.plan=b.dataset.plan}));document.querySelectorAll('#tacticalSwitch button').forEach(b=>b.onclick=()=>act(()=>{state.tactic=b.dataset.tactic}));document.querySelectorAll('#modeSwitch button').forEach(b=>b.onclick=()=>act(()=>{state.mode=b.dataset.mode;state.period=1;state.remaining=F[state.mode].sec;state.running=false}));document.querySelectorAll('.score-controls button').forEach(b=>b.onclick=()=>score(b.dataset.score,+b.dataset.delta));document.getElementById('opponentBoard').onclick=e=>{let b=e.target.closest('[data-opponent]');if(b){act(()=>{state.opponent[b.dataset.opponent]=!state.opponent[b.dataset.opponent]});return}};document.getElementById('statusFilter').onclick=e=>{let b=e.target.closest('button');if(b){filter=b.dataset.filter;render()}};document.getElementById('rosterGrid').onclick=e=>{let b=e.target.closest('[data-status]');if(b){status(b.dataset.id,b.dataset.status);return}b=e.target.closest('[data-sub]');if(b)manual(b.dataset.sub)};window.onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='z'){e.preventDefault();undo()}if(e.code==='Space'&&document.activeElement.tagName!=='INPUT'){e.preventDefault();toggleClock()}}}
bind();render();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}