// Fails if any admin entry point could run without checking the admin role.
// Run with `pnpm check:admin` (also part of `pnpm lint`).
//
// Rules:
// 1. In src/app/admin, every exported async function (pages, layouts,
//    generateMetadata, route handlers) awaits `requireAdmin(` before any other
//    await. Reading route `params`/`searchParams` first is allowed.
// 2. In src/lib/admin/actions, every exported async function's first statement
//    awaits `requireAdmin(`. Server actions are public POST endpoints.
// 3. Admin code may only export functions declared as `export async function`
//    (or default), so nothing slips past rules 1 and 2.
// 4. `@/db/admin-queries` is only imported from admin pages and admin actions.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const problems = [];

function walk(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out = out.concat(walk(path));
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}
const exists = (dir) => {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
};

/** Strip comments so commented-out calls don't count. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Exported async functions with their bodies (brace-matched). */
function exportedAsyncFunctions(source) {
  const found = [];
  const re = /export\s+(default\s+)?async\s+function\s*([A-Za-z0-9_]*)\s*\(/g;
  let m;
  while ((m = re.exec(source))) {
    // Skip the parameter list (which may contain braces), then match the body.
    let i = re.lastIndex;
    let depth = 1;
    while (depth > 0 && i < source.length) {
      if (source[i] === "(") depth++;
      else if (source[i] === ")") depth--;
      i++;
    }
    const open = source.indexOf("{", i);
    depth = 1;
    let k = open + 1;
    while (depth > 0 && k < source.length) {
      if (source[k] === "{") depth++;
      else if (source[k] === "}") depth--;
      k++;
    }
    found.push({ name: m[2] || "default", body: source.slice(open + 1, k - 1) });
  }
  return found;
}

/** Statements at the top level of a function body, roughly split on `;`. */
function statements(body) {
  return body
    .split(/;\s*\n|;\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);
}

function otherExports(source) {
  const bad = [];
  for (const m of source.matchAll(/export\s+(const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(async\b|\(|function\b)/g)) {
    bad.push(m[2]);
  }
  return bad;
}

// Rule 1: admin routes.
const appAdmin = join(root, "src/app/admin");
const routeFiles = walk(appAdmin).filter((f) => /\/(page|layout|route|template|default)\.tsx?$/.test(f));
if (routeFiles.length === 0) problems.push("src/app/admin: no route files found (wrong path?)");
for (const file of routeFiles) {
  const source = stripComments(readFileSync(file, "utf8"));
  const rel = relative(root, file);
  const fns = exportedAsyncFunctions(source);
  if (fns.length === 0) problems.push(`${rel}: no exported async function; admin route files must be async and call requireAdmin`);
  for (const { name, body } of fns) {
    const awaited = statements(body).filter((s) => /\bawait\b/.test(s));
    const first = awaited.find((s) => !/^\s*(const|let)\s+[^=]+=\s*await\s+(params|searchParams)\b/.test(s) && !/^\s*await\s+(params|searchParams)\b/.test(s));
    if (!first || !/\bawait\s+requireAdmin\(/.test(first)) {
      problems.push(`${rel}: ${name}() must await requireAdmin(...) before any other await`);
    }
  }
  for (const name of otherExports(source)) {
    problems.push(`${rel}: export ${name} is a function expression; use "export async function" so the guard can check it`);
  }
}

// Rule 2: admin server actions.
const actionsDir = join(root, "src/lib/admin/actions");
if (exists(actionsDir)) {
  for (const file of walk(actionsDir)) {
    const source = stripComments(readFileSync(file, "utf8"));
    const rel = relative(root, file);
    if (!/^\s*["']use server["']/.test(source)) problems.push(`${rel}: admin action files must start with "use server"`);
    for (const { name, body } of exportedAsyncFunctions(source)) {
      const [first] = statements(body);
      if (!first || !/^(const\s+[^=]+=\s*)?await\s+requireAdmin\(/.test(first)) {
        problems.push(`${rel}: ${name}() must call await requireAdmin(...) as its first statement`);
      }
    }
    for (const name of otherExports(source)) {
      problems.push(`${rel}: export ${name} is a function expression; use "export async function" so the guard can check it`);
    }
  }
}

// Rule 4: admin queries stay inside admin code.
for (const file of walk(join(root, "src"))) {
  const rel = relative(root, file);
  if (rel === "src/db/admin-queries.ts") continue;
  if (!/@\/db\/admin-queries|\.\/admin-queries/.test(readFileSync(file, "utf8"))) continue;
  if (!rel.startsWith("src/app/admin/") && !rel.startsWith("src/lib/admin/")) {
    problems.push(`${rel}: imports @/db/admin-queries outside src/app/admin and src/lib/admin`);
  }
}

if (problems.length > 0) {
  console.error(`Admin guard check failed (${problems.length}):\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log(`Admin guard check passed: ${routeFiles.length} route files${exists(actionsDir) ? ", admin actions" : ""}.`);
