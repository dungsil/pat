import { readFile } from 'node:fs/promises'
import { parseYaml } from './parser/yaml'

const content = await readFile('vic3/Better Politics Mod/upstream/better-politics-mod/localization/english/BPM_acw_events_l_english.yml', 'utf-8')
const parsed = parseYaml(content)

const key = 'bpm_acw_events.314.f'
const [value] = parsed['l_english'][key]

console.log('Parsed value:')
console.log(value)
console.log('\nLength:', value.length)
console.log('Contains literal \\n?', value.includes('\\n'))
console.log('Contains actual newline?', value.includes('\n'))
console.log('\nFirst 50 chars:', value.substring(0, 50))
console.log('Last 50 chars:', value.substring(value.length - 50))
console.log('\nCharacter codes around position 183 (where \\n should be):')
for (let i = 180; i < 190 && i < value.length; i++) {
  console.log(`  [${i}]: "${value[i]}" (code: ${value.charCodeAt(i)})`)
}
