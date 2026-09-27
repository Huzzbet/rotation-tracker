const KEY='rotationIQ.v2', POS=[1,2,3,4,5], PN={1:'PG',2:'SG',3:'SF',4:'PF',5:'C'}, F={rep:{periods:4,sec:600},domestic:{periods:2,sec:1080}};
const DEFAULT=[['rodion','Rodion',[4,5]],['jacob','Jacob',[4,5]],['archer','Archer',[2,3]],['max','Max',[2,3]],['bill','Bill',[1,2,3,4]],['alvin','Alvin',[1,2,3]],['ethan','Ethan',[3,4]],['tom','Tom',[1,2,3]],['tate','Tate',[2,3,4]]];
let state=load(),undoStack=[],redoStack=[],filter='all';
if(!state.plan)state.plan='balanced'; if(!state.tactic)state.tactic='balanced'; if(!state.chemistry)state.chemistry={};
function fresh(){return {mode:'rep',period:1,remaining:600,running:false,team:0,opp:0,lineup:{1:'alvin',2:'tom',3:'archer',4:'ethan',5:'rodion'},roster:DEFAULT.map(x=>({id:x[0],name:x[1],positions:x[2],hot:false,rest:false,foul:false,on:0,stint:0,restSec:0})),timeline:[],plan:'balanced',tactic:'balanced',chemistry:{}}}
function load(){try{let x=JSON.parse(localStorage.getItem(KEY));return x?x:fresh()}catch{return fresh()}}
function save(){localStorage.setItem(KEY,JSON.stringify({...state,running:false}))}
function fiveKey(lineup=state.lineup){return POS.map(pos=>lineup[pos]||'').join('|')}
function chemistryEntry(key){if(!state.chemistry[key])state.chemistry[key]={sec:0,net:0,events:0,stints:0};return state.chemistry[key]}
function trackChemistry(seconds){
  if(seconds<=0)return;
  let e=chemistryEntry(fiveKey()); e.sec+=seconds;
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
function tick(){if(!state.running)return;let now=Date.now(),d=Math.min(2,(now-(state.lastTick||now))/1000);state.lastTick=now;state.remaining=Math.max(0,state.remaining-d);trackChemistry(d);state.roster.forEach(x=>court(x.id)?(x.on+=d,x.stint+=d):(x.restSec+=d));if(state.remaining<=0){state.running=false;toast(state.period===F[state.mode].periods?'Final siren':'End of period')}save();render()}
function toggleClock(){state.running=!state.running;state.lastTick=Date.now();save();render()}
function nextQ(){if(state.period>=F[state.mode].periods)return;act(()=>{state.period++;state.remaining=periodSec();state.running=false;state.roster.forEach(x=>x.stint=0)})}
function rec(){let best=null,avg=state.roster.reduce((a,x)=>a+x.on,0)/state.roster.length;state.roster.filter(x=>court(x.id)).forEach(out=>{POS.forEach(pos=>{if(state.lineup[pos]!==out.id)return;state.roster.filter(x=>!court(x.id)&&x.positions.includes(pos)).forEach(i=>{let s=0,r=[];if(i.hot){s+=20;r.push('HOT hand')}if(i.rest){s+=22;r.push('fresh')}if(out.rest){s+=30;r.push('REST requested')}if(out.foul){s+=24;r.push('foul protection')}if(out.hot)s-=45;if(Math.abs(i.on-out.on)>90){s+=12;r.push('minutes balance')}
if(state.plan==='hot'&&i.hot){s+=25;r.push('hot-hand plan')}if(state.plan==='hot'&&out.hot){s-=30;r.push('keep HOT player on court')}if(state.plan==='foul'&&out.foul){s+=18;r.push('foul plan')}if(state.plan==='protect'){if(i.foul)s-=18;if(i.on<avg)s+=7;r.push('workload protection')}if(state.plan==='chase'&&i.hot){s+=12;r.push('scoring option')}if(state.plan==='chase'&&i.on<avg)s+=5;let projected={...state.lineup};projected[pos]=i.id;let cb=chemistryBonus(projected);if(cb){s+=cb;r.push(cb>=3?'proven five-man unit':cb<=-3?'chemistry warning':'building chemistry')}s+=Math.min(15,i.restSec/60*1.2)-Math.min(12,i.stint/60);if(!best||s>best.s)best={s,in:i.id,out:out.id,pos:pos,r:r}})})});return best}
function sub(outId,inId,pos,source){let o=p(outId),i=p(inId);if(!o||!i||!i.positions.includes(pos))return;state.lineup[pos]=inId;o.stint=0;i.stint=0;i.rest=false;chemistryEntry(fiveKey()).events++;chemistryEntry(fiveKey()).stints++;state.timeline.push({q:state.period,t:state.remaining,out:outId,in:inId,pos:pos,source:source||'Coach'});if(state.timeline.length>60)state.timeline.shift()}
function applyRec(){let r=rec();if(!r)return toast('No clean positional rotation');act(()=>sub(r.out,r.in,r.pos,'Coach assistant'))}
function manual(id){let i=p(id),best=null;i.positions.forEach(pos=>{if(!state.lineup[pos])return;let o=p(state.lineup[pos]),s=(o.rest?30:0)+(o.foul?20:0)-(o.hot?30:0)+Math.max(0,5-o.stint/60);if(!best||s>best.s)best={s,out:o.id,pos:pos}});if(!best)return toast('No safe positional replacement');act(()=>sub(best.out,id,best.pos,'Coach'))}
function status(id,k){act(()=>{let x=p(id);x[k]=!x[k];if(k==='rest'&&x.rest)x.stint=0})}
function score(team,d){
  act(()=>{
    let key=fiveKey(),e=chemistryEntry(key);
    state[team==='team'?'team':'opp']=Math.max(0,state[team==='team'?'team':'opp']+d);
    e.net+=team==='team'?d:-d;e.events++;
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
  let entries=Object.entries(state.chemistry).filter(([,e])=>e.sec>0).sort((a,b)=>b[1].sec-a[1].sec).slice(0,5);
  let current=chemistryEntry(fiveKey()),label=chemistryLabel(),currentNames=POS.map(pos=>p(state.lineup[pos])?.name||'Open').join(' · ');
  let rows=entries.map(([key,e])=>{let names=key.split('|').map(id=>p(id)?.name||'—').join(' · ');let score=e.net>0?'+'+e.net:String(e.net);return '<div class="chemistry-row"><div><strong>'+names+'</strong><small>'+min(e.sec)+' together · '+e.events+' events</small></div><span class="chemistry-net">'+score+'</span></div>'}).join('');
  el.innerHTML='<div class="chemistry-current"><div><span class="eyebrow">CURRENT FIVE</span><strong>'+currentNames+'</strong></div><span class="chemistry-badge '+label.cls+'">'+label.label+'</span></div>'+
    '<div class="chemistry-stat-grid"><div><small>TIME TOGETHER</small><strong>'+min(current.sec)+'</strong></div><div><small>NET SCORE</small><strong>'+(current.net>0?'+':'')+current.net+'</strong></div><div><small>EVENTS</small><strong>'+current.events+'</strong></div></div>'+
    '<div class="chemistry-list">'+(rows||'<div class="muted">Play the game and Rotation IQ will learn which five-man combinations are working.</div>')+'</div>';
}
function render(){clock();lineup();roster();minutes();timeline();recommend();coachNow();plan();renderTactical();renderClosing();renderChemistry();document.querySelectorAll('#modeSwitch button').forEach(b=>b.classList.toggle('active',b.dataset.mode===state.mode));document.getElementById('teamScore').textContent=state.team;document.getElementById('oppScore').textContent=state.opp;document.querySelectorAll('#statusFilter button').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter))}
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
function bind(){document.getElementById('undoBtn').onclick=undo;document.getElementById('redoBtn').onclick=redo;document.getElementById('newGameBtn').onclick=newGame;document.getElementById('setupBtn').onclick=setup;document.getElementById('clockToggle').onclick=()=>state.remaining===0&&state.period<F[state.mode].periods?nextQ():toggleClock();document.getElementById('clockReset').onclick=()=>act(()=>{state.running=false;state.remaining=periodSec()});document.getElementById('applyRecommendation').onclick=applyRec;document.getElementById('resetMinutesBtn').onclick=resetMinutes;document.querySelectorAll('#planSwitch button').forEach(b=>b.onclick=()=>act(()=>{state.plan=b.dataset.plan}));document.querySelectorAll('#tacticalSwitch button').forEach(b=>b.onclick=()=>act(()=>{state.tactic=b.dataset.tactic}));document.querySelectorAll('#modeSwitch button').forEach(b=>b.onclick=()=>act(()=>{state.mode=b.dataset.mode;state.period=1;state.remaining=F[state.mode].sec;state.running=false}));document.querySelectorAll('.score-controls button').forEach(b=>b.onclick=()=>score(b.dataset.score,+b.dataset.delta));document.getElementById('statusFilter').onclick=e=>{let b=e.target.closest('button');if(b){filter=b.dataset.filter;render()}};document.getElementById('rosterGrid').onclick=e=>{let b=e.target.closest('[data-status]');if(b){status(b.dataset.id,b.dataset.status);return}b=e.target.closest('[data-sub]');if(b)manual(b.dataset.sub)};window.onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='z'){e.preventDefault();undo()}if(e.code==='Space'&&document.activeElement.tagName!=='INPUT'){e.preventDefault();toggleClock()}}}
bind();render();setInterval(tick,250);
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}