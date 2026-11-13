// Writes pair.wat's WebAssembly bytes into pair.js: wat2wasm pair.wat -o pair.wasm && node scripts/pair.js
import { readFileSync, writeFileSync } from 'node:fs'
let here = new URL('../', import.meta.url), bytes = readFileSync(new URL('pair.wasm', here)), js = readFileSync(new URL('pair.js', here), 'utf8')
let rows = [], line = '\t'
for (let b of bytes) { let s = b + ','; if (line.length + s.length > 120) { rows.push(line); line = '\t' } line += s }
rows.push(line)
let out = js.replace(/(const WASM = new Uint8Array\(\[)[^]*?(\]\))/, `$1\n${rows.join("\n")}\n$2`)
  .replace(/\/\/ pair\.wat, compiled by wat2wasm \([\d,]+ bytes\)/, `// pair.wat, compiled by wat2wasm (${bytes.length.toLocaleString('en')} bytes)`)
writeFileSync(new URL('pair.js', here), out)
console.log(`pair.js: ${bytes.length} bytes`)
