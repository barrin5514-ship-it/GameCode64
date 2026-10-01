(function(root) {
  'use strict';
  const navigation=['moveRight','moveLeft','moveUp','moveDown'];
  const shooting=['moveRight','moveLeft','shoot','aligned'];
  const racing=['moveRight','moveLeft','drive','obstacleAhead','checkpoint'];
  const atGoal=s=>s.x===s.goal[0] && s.y===s.goal[1];
  const called=(s,name)=>s.trace.filter(t=>t.name===name);
  const usedVariable=(program,name)=>program.some(n=>n.kind==='expression' && n.value.args.some(a=>a.kind==='variable' && a.name===name));
  const variable=(run,name,value)=>run.globals.get(name)?.value===value;
  const lessons=[
    {title:'Your first move',world:'maze',concept:'Values & variables',
      instructions:'Your courier is three cells from the green portal. A variable stores a value. Change steps, then run the program and watch the courier move.',
      objective:'Store 3 in steps and use it in moveRight(steps) to reach the portal.',
      starter:'const steps = 1;\nmoveRight(steps);',hint:'Count the cells between the courier and portal. Change the number assigned to steps; keep the variable in the command.',
      config:{start:[1,4],goal:[4,4],walls:[[0,3],[1,3],[2,3],[3,3],[4,3]]},allowed:navigation,
      check:(r,p)=>atGoal(r.state)&&variable(r,'steps',3)&&usedVariable(p,'steps'),
      retry:'The portal is three cells to the right. Check the value of steps and pass that variable to moveRight.'},
    {title:'Around the wall',world:'maze',concept:'Sequencing',
      instructions:'Commands run from top to bottom. A wall blocks the direct path. Plan a short detour using moveUp, moveRight, and moveDown.',
      objective:'Reach the portal at column 5, row 4 without touching a wall or leaving the board.',
      starter:'moveUp(1);\nmoveRight(4);\nmoveDown(1);',hint:'The wall occupies rows 3 and 4. Get above row 3 before moving across, then return to row 4.',
      config:{start:[1,4],goal:[5,4],walls:[[3,3],[3,4],[3,5]]},allowed:navigation,
      check:r=>atGoal(r.state),retry:'Your route is valid, but it does not end at the portal. Check the order and distance of each move.'},
    {title:'Tune the thrusters',world:'shooter',concept:'Numeric variables',
      instructions:'Welcome to the orbital range. Move your ship beneath the alien. The speed variable controls how many cells one movement command travels.',
      objective:'Set speed to the number 2 and use moveRight(speed) to park in column 4.',
      starter:'let speed = 1;\nmoveRight(speed);',hint:'Your ship starts in column 2. The alien is in column 4. Numeric values do not need quotation marks.',
      config:{start:[2,5],goal:[4,5],alien:[4,1]},allowed:shooting,
      check:(r,p)=>atGoal(r.state)&&variable(r,'speed',2)&&usedVariable(p,'speed'),retry:'Park under the alien using a numeric speed variable equal to 2.'},
    {title:'Wire the controls',world:'shooter',concept:'Keyboard events',
      instructions:'onKey connects a key to code. Repair the ArrowRight handler so it moves right by one cell. Run to register both handlers, then press → followed by Space in the game (or use the buttons).',
      objective:'Move right through your ArrowRight handler, then hit the alien through your Space handler.',
      starter:'onKey("ArrowRight", function() {\n  moveLeft(1);\n});\nonKey("Space", function() {\n  shoot();\n});',hint:'The event name says right, but the movement command goes the other way. Change the command inside that handler.',
      config:{start:[2,5],goal:[3,5],alien:[3,1]},allowed:[...shooting,'onKey'],events:true,
      check:r=>r.state.hits===1&&r.handlers.has('ArrowRight')&&r.handlers.has('Space')&&called(r.state,'moveRight').some(t=>t.stack.includes('key:ArrowRight'))&&called(r.state,'shoot').some(t=>t.stack.includes('key:Space')),
      retry:'The controls are registered. Use → to line up, then Space to fire. Both actions must come from their matching key handlers.'},
    {title:'Build a firing function',world:'shooter',concept:'Functions & collision',
      instructions:'A function names a reusable action. Defining fire does not run it. Fill its body with shoot(), line up the ship, then call fire(). A shot only hits when ship and alien share a column.',
      objective:'Hit the alien with a shot made inside your fire function.',
      starter:'function fire() {\n  // Add the shooting command here.\n}\nmoveRight(2);\nfire();',hint:'Place shoot(); between the function’s braces. Keep the fire(); call after the movement.',
      config:{start:[2,5],goal:[4,5],alien:[4,1]},allowed:shooting,
      check:r=>r.state.hits===1&&called(r.state,'shoot').some(t=>t.stack.includes('fire')),retry:'The alien must be hit by shoot() inside a called fire function. Check the function body and alignment.'},
    {title:'Think before you fire',world:'shooter',concept:'Conditions & debugging',
      instructions:'aligned() returns true when a live alien is above your ship in the same column. Fix the condition so the ship fires only when aligned. We also test your code with an alien in a different column.',
      objective:'Hit the aligned alien with exactly one shot; fire zero shots in the unaligned test.',
      starter:'if (aligned() === false) {\n  shoot();\n}',hint:'The current condition runs the body when alignment is false. Use the sensor’s true result to decide when to shoot.',
      config:{start:[2,5],goal:[2,5],alien:[2,1]},allowed:['shoot','aligned'],
      probes:[{label:'unaligned alien',config:{start:[2,5],goal:[2,5],alien:[4,1]},check:r=>r.state.shots===0&&r.state.hits===0}],
      check:r=>r.state.hits===1&&r.state.shots===1,retry:'Shoot once when aligned, and never when unaligned. Put the shot inside the correct condition.'},
    {title:'Set your race pace',world:'racing',concept:'Variables & types',
      instructions:'On this track, drive moves forward (up). Set a numeric speed to travel two cells to the first finish marker. A quoted number is text, so the engine will reject it as a movement distance.',
      objective:'Use speed = 2 and drive(speed) to stop at column 2, row 3.',
      starter:'const speed = "2";\ndrive(speed);',hint:'Compare a number such as 1 with text such as "1". The car needs a number.',
      config:{start:[2,5],goal:[2,3]},allowed:racing,
      check:(r,p)=>atGoal(r.state)&&variable(r,'speed',2)&&usedVariable(p,'speed'),retry:'Use the number 2 in speed, then pass speed to drive to reach the marker.'},
    {title:'Reuse your boost',world:'racing',concept:'Reusable functions',
      instructions:'Create a boost function that drives two cells. Call it twice to reach the finish. This uses the same function rather than repeating the movement command in two places.',
      objective:'Call boost exactly twice. Each call must drive two cells; stop at row 1.',
      starter:'function boost() {\n  drive(1);\n}\nboost();\nboost();',hint:'Two boosts need to cover four cells in total. Adjust the distance inside the function.',
      config:{start:[2,5],goal:[2,1]},allowed:racing,
      check:r=>atGoal(r.state)&&called(r.state,'boost').length===2&&called(r.state,'drive').length===2&&called(r.state,'drive').every(t=>t.args[0]===2&&t.stack.includes('boost')),
      retry:'The finish needs two boosts of two cells each. Check the function body and its two calls.'},
    {title:'Read the road',world:'racing',concept:'Sensors & conditions',
      instructions:'obstacleAhead() checks the next cell. Switch one lane right only when the sensor is true, then drive four cells. We also test a clear road, where the car must stay in its original lane.',
      objective:'Avoid the obstacle and finish in column 3. On a clear road, finish in column 2.',
      starter:'if (obstacleAhead() === false) {\n  moveRight(1);\n}\ndrive(4);',hint:'Change lanes when an obstacle IS ahead. A clear road should skip the lane change.',
      config:{start:[2,5],goal:[3,1],walls:[[2,4]]},allowed:racing,
      probes:[{label:'clear road',config:{start:[2,5],goal:[2,1]},check:r=>atGoal(r.state)}],
      check:r=>atGoal(r.state),retry:'Reach the finish safely, and use the sensor so a clear road does not cause a lane change.'},
    {title:'The checkpoint finale',world:'racing',concept:'Debugging & game state',
      instructions:'The checkpoint remembers your visit only when you call checkpoint() while stopped on it. Repair the distances so the car stops at row 3, records its checkpoint, then reaches the finish at row 1.',
      objective:'Activate the checkpoint at column 2, row 3, then finish at column 2, row 1.',
      starter:'const speed = 3;\ndrive(speed);\ncheckpoint();\ndrive(speed);',hint:'Start at row 5. Both the checkpoint and finish are two cells apart. Changing one variable repairs both moves.',
      config:{start:[2,5],goal:[2,1],checkpoint:[2,3]},allowed:racing,
      check:r=>atGoal(r.state)&&r.state.checkpoint,retry:'The finish only counts after checkpoint() has recorded your stop on the checkpoint.'}
  ];
  function assess(lesson, run, program, engine) {
    if (!lesson.check(run,program)) return {success:false,message:lesson.retry};
    for (const probe of lesson.probes || []) {
      try {
        const test=engine.session(program,probe.config,lesson.allowed); test.run();
        if (!probe.check(test)) return {success:false,message:`Extra test failed (${probe.label}). ${lesson.retry}`};
      } catch (e) { return {success:false,message:`Extra test failed (${probe.label}): ${e.message}`}; }
    }
    return {success:true,message:`Mission complete! ${lesson.probes ? 'Visible board and alternate scenario passed.' : 'Your code met the mission requirements.'}`};
  }
  const data={lessons,assess};
  if (typeof module!=='undefined' && module.exports) module.exports=data; else root.GameLessons=data;
})(typeof globalThis!=='undefined' ? globalThis : this);
