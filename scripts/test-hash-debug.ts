import { readFile } from 'node:fs/promises'
import { parseYaml } from './parser/yaml'
import { hashing } from './utils/hashing'

const content = await readFile('vic3/Better Politics Mod/upstream/better-politics-mod/localization/english/BPM_acw_events_l_english.yml', 'utf-8')
const parsed = parseYaml(content)

const key = 'bpm_acw_events.314.f'

console.log('Available top-level keys:', Object.keys(parsed))

if (parsed['l_english']) {
  const keys = Object.keys(parsed['l_english'])
  const matching = keys.filter(k => k.includes('314'))
  console.log('Keys containing 314:', matching)
  
  if (parsed['l_english'][key]) {
    const [sourceValue] = parsed['l_english'][key]
    console.log('\nParsed value:', JSON.stringify(sourceValue))
    console.log('Hash:', hashing(sourceValue))
  } else {
    console.log('\nKey not found:', key)
  }
}
