/* Static reference audit.

   The route sweep only exercises the markup a given seeded dataset happens to produce. This
   pass reads the source itself and checks EVERY call site — in code and inside inline-handler
   strings — against what the loaded app actually defines on `window` / `App`. It is the check
   that catches a branch the sweep never rendered (an empty-state button, an error path, a
   permission combination nobody seeded).
*/
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const W = window;
// jsdom rewrites import.meta.url to the page origin, so resolve from the vitest CWD instead.
const SRC = resolve(process.cwd(), 'src');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

const FILES = walk(SRC).filter(p => !p.endsWith('/main.js') && !p.endsWith('/vendor.js'));
const ALL_SRC = FILES.map(f => readFileSync(f, 'utf8')).join('\n');

// Strip comments so a reference inside a `// note about _oldThing()` never counts as a call.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

describe('every call site resolves against the loaded app', () => {
  it('App.* calls', () => {
    const missing = new Set();
    for (const f of FILES) {
      const src = stripComments(readFileSync(f, 'utf8'));
      const rel = relative(SRC, f);
      // A call, not an assignment: `App.foo(` but not `App.foo=`.
      for (const m of src.matchAll(/App\.([A-Za-z_$][\w$]*)\s*\(/g)) {
        const name = m[1];
        if (typeof (W.App || {})[name] === 'function') continue;
        // A few handlers are assigned inside the renderer that emits them, so they only exist once
        // that page has run. An assignment anywhere in the source is proof the target still ships.
        if (new RegExp('App\\.' + name + '\\s*=').test(ALL_SRC)) continue;
        missing.add('App.' + name + '  <- ' + rel);
      }
    }
    expect([...missing].sort()).toEqual([]);
  });

  it('module-level function calls (_foo / fooPage)', () => {
    const missing = new Set();
    for (const f of FILES) {
      const src = stripComments(readFileSync(f, 'utf8'));
      const rel = relative(SRC, f);
      for (const m of src.matchAll(/(?<![\w$.'"])(_[A-Za-z][\w$]*|[A-Za-z$][\w$]*(?:Page|Dash))\s*\(/g)) {
        const name = m[1];
        if (typeof W[name] === 'function') continue;
        if (typeof (W.App || {})[name] === 'function') continue;
        // A local is legitimate: any declaration of the name in this same file puts it in scope.
        // Covers `function f(){}`, `const f=`, comma-lists (`const a=1,f=2`), destructuring and params.
        const declared = new RegExp('(?:function\\s+' + name + '\\b)|(?:\\b' + name + '\\s*=[^=])|(?:[({,\\[]\\s*' + name + '\\s*[,)\\]}=])').test(src);
        if (!declared) missing.add(name + '  <- ' + rel);
      }
    }
    expect([...missing].sort()).toEqual([]);
  });
});

describe('no source file still references a retired module', () => {
  const RETIRED_SYMBOLS = ['attendancePage', 'leavePage', 'payrollPage', 'okrPage', 'shiftsPage',
    'overtimePage', 'lifecyclePage', 'lettersPage', 'disciplinePage', 'surveysPage', 'reviewsPage',
    'hrmConfigPage', 'hrmAnalyticsPage', 'docsPage', '_clockWidget', '_whoIsInWidget', '_drawOKRCharts',
    '_drawHrmCharts', '_personalDocsSection', '_scopeDocsTab', '_balanceFor', '_leaveYearOf', 'ltById',
    'clockIn', 'clockOut', 'applyLeave', 'decideLeave', '_flowStart', '_svTargetsFor'];

  it.each(RETIRED_SYMBOLS)('%s is gone from the source', (sym) => {
    const hits = [];
    for (const f of FILES) {
      const src = stripComments(readFileSync(f, 'utf8'));
      if (new RegExp('(?<![\\w$.])' + sym + '\\s*\\(').test(src)) hits.push(relative(SRC, f));
    }
    expect(hits).toEqual([]);
  });
});
