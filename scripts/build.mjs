import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const assets = path.join(dist, 'assets');
const modules = path.join(assets, 'modules');
const assetCache = path.join(root, '.asset-cache');

const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 16);

await rm(dist, { recursive: true, force: true });
await mkdir(modules, { recursive: true });

// Retain previous fingerprinted files so a briefly cached older HTML page
// can still load the exact assets it references after a new deployment.
try {
  await cp(assetCache, assets, { recursive: true, force: true });
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

async function copyHashed(source, targetDir = assets) {
  const data = await readFile(path.join(root, source));
  const ext = path.extname(source);
  const base = path.basename(source, ext);
  const filename = `${base}-${hash(data)}${ext}`;
  await mkdir(targetDir, { recursive: true });
  await writeFile(path.join(targetDir, filename), data);
  return path.posix.join(path.relative(dist, targetDir).split(path.sep).join('/'), filename);
}

const completed = new Map();
const visiting = new Set();

async function buildModule(relativeSource) {
  const absolute = path.resolve(root, relativeSource);
  if (!absolute.startsWith(root + path.sep)) {
    throw new Error(`Module escapes repository: ${relativeSource}`);
  }
  if (completed.has(absolute)) return completed.get(absolute);
  if (visiting.has(absolute)) {
    throw new Error(`Circular local module import detected: ${relativeSource}`);
  }

  visiting.add(absolute);
  let source = await readFile(absolute, 'utf8');
  const importPatterns = [
    /(\\b(?:from\\s*|import\\s+))(["'])([^"']+)\\2/g,
    /(\\bimport\\s*\\(\\s*)(["'])([^"']+)\\2(\\s*\\))/g,
  ];
  const matches = [];
  for (const pattern of importPatterns) {
    for (const match of source.matchAll(pattern)) matches.push(match);
  }
  matches.sort((a, b) => b.index - a.index);

  for (const match of matches) {
    const specifier = match[3];
    if (!specifier.startsWith('.')) continue;

    const cleanSpecifier = specifier.split(/[?#]/, 1)[0];
    if (!/\\.(?:m?js)$/.test(cleanSpecifier)) {
      throw new Error(`Unsupported local import in ${relativeSource}: ${specifier}`);
    }

    const childSource = path.resolve(path.dirname(absolute), cleanSpecifier);
    const child = await buildModule(path.relative(root, childSource).split(path.sep).join('/'));
    const replacement = `./${child.filename}`;
    const quote = match[2];
    const prefix = match[1];
    const suffix = match[4] || '';
    const full = `${prefix}${quote}${specifier}${quote}${suffix}`;
    const updated = `${prefix}${quote}${replacement}${quote}${suffix}`;
    source = source.slice(0, match.index) + updated + source.slice(match.index + full.length);
  }

  const ext = path.extname(absolute);
  const base = path.basename(absolute, ext);
  const filename = `${base}-${hash(source)}${ext}`;
  await writeFile(path.join(modules, filename), source);

  const result = { filename, url: `assets/modules/${filename}` };
  completed.set(absolute, result);
  visiting.delete(absolute);
  return result;
}

// Keep the two entry points separate, but rewrite every local module link to
// its content-hashed filename. No application logic is bundled or changed.
const app = await buildModule('app.js');
const chatUi = await buildModule('chat/ui.mjs');

const [originalCss, stylesCss, luxuryCss, chatCss, configJs, supabaseJs] = await Promise.all([
  copyHashed('original.css'),
  copyHashed('styles.css'),
  copyHashed('luxury.css'),
  copyHashed('chat/chat.css'),
  copyHashed('config.js'),
  copyHashed('vendor/supabase.js'),
]);

let html = await readFile(path.join(root, 'index.html'), 'utf8');

function replaceReference(attribute, original, replacement) {
  const escaped = original.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(${attribute}=["'])${escaped}(?:\\\\?[^"']*)?(["'])`, 'g');
  const matches = [...html.matchAll(pattern)];
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${attribute} reference to ${original}; found ${matches.length}`);
  }
  html = html.replace(pattern, `$1${replacement}$2`);
}

for (const [source, target] of [
  ['original.css', originalCss],
  ['styles.css', stylesCss],
  ['luxury.css', luxuryCss],
  ['chat/chat.css', chatCss],
  ['config.js', configJs],
  ['vendor/supabase.js', supabaseJs],
  ['app.js', app.url],
  ['chat/ui.mjs', chatUi.url],
]) {
  replaceReference(source.endsWith('.css') ? 'href' : 'src', source, target);
}

await writeFile(path.join(dist, 'index.html'), html);
await writeFile(path.join(dist, '.nojekyll'), '');

for (const file of ['SUPABASE-LICENSE', 'VERSION.txt']) {
  try {
    const data = await readFile(path.join(root, 'vendor', file));
    await mkdir(path.join(assets, 'vendor'), { recursive: true });
    await writeFile(path.join(assets, 'vendor', file), data);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

// Save current and previous versions for the next deployment's artifact.
await rm(assetCache, { recursive: true, force: true });
await cp(assets, assetCache, { recursive: true });

console.log(`Built fingerprinted preview assets: ${completed.size} modules, 4 stylesheets, config and Supabase client.`);
