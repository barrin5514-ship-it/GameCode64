/* UI, animation, and progress. Game rules and lesson checks live in separate files. */
'use strict';
const {lessons,assess}=GameLessons;
const $=id=>document.getElementById(id);
const canvas=$('game'),ctx=canvas.getContext('2d');
const SAVE_KEY='gamecode64-v1-progress';
let completed=new Set(),index=0,current=null,program=null,busy=false,runId=0,passed=false;
try {
  const saved=JSON.parse(localStorage.getItem(SAVE_KEY));
  if (Array.isArray(saved)) completed=new Set(saved.filter(n=>Number.isInteger(n)&&n>=0&&n<lessons.length));
} catch (_) { /* Private mode or unavailable storage should not prevent play. */ }
const worlds={maze:['01 / NAVIGATION LAB','NAVIGATION LAB','◆ COURIER   ◎ PORTAL   ▧ WALL'],shooter:['02 / ORBITAL RANGE','ALIEN SHOOTER','▲ SHIP   ▾ ALIEN   ┊ TARGET COLUMN'],racing:['03 / NEON SPEEDWAY','NEON SPEEDWAY','▣ CAR   ▧ OBSTACLE   ▰ FINISH']};
function feedback(message,type='ready') {
  $('feedback').className=`feedback ${type}`;
  $('feedbackLabel').textContent=type==='success'?'MISSION VERIFIED':type==='error'?'DEBUG CONSOLE':'TERMINAL OUTPUT';
  $('output').textContent=message;
}
function save() { try { localStorage.setItem(SAVE_KEY,JSON.stringify([...completed])); } catch (_) {} }
function progress() {
  $('progress').value=completed.size;
  $('progressText').textContent=`${completed.size} / ${lessons.length} COMPLETE`;
  [...$('lessonSelect').options].forEach((option,i)=>{ option.textContent=`${completed.has(i)?'✓ ':''}${String(i+1).padStart(2,'0')} · ${lessons[i].title}`; });
}
function setBusy(value) { busy=value; $('runButton').disabled=value; $('keyRight').disabled=value; $('keyShoot').disabled=value; $('code').readOnly=value; }
function draw(frame,lesson=lessons[index]) {
  const config=lesson.config,cell=64,offset=64;
  ctx.fillStyle='#0a1221';ctx.fillRect(0,0,640,384);
  if (lesson.world==='shooter') {
    ctx.fillStyle='#405474'; for(let n=0;n<65;n++){const x=(n*137+19)%640,y=(n*79+13)%384;ctx.fillRect(x,y,n%4===0?2:1,1);}
  }
  for(let y=0;y<6;y++)for(let x=0;x<8;x++){
    ctx.fillStyle=lesson.world==='racing'?(x%2?'#1a2437':'#172034'):'#101c2c';ctx.fillRect(offset+x*cell+1,y*cell+1,62,62);
    ctx.strokeStyle='#27334a';ctx.strokeRect(offset+x*cell+.5,y*cell+.5,64,64);
  }
  ctx.font='10px Consolas, monospace';ctx.fillStyle='#7f93b4';ctx.textAlign='center';
  for(let x=0;x<8;x++)ctx.fillText(x,offset+x*cell+32,12);
  for(let y=0;y<6;y++)ctx.fillText(y,50,y*cell+35);
  const box=(point,color,inset=12)=>{ctx.fillStyle=color;ctx.fillRect(offset+point[0]*cell+inset,point[1]*cell+inset,cell-inset*2,cell-inset*2);};
  for(const p of config.walls||[]) {box(p,'#6c588e',5);ctx.strokeStyle='#b29bd8';ctx.strokeRect(offset+p[0]*cell+10,p[1]*cell+10,44,44);ctx.beginPath();ctx.moveTo(offset+p[0]*cell+12,p[1]*cell+12);ctx.lineTo(offset+p[0]*cell+52,p[1]*cell+52);ctx.stroke();}
  const gx=offset+config.goal[0]*cell,gy=config.goal[1]*cell;
  if(lesson.world==='maze'){
    ctx.strokeStyle='#8cf4c5';ctx.lineWidth=3;ctx.strokeRect(gx+11,gy+11,42,42);ctx.lineWidth=1;ctx.strokeRect(gx+18,gy+18,28,28);
  }else if(lesson.world==='racing'){
    for(let a=0;a<8;a++)for(let b=0;b<2;b++){ctx.fillStyle=(a+b)%2?'#d7ddea':'#33425a';ctx.fillRect(gx+a*8,gy+20+b*8,8,8);}
  }else{ctx.strokeStyle='#8cf4c566';ctx.setLineDash([4,6]);ctx.strokeRect(gx+8,gy+8,48,48);ctx.setLineDash([]);}
  if(config.checkpoint){box(config.checkpoint,frame.checkpoint?'#8cf4c5':'#ffce81',15);ctx.fillStyle='#102032';ctx.font='bold 20px monospace';ctx.fillText(frame.checkpoint?'✓':'C',offset+config.checkpoint[0]*cell+32,config.checkpoint[1]*cell+40);}
  if(frame.alien){const ax=offset+frame.alien[0]*cell,ay=frame.alien[1]*cell;ctx.fillStyle='#b7a4ff';ctx.fillRect(ax+12,ay+18,40,25);ctx.fillRect(ax+6,ay+26,52,12);ctx.fillRect(ax+16,ay+12,7,8);ctx.fillRect(ax+41,ay+12,7,8);ctx.fillStyle='#152035';ctx.fillRect(ax+20,ay+26,7,7);ctx.fillRect(ax+37,ay+26,7,7);}
  const px=offset+frame.x*cell,py=frame.y*cell;
  ctx.fillStyle='#ff8d86';
  if(lesson.world==='shooter'){
    ctx.beginPath();ctx.moveTo(px+32,py+12);ctx.lineTo(px+52,py+49);ctx.lineTo(px+32,py+40);ctx.lineTo(px+12,py+49);ctx.closePath();ctx.fill();ctx.fillStyle='#8cf4c5';ctx.fillRect(px+28,py+29,8,12);
  }else if(lesson.world==='racing'){
    ctx.fillStyle='#080c15';for(const x of [12,44])for(const y of [15,39])ctx.fillRect(px+x,py+y,8,12);
    ctx.fillStyle='#ff8d86';ctx.fillRect(px+20,py+10,24,44);ctx.fillStyle='#b8eaf1';ctx.fillRect(px+23,py+19,18,10);ctx.fillStyle='#ffce81';ctx.fillRect(px+22,py+10,5,4);ctx.fillRect(px+37,py+10,5,4);
  }else{ctx.fillRect(px+15,py+15,34,34);ctx.fillStyle='#19263b';ctx.fillRect(px+21,py+23,6,7);ctx.fillRect(px+37,py+23,6,7);ctx.fillStyle='#ffd1bd';ctx.fillRect(px+24,py+38,16,3);}
  if(frame.beam){ctx.strokeStyle='#ffce81';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(offset+frame.beam.x*cell+32,frame.beam.from*cell+12);ctx.lineTo(offset+frame.beam.x*cell+32,frame.beam.to*cell+32);ctx.stroke();ctx.lineWidth=1;}
  $('hud').textContent=`POS ${frame.x},${frame.y} · ${lesson.world==='shooter'?`HITS ${frame.hits} / 1`:`MOVES ${current?.state.moves||0}`}`;
  canvas.setAttribute('aria-label',`${worlds[lesson.world][1]}. Player column ${frame.x}, row ${frame.y}. Goal column ${config.goal[0]}, row ${config.goal[1]}.${frame.alien?` Alien column ${frame.alien[0]}, row ${frame.alien[1]}.`:''}${frame.checkpoint?' Checkpoint recorded.':''}`);
}
function loadLesson(next) {
  runId++;index=next;current=null;program=null;passed=false;setBusy(false);
  const lesson=lessons[index],world=worlds[lesson.world];
  $('lessonSelect').value=String(index);$('chapter').textContent=world[0];$('gameTitle').textContent=world[1];$('legend').textContent=world[2];
  $('lessonNumber').textContent=`MISSION ${String(index+1).padStart(2,'0')} / 10`;
  for(const [id,value] of Object.entries({lessonTitle:lesson.title,concept:lesson.concept,instructions:lesson.instructions,objective:lesson.objective,hint:lesson.hint}))$(id).textContent=value;
  $('code').value=lesson.starter;$('hint').hidden=true;$('hintButton').textContent='? Reveal hint';$('hintButton').setAttribute('aria-expanded','false');
  $('commands').textContent=lesson.allowed.map(name=>({moveRight:'moveRight(cells); → right',moveLeft:'moveLeft(cells); → left',moveUp:'moveUp(cells); → up',moveDown:'moveDown(cells); → down',drive:'drive(cells); → forward / up',shoot:'shoot(); → one upward shot',aligned:'aligned() → true / false',obstacleAhead:'obstacleAhead() → true / false',checkpoint:'checkpoint(); → record your stop',onKey:'onKey("ArrowRight", function() { ... }); or "Space"'}[name])).join('\n');
  $('nextButton').hidden=true;$('eventControls').hidden=!lesson.events;$('gameState').textContent='READY';$('screenNote').textContent='EDIT YOUR CODE → PRESS RUN';
  feedback('Edit the starter code, then press Run. Each run starts with a fresh board.');progress();draw(GameEngine.snapshot(GameEngine.createState(lesson.config)));
}
async function animate(frames,id) {
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  for(const frame of frames){if(id!==runId)return false;draw(frame);if(!reduced)await new Promise(resolve=>setTimeout(resolve,170));}
  return id===runId;
}
function finish() {
  const result=assess(lessons[index],current,program,GameEngine);
  passed=result.success;
  if(result.success){completed.add(index);save();progress();$('gameState').textContent='COMPLETE';$('screenNote').textContent='MISSION VERIFIED';$('nextButton').hidden=false;$('nextButton').textContent=index===9?'Finish course ★':'Next lesson →';feedback(result.message,'success');}
  else{feedback(result.message,lessons[index].events?'ready':'error');$('gameState').textContent=lessons[index].events?'CONTROLS LIVE':'TRY AGAIN';}
}
async function runCode() {
  if(busy)return;
  const id=++runId;passed=false;$('nextButton').hidden=true;current=null;setBusy(true);$('gameState').textContent='RUNNING';$('screenNote').textContent='EXECUTING YOUR CODE';feedback('Running your program…');
  try{
    program=GameEngine.parse($('code').value);current=GameEngine.session(program,lessons[index].config,lessons[index].allowed);current.run();
    if(!await animate(current.state.frames,id))return;
    finish();
    if(lessons[index].events&&!passed){$('screenNote').textContent='PRESS → THEN SPACE';canvas.focus();}
  }catch(error){if(id!==runId)return;if(current)draw(GameEngine.snapshot(current.state));else draw(GameEngine.snapshot(GameEngine.createState(lessons[index].config)));feedback(error.message,'error');$('gameState').textContent='FIX & RUN';$('screenNote').textContent='CHECK THE DEBUG CONSOLE';current=null;}
  finally{if(id===runId)setBusy(false);}
}
async function keyAction(key) {
  if(busy||passed)return;
  if(!current){feedback('Press Run Code first to register your keyboard handlers.','error');return;}
  const id=runId;setBusy(true);const from=current.state.frames.length;
  try{current.key(key);if(!await animate(current.state.frames.slice(from),id))return;finish();}
  catch(error){if(id===runId){draw(GameEngine.snapshot(current.state));feedback(`${error.message} Edit your code and Run to start again.`,'error');$('gameState').textContent='FIX & RUN';current=null;}}
  finally{if(id===runId)setBusy(false);}
}
lessons.forEach((lesson,i)=>{const option=document.createElement('option');option.value=i;$('lessonSelect').append(option);});
$('runButton').addEventListener('click',runCode);
$('resetButton').addEventListener('click',()=>loadLesson(index));
$('lessonSelect').addEventListener('change',event=>loadLesson(Number(event.target.value)));
$('hintButton').addEventListener('click',()=>{const hidden=!$('hint').hidden;$('hint').hidden=hidden;$('hintButton').textContent=hidden?'? Reveal hint':'− Hide hint';$('hintButton').setAttribute('aria-expanded',String(!hidden));});
$('nextButton').addEventListener('click',()=>{if(!passed)return;if(index<9)loadLesson(index+1);else{feedback(completed.size===10?'Course complete — all 10 missions verified! Replay any mission from the menu.':'Final mission complete! Use the menu to finish the remaining missions.','success');$('nextButton').hidden=true;}});
$('keyRight').addEventListener('click',()=>keyAction('ArrowRight'));
$('keyShoot').addEventListener('click',()=>keyAction('Space'));
canvas.addEventListener('keydown',event=>{if(lessons[index].events&&['ArrowRight',' '].includes(event.key)){event.preventDefault();if(!event.repeat)keyAction(event.key===' '?'Space':'ArrowRight');}});
$('code').addEventListener('input',()=>{runId++;current=null;passed=false;$('nextButton').hidden=true;$('gameState').textContent='CODE CHANGED';feedback('Code changed. Run again to test this version.');});
$('code').addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();runCode();}if(event.key==='Tab'){event.preventDefault();if(!$('code').readOnly){$('code').setRangeText('  ',$('code').selectionStart,$('code').selectionEnd,'end');$('code').dispatchEvent(new Event('input'));}}});
$('clearProgress').addEventListener('click',()=>{if(window.confirm('Clear all saved mission completions? Your current starter code will also reset.')){completed.clear();save();loadLesson(0);}});
loadLesson(0);
