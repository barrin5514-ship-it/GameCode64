'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../engine.js');
const {lessons,assess}=require('../lessons.js');
const solutions=[
  'const steps = 3; moveRight(steps);',
  'moveUp(2); moveRight(4); moveDown(2);',
  'let speed = 2; moveRight(speed);',
  'onKey("ArrowRight", function() { moveRight(1); }); onKey("Space", function() { shoot(); });',
  'function fire() { shoot(); } moveRight(2); fire();',
  'if (aligned()) { shoot(); }',
  'const speed = 2; drive(speed);',
  'function boost() { drive(2); } boost(); boost();',
  'if (obstacleAhead()) { moveRight(1); } drive(4);',
  'const speed = 2; drive(speed); checkpoint(); drive(speed);'
];
function attempt(i,source,keys=[]) {
  const lesson=lessons[i],program=engine.parse(source),run=engine.session(program,lesson.config,lesson.allowed);
  run.run(); for(const key of keys)run.key(key);
  return {run,result:assess(lesson,run,program,engine)};
}
function notPass(i,source,keys=[]) {
  let result;
  try { result=attempt(i,source,keys).result; } catch(error) { assert.ok(error instanceof Error);return; }
  assert.equal(result.success,false,source);
}
lessons.forEach((lesson,i)=>{
  test(`mission ${i+1}: reference solution completes`,()=>assert.equal(attempt(i,solutions[i],i===3?['ArrowRight','Space']:[]).result.success,true));
  test(`mission ${i+1}: starter is not a correct solution`,()=>notPass(i,lesson.starter,i===3?['ArrowRight','Space']:[]));
  test(`mission ${i+1}: empty and comment-only input cannot complete`,()=>{notPass(i,'');notPass(i,'// '+solutions[i]);});
});
test('boundary prevents crossing edge and preserves legal position',()=>{
  const p=engine.parse('moveLeft(2);'),r=engine.session(p,lessons[0].config,lessons[0].allowed);
  assert.throws(()=>r.run(),/Boundary/);assert.equal(r.state.x,0);assert.equal(r.state.y,4);
});
test('movement checks intermediate wall cells (no tunneling)',()=>{
  const r=engine.session(engine.parse('moveRight(4);'),lessons[1].config,lessons[1].allowed);
  assert.throws(()=>r.run(),/Collision/);assert.equal(r.state.x,2);
});
test('up, down, and right edges are enforced',()=>{
  for(const source of ['moveUp(5);','moveDown(2);','moveRight(5);moveRight(5);'])notPass(0,source);
});
test('a miss is not a hit; aligned shot hits once',()=>{
  assert.equal(attempt(4,'shoot();').run.state.hits,0);
  const r=attempt(4,'moveRight(2); shoot(); shoot();').run;
  assert.equal(r.state.shots,2);assert.equal(r.state.hits,1);assert.equal(r.state.alien,null);
});
test('an intervening wall blocks projectiles',()=>{
  const r=engine.session(engine.parse('shoot();'),{start:[2,5],goal:[2,5],alien:[2,1],walls:[[2,3]]},['shoot']);r.run();assert.equal(r.state.hits,0);
});
test('unconditional shooting fails the alternate scenario',()=>{const a=attempt(5,'shoot();');assert.equal(a.result.success,false);assert.match(a.result.message,/unaligned/);});
test('unconditional lane change fails the clear-road scenario',()=>{const a=attempt(8,'moveRight(1); drive(4);');assert.equal(a.result.success,false);assert.match(a.result.message,/clear road/);});
test('functions must be called and contain the required behavior',()=>{
  notPass(4,'function fire() { shoot(); } moveRight(2);');
  notPass(4,'function fire() {} moveRight(2); shoot(); fire();');
  notPass(7,'function boost() {} boost(); boost(); drive(4);');
});
test('events must actually trigger matching actions',()=>{
  notPass(3,solutions[3]);notPass(3,solutions[3],['Space']);
  notPass(3,'onKey("ArrowRight", function() {}); onKey("Space", function() {}); moveRight(1); shoot();');
});
test('quoted values, zero, negative and fractional movement are rejected',()=>{
  for(const value of ['"3"','0','-1','1.5','true','99999'])assert.throws(()=>attempt(0,`const steps = ${value}; moveRight(steps);`),/whole number/);
});
test('checkpoint requires a visit and a call at the right time',()=>{
  notPass(9,'drive(4);');notPass(9,'checkpoint(); drive(4);');notPass(9,'drive(2); drive(2); checkpoint();');
});
test('syntax, unsupported APIs, wrong arity and hidden bad code are rejected',()=>{
  for(const source of ['const steps = 3 moveRight(steps);','moveRight(3); alert("win");','moveRight();','moveRight(3, 4);','if (false) { unknown(); } moveRight(3);','window.location = "x";','eval("moveRight(3)");','while (true) {}','const steps = 3; moveRight(step);','moveRight(3); @','if (true) { moveRight(3);'])assert.throws(()=>attempt(0,source),Error,source);
});
test('const reassignment and duplicate names fail',()=>{
  assert.throws(()=>attempt(0,'const steps = 1; steps = 3; moveRight(steps);'),/const/);
  assert.throws(()=>attempt(0,'let steps = 1; let steps = 3; moveRight(steps);'),/already used/);
});
test('let reassignment and arithmetic execute correctly',()=>assert.equal(attempt(0,'let steps = 1; steps = steps + 2; moveRight(steps);').result.success,true));
test('numeric conditions do not silently coerce to booleans',()=>assert.throws(()=>attempt(0,'if (1) { moveRight(3); }'),/true or false/));
test('recursion, oversized programs and deep syntax are bounded',()=>{
  assert.throws(()=>attempt(0,'function recurse() { recurse(); } recurse();'),/nested|limit/);
  assert.throws(()=>engine.parse(' '.repeat(6001)),/6,000/);
  assert.throws(()=>engine.parse('if (true) {'.repeat(40)+'}'.repeat(40)),/nesting/);
});
test('repeated runs create fresh game state',()=>{
  const a=attempt(9,solutions[9]);a.run.state.x=7;
  const b=attempt(9,solutions[9]);assert.equal(b.result.success,true);assert.equal(b.run.state.x,2);
});
test('duplicate and unsupported key handlers fail',()=>{
  assert.throws(()=>attempt(3,'onKey("Space", function() {}); onKey("Space", function() {});'),/one handler/);
  assert.throws(()=>attempt(3,'onKey("Enter", function() {});'),/ArrowRight/);
});
module.exports={solutions};
