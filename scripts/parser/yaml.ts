export function parseYaml (content: string): Record<string, Record<string, [string, string | null]>> {
  // 줄바꿈 정규화: Unix (LF) 및 Windows (CRLF) 줄바꿈 처리
  const lines = content.split(/\r?\n/)
  const parsedContent: Record<string, Record<string, [string, string | null]>> = {}
  let currentKey = ''

  for (const line of lines) {
    if (line.trim().startsWith('#')) continue // 주석 건너뛰기

    const keyMatch = line.match(/^(\s*)?(.+?):\s*(\d+)?\s*(.*)$/)

    if (keyMatch) {
      const [, , key, , value] = keyMatch

      if (!currentKey) {
        currentKey = key
        parsedContent[currentKey] = {}
      } else {
        const [text, comment] = parseYamlValue(value)
        if (text !== '') {
          parsedContent[currentKey][key] = [text, comment]
        }
      }
    }
  }

  return parsedContent
}

function parseYamlValue (value: string): [string, string | null] {
  const [, text, comment] = /^"(.+)"(?:\s+)?(?:#(?:\s+)?(.+))?$/.exec(value) || []

  // console.log(`파싱된 값: ${text} | ${comment}`)

  // 텍스트가 비어 있으면 빈 문자열 반환
  if (!text) {
    return ['', null]
  }

  return [text, comment || null]
}

export function stringifyYaml (data: Record<string, Record<string, [string, string | null]>>): string {
  let result = ''

  for (const [topKey, topValue] of Object.entries(data)) {
    result += `\uFEFF${topKey}:\n` // '\uFEFF' : UTF-8 BOM

    for (const [key, [translatedText, hash]] of Object.entries(topValue)) {
      if (!translatedText) {
        result += '\n'
        continue
      }

      const encodedTranslatedText = translatedText.replaceAll(/((?<!\\)(\\\\)*)"/g, '$1\\"')
      const hashComment = hash ? ` # ${hash}` : ''
      result += `  ${key}: "${encodedTranslatedText}"${hashComment}\n`
    }

  }
  return result
}
