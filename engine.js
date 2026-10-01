/* A deliberately small JavaScript interpreter. Student text never reaches eval,
   Function, the DOM, or a browser API. The same engine runs in Node tests. */
(function (root) {
  'use strict';
  const signatures = {moveRight:1, moveLeft:1, moveUp:1, moveDown:1,
    drive:1, shoot:0, aligned:0, obstacleAhead:0, checkpoint:0};
  function fail(message, token) {
    throw new Error(`${token ? `Line ${token.line}: ` : ''}${message}`);
  }
  function tokenize(source) {
    if (source.length > 6000) fail('Keep your program under 6,000 characters.');
    const tokens = []; let pos = 0, line = 1;
    while (pos < source.length) {
      const rest = source.slice(pos);
      const match = /^(\s+|\/\/[^\n]*|\d+(?:\.\d+)?|"[^"\n\\]*"|'[^'\n\\]*'|[A-Za-z_][A-Za-z_0-9]*|===|!==|==|!=|<=|>=|[{}();=,+<>-])/.exec(rest);
      if (!match) fail(`Unexpected character ${JSON.stringify(source[pos])}. Check the supported language below the editor.`, {line});
      const text = match[0];
      if (!/^\s|^\/\//.test(text)) tokens.push({text,line});
      line += (text.match(/\n/g) || []).length; pos += text.length;
    }
    tokens.push({text:'<end>',line}); return tokens;
  }
  function parse(source) {
    const tokens = tokenize(source); let i = 0, depth = 0;
    const peek = () => tokens[i].text;
    const take = () => tokens[i++];
    function expect(text) { const t = take(); if (t.text !== text) fail(`Expected '${text}', found '${t.text}'.`,t); return t; }
    function name() { const t = take(); if (!/^[A-Za-z_]\w*$/.test(t.text) || ['const','let','if','else','function','true','false','onKey'].includes(t.text)) fail('Expected a variable or function name.',t); return t; }
    function guarded(fn) { if (++depth > 25) fail('Too much nesting. Simplify your program.'); const result = fn(); depth--; return result; }
    function atom() {
      return guarded(() => {
        const t = take();
        if (/^\d/.test(t.text)) return {kind:'literal',value:Number(t.text),token:t};
        if (/^["']/.test(t.text)) return {kind:'literal',value:t.text.slice(1,-1),token:t};
        if (['true','false'].includes(t.text)) return {kind:'literal',value:t.text === 'true',token:t};
        if (t.text === '-') return {kind:'binary',op:'-',left:{kind:'literal',value:0},right:atom(),token:t};
        if (t.text === '(') { const e = expression(); expect(')'); return e; }
        if (/^[A-Za-z_]\w*$/.test(t.text)) {
          if (peek() !== '(') return {kind:'variable',name:t.text,token:t};
          take(); const args = [];
          if (peek() !== ')') { args.push(expression()); while (peek() === ',') { take(); args.push(expression()); } }
          expect(')'); return {kind:'call',name:t.text,args,token:t};
        }
        fail(`Expected a value or command, found '${t.text}'.`,t);
      });
    }
    function sum() { let left = atom(); while (['+','-'].includes(peek())) { const t = take(); left = {kind:'binary',op:t.text,left,right:atom(),token:t}; } return left; }
    function expression() { let left = sum(); if (['===','!==','==','!=','<','>','<=','>='].includes(peek())) { const t = take(); left = {kind:'binary',op:t.text,left,right:sum(),token:t}; } return left; }
    function block() { return guarded(() => { expect('{'); const body = statements('}'); expect('}'); return body; }); }
    function statements(end) {
      const body = [];
      while (peek() !== end) {
        if (peek() === '<end>') fail(`Expected '${end}' before the end of the program.`,tokens[i]);
        const t = tokens[i]; let node;
        if (['const','let'].includes(peek())) {
          take(); const n = name(); expect('='); node = {kind:'declare',name:n.text,constant:t.text==='const',value:expression(),token:t}; expect(';');
        } else if (peek() === 'function') {
          take(); const n = name(); expect('('); expect(')'); node = {kind:'function',name:n.text,body:block(),token:t};
        } else if (peek() === 'if') {
          take(); expect('('); const condition = expression(); expect(')'); const yes = block(); let no = [];
          if (peek() === 'else') { take(); no = block(); }
          node = {kind:'if',condition,yes,no,token:t};
        } else if (peek() === 'onKey') {
          take(); expect('('); const key = expression(); expect(','); expect('function'); expect('('); expect(')'); const handler = block(); expect(')'); expect(';'); node = {kind:'event',key,body:handler,token:t};
        } else if (tokens[i+1] && tokens[i+1].text === '=') {
          const n = name(); take(); node = {kind:'assign',name:n.text,value:expression(),token:t}; expect(';');
        } else {
          const value = expression(); if (value.kind !== 'call') fail('Use a command call or a variable declaration.',t);
          node = {kind:'expression',value,token:t}; expect(';');
        }
        body.push(node); if (body.length > 200) fail('Too many statements. Keep the solution short.',t);
      }
      return body;
    }
    return statements('<end>');
  }

  // Validate every branch, including code that would not run in this scenario.
  function validate(program, allowed) {
    const api = new Set(allowed); const globals = new Map();
    function expr(e, scope) {
      if (e.kind === 'literal') return;
      if (e.kind === 'variable') { if (scope.get(e.name) !== 'variable') fail(`Unknown variable '${e.name}'.`,e.token); return; }
      if (e.kind === 'binary') { expr(e.left,scope); expr(e.right,scope); return; }
      if (e.kind === 'call') {
        if (api.has(e.name)) {
          if (e.args.length !== signatures[e.name]) fail(`${e.name} needs ${signatures[e.name]} argument(s).`,e.token);
        } else if (scope.get(e.name) === 'function') {
          if (e.args.length) fail('Your functions take no arguments in this lab.',e.token);
        } else fail(`Unknown or unavailable command '${e.name}'. Check Available commands.`,e.token);
        e.args.forEach(a => expr(a,scope));
      }
    }
    function walk(body, parent, top) {
      const scope = new Map(parent);
      for (const n of body) {
        if (n.kind === 'declare' || n.kind === 'function') {
          if (scope.has(n.name) || Object.hasOwn(signatures,n.name)) fail(`Name '${n.name}' is already used. Choose a different name.`,n.token);
          if (n.kind === 'declare') expr(n.value,scope);
          scope.set(n.name,n.kind === 'declare' ? 'variable' : 'function');
          if (n.kind === 'function') walk(n.body,scope,false);
        } else if (n.kind === 'assign') {
          if (scope.get(n.name) !== 'variable') fail(`Declare '${n.name}' with let before assigning it.`,n.token); expr(n.value,scope);
        } else if (n.kind === 'expression') expr(n.value,scope);
        else if (n.kind === 'if') { expr(n.condition,scope); walk(n.yes,scope,false); walk(n.no,scope,false); }
        else if (n.kind === 'event') {
          if (!top || !api.has('onKey')) fail('onKey is only available at the top level in the events mission.',n.token);
          expr(n.key,scope); walk(n.body,scope,false);
        }
      }
    }
    walk(program,globals,true);
  }
  function createState(config) {
    return {x:config.start[0],y:config.start[1],walls:(config.walls || []).map(p=>[...p]),
      goal:[...config.goal],alien:config.alien ? [...config.alien] : null,
      checkpointAt:config.checkpoint ? [...config.checkpoint] : null,
      checkpoint:false,shots:0,hits:0,moves:0,trace:[],frames:[]};
  }
  const snapshot = s => ({x:s.x,y:s.y,alien:s.alien && [...s.alien],hits:s.hits,shots:s.shots,checkpoint:s.checkpoint});
  function session(program, config, allowed) {
    validate(program,allowed);
    const state = createState(config), handlers = new Map(), globalScope = new Map();
    let operations = 0; const stack = [];
    state.frames.push(snapshot(state));
    function tick(t) { if (++operations > 250) fail('Program limit reached. Remove repeated or recursive calls.',t); }
    function move(dx,dy,amount,t) {
      if (!Number.isInteger(amount) || amount < 1 || amount > 5) fail('Movement needs a whole number from 1 to 5 (without quotes).',t);
      for (let j = 0; j < amount; j++) {
        tick(t); const x = state.x+dx,y = state.y+dy;
        if (x < 0 || x > 7 || y < 0 || y > 5) fail('Boundary reached. Your player cannot leave the board.',t);
        if (state.walls.some(p=>p[0]===x && p[1]===y)) fail('Collision! A wall or obstacle blocks that route. Change direction first.',t);
        state.x=x; state.y=y; state.moves++; state.frames.push(snapshot(state));
      }
    }
    function api(name,args,t) {
      state.trace.push({name,args:[...args],stack:[...stack]});
      if (name === 'moveRight') return move(1,0,args[0],t);
      if (name === 'moveLeft') return move(-1,0,args[0],t);
      if (name === 'moveUp' || name === 'drive') return move(0,-1,args[0],t);
      if (name === 'moveDown') return move(0,1,args[0],t);
      if (name === 'aligned') return Boolean(state.alien && state.x===state.alien[0] && state.y>state.alien[1]);
      if (name === 'obstacleAhead') return state.walls.some(p=>p[0]===state.x && p[1]===state.y-1);
      if (name === 'checkpoint') {
        if (!state.checkpointAt || state.x!==state.checkpointAt[0] || state.y!==state.checkpointAt[1]) fail('You must stop on the checkpoint before calling checkpoint().',t);
        state.checkpoint=true; state.frames.push(snapshot(state)); return;
      }
      if (name === 'shoot') {
        state.shots++;
        const target = state.alien;
        const hit = target && state.x===target[0] && state.y>target[1] && !state.walls.some(p=>p[0]===state.x && p[1]<state.y && p[1]>target[1]);
        const beam = {x:state.x,from:state.y,to:hit ? target[1] : 0};
        state.frames.push({...snapshot(state),beam});
        if (hit) { state.hits++; state.alien=null; }
        state.frames.push(snapshot(state));
      }
    }
    function evaluate(e,scope) {
      tick(e.token);
      if (e.kind === 'literal') return e.value;
      if (e.kind === 'variable') { const cell=scope.get(e.name); if (!cell || cell.kind!=='variable') fail(`Variable '${e.name}' is not available here.`,e.token); return cell.value; }
      if (e.kind === 'binary') {
        const a=evaluate(e.left,scope),b=evaluate(e.right,scope);
        if (['+','-','<','>','<=','>='].includes(e.op) && (typeof a!=='number'||typeof b!=='number')) fail('This operator needs two numbers.',e.token);
        switch(e.op) { case '+':return a+b; case '-':return a-b; case '===':case '==':return a===b; case '!==':case '!=':return a!==b; case '<':return a<b; case '>':return a>b; case '<=':return a<=b; case '>=':return a>=b; }
      }
      if (e.kind === 'call') {
        const args=e.args.map(a=>evaluate(a,scope));
        if (allowed.includes(e.name)) return api(e.name,args,e.token);
        const fn=scope.get(e.name);
        if (!fn || fn.kind!=='function') fail(`Function '${e.name}' is not available here.`,e.token);
        if (stack.length>=8) fail('Too many nested function calls. Check for recursion.',e.token);
        state.trace.push({name:e.name,args:[],stack:[...stack]}); stack.push(e.name);
        try { execute(fn.body,new Map(fn.scope)); } finally { stack.pop(); }
      }
    }
    function execute(body,scope) {
      for (const n of body) {
        tick(n.token);
        if (n.kind==='declare') scope.set(n.name,{kind:'variable',value:evaluate(n.value,scope),constant:n.constant});
        else if (n.kind==='function') scope.set(n.name,{kind:'function',body:n.body,scope});
        else if (n.kind==='assign') {
          const cell=scope.get(n.name); if (!cell || cell.kind!=='variable') fail(`Unknown variable '${n.name}'.`,n.token);
          if (cell.constant) fail(`'${n.name}' is const and cannot be reassigned. Use let for a changing value.`,n.token);
          cell.value=evaluate(n.value,scope);
        } else if (n.kind==='expression') evaluate(n.value,scope);
        else if (n.kind==='if') {
          const condition=evaluate(n.condition,scope);
          if (typeof condition!=='boolean') fail('The if condition must be true or false. Use a sensor or comparison.',n.token);
          execute(condition ? n.yes : n.no,new Map(scope));
        } else if (n.kind==='event') {
          const key=evaluate(n.key,scope);
          if (!['ArrowRight','Space'].includes(key)) fail('Use "ArrowRight" or "Space" as the event name.',n.token);
          if (handlers.has(key)) fail(`Only one handler per key: '${key}'.`,n.token);
          handlers.set(key,{body:n.body,scope});
        }
      }
    }
    return {state,handlers,globals:globalScope,
      run() { execute(program,globalScope); return state; },
      key(key) { const fn=handlers.get(key); if (!fn) fail(`No handler registered for '${key}'. Add onKey first.`); stack.push(`key:${key}`); try { execute(fn.body,new Map(fn.scope)); } finally { stack.pop(); } return state; }
    };
  }
  const engine={parse,validate,session,createState,snapshot};
  if (typeof module !== 'undefined' && module.exports) module.exports=engine;
  else root.GameEngine=engine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
