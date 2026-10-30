import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, extname, relative } from 'node:path';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
const root = process.cwd();
const remote = process.argv.includes('--remote');
const roots = ['README.md','README.cs.md','BRANDING.md','AI_USAGE.md','ARCHITECTURE.md','PRIVACY.md','SECURITY.md','CONTRIBUTING.md','LIMITATIONS.md','docs','design-system'];
const files: string[] = [];
const urls = new Set<string>();
const anchorCache = new Map<string, Set<string>>();
let failures = 0, anchorsChecked = 0, localChecked = 0, skipped = 0;
const withoutFences = (text: string) => text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm,'');
async function collect(path: string) {
  const info = await stat(path);
  if (info.isDirectory()) { for (const entry of await readdir(path)) await collect(resolve(path,entry)); }
  else if (extname(path) === '.md') files.push(path);
}
async function anchors(file: string) {
  if (anchorCache.has(file)) return anchorCache.get(file)!;
  const text = withoutFences(await readFile(file,'utf8'));
  const found = new Set<string>();
  const counts = new Map<string,number>();
  for (const match of text.matchAll(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const slug = match[1].replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/<[^>]*>/g,'').toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu,'').replace(/\s/g,'-');
    const count = counts.get(slug) ?? 0; counts.set(slug,count+1);
    found.add(count ? `${slug}-${count}` : slug);
  }
  for (const match of text.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) found.add(match[1]);
  anchorCache.set(file,found); return found;
}
function isPublicAddress(address: string) {
  if (isIP(address) === 6) return /^(?:2|3)/i.test(address) && !/^2001:db8:/i.test(address);
  const octets = address.split('.').map(Number), [a,b] = octets;
  return octets.length===4 && a>0 && a<224 && ![10,127].includes(a) && !(a===169&&b===254) && !(a===172&&b>=16&&b<=31) && !(a===192&&b===168) && !(a===100&&b>=64&&b<=127);
}
async function checkRemote(value: string) {
  let url = new URL(value);
  for (let hop=0;hop<6;hop++) {
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.port && !['80','443'].includes(url.port)) throw new Error('unsupported destination');
    const addresses = await lookup(url.hostname,{all:true});
    if (!addresses.length || addresses.some(item=>!isPublicAddress(item.address))) throw new Error('non-public destination');
    let response = await fetch(url,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(8000)});
    if ([405,501].includes(response.status)) response = await fetch(url,{headers:{Range:'bytes=0-0'},redirect:'manual',signal:AbortSignal.timeout(8000)});
    await response.body?.cancel();
    if ([301,302,303,307,308].includes(response.status)) { const location=response.headers.get('location'); if (!location) throw new Error('redirect missing location'); url=new URL(location,url); continue; }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return;
  }
  throw new Error('too many redirects');
}
async function main() {
  for (const path of roots) await collect(resolve(root,path));
  for (const file of files) {
    const markdown = withoutFences(await readFile(file,'utf8'));
    const targets = [...markdown.matchAll(/!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)].map(match=>match[1].replace(/^<|>$/g,''));
    targets.push(...[...markdown.matchAll(/<(?:img|a)\b[^>]*\b(?:src|href)=["']([^"']+)["']/g)].map(match=>match[1]));
    for (const target of targets) {
      if (/^https?:/i.test(target)) {
        const url = new URL(target);
        if (url.hostname==='localhost' || url.hostname==='127.0.0.1' || /\.(example|test|invalid)$/.test(url.hostname)) { skipped++; continue; }
        url.hash=''; urls.add(url.href); continue;
      }
      if (/^(?:[a-z]+:|\/\/)/i.test(target)) { skipped++; continue; }
      try {
        const [rawPath,rawAnchor] = target.split('#');
        const path = decodeURIComponent(rawPath.split('?')[0]);
        const destination = path ? resolve(target.startsWith('/') ? root : dirname(file),path.replace(/^\//,'')) : file;
        if (relative(root,destination).startsWith('..')) throw new Error('target escapes repository');
        await stat(destination); localChecked++;
        if (rawAnchor && extname(destination)==='.md') { anchorsChecked++; if (!(await anchors(destination)).has(decodeURIComponent(rawAnchor))) throw new Error('heading anchor not found'); }
      } catch(error) { console.error(`${relative(root,file)}: ${target}: ${error instanceof Error ? error.message : 'invalid link'}`); failures++; }
    }
  }
  if (remote) {
    const queue = [...urls];
    await Promise.all(Array.from({length:4},async()=>{while(queue.length) { const url=queue.shift()!; try { await checkRemote(url); } catch(error) { failures++; console.error(`${url}: ${error instanceof Error ? error.message : 'request failed'}`); }}}));
  }
  console.log(`${files.length} Markdown files; ${localChecked} local targets; ${anchorsChecked} anchors; ${urls.size} remote URLs ${remote?'checked (HTTP status, not remote anchors)':'not checked (use --remote)'}; ${skipped} local/example/non-HTTP URLs skipped; ${failures} failures.`);
  process.exitCode=failures?1:0;
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Link check failed');process.exitCode=1;});
