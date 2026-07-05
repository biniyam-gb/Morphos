// tests/smoke-test.mjs — construction + interaction smoke test for every
// registered system. Run with: node tests/smoke-test.mjs
//
// Catches: constructor crashes (e.g. a getter/field name conflict), missing
// required methods, paramDefs referencing keys absent from params, and
// mouse-handler exceptions. Does NOT check rendered pixel output — this is
// a "does it even load" safety net, not a visual regression test.
import { SYSTEMS } from '../js/systems/index.js';

let failures = 0, passed = 0;

for (const sys of SYSTEMS) {
  const tag = `[${sys.group}] ${sys.name} (${sys.id})`;
  try {
    const inst = sys.create(800, 800);
    const problems = [];

    if (!Array.isArray(inst.paramDefs)) problems.push('paramDefs not array');
    if (!Array.isArray(inst.presets))   problems.push('presets not array');
    if (typeof inst.render !== 'function') problems.push('no render()');
    if (typeof inst.update !== 'function') problems.push('no update()');
    if (typeof inst.reset  !== 'function') problems.push('no reset()');
    if (typeof inst.description !== 'string') problems.push(`description not string (${typeof inst.description})`);
    if (typeof inst.getFormula === 'function' && typeof inst.getFormula() !== 'string') problems.push('getFormula() not string');

    for (const grp of inst.paramDefs) {
      for (const item of (grp.items || [])) {
        if (item.type === 'button' || item.type === 'hint' || item.id.startsWith('_')) continue;
        if (!(item.id in inst.params)) problems.push(`paramDef '${item.id}' missing from params`);
      }
    }

    for (const p of inst.presets.slice(0, 6)) {
      Object.assign(inst.params, p.params);
      inst.onParamChange?.('_preset');
      inst.reset();
    }
    for (let i = 0; i < 5; i++) inst.update();
    inst.reset();

    for (const m of ['onClick', 'onDblClick', 'onMouseDown', 'onMouseUp']) {
      if (typeof inst[m] === 'function') { try { inst[m](400, 400, 800, 800, {}); } catch (e) { problems.push(`${m}() threw: ${e.message}`); } }
    }
    if (typeof inst.onMouseDrag === 'function') { try { inst.onMouseDrag(5, 5, 400, 400, 800, 800); } catch (e) { problems.push(`onMouseDrag() threw: ${e.message}`); } }
    if (typeof inst.onWheel === 'function') { try { inst.onWheel(400, 400, -1, 800, 800); } catch (e) { problems.push(`onWheel() threw: ${e.message}`); } }
    if (typeof inst.coordInfo === 'function') { try { inst.coordInfo(400, 400, 800, 800); } catch (e) { problems.push(`coordInfo() threw: ${e.message}`); } }

    if (problems.length) { console.log(`FAIL  ${tag}\n   - ${problems.join('\n   - ')}`); failures++; }
    else { console.log(`ok    ${tag}`); passed++; }
  } catch (e) {
    console.log(`CRASH ${tag}\n   ${e.stack.split('\n').slice(0, 3).join('\n   ')}`);
    failures++;
  }
}

console.log(`\n${passed} passed, ${failures} failed, ${SYSTEMS.length} total`);
process.exit(failures > 0 ? 1 : 0);
