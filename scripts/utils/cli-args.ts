import { type DictionaryChangeOptions } from './dictionary-changes'

export interface ParsedDictionaryFilterArgs extends DictionaryChangeOptions {
  hasFilterOptions: boolean
}

/**
 * CLI 인자에서 딕셔너리 필터링 옵션을 파싱합니다.
 * --since-commit, --commit-range, --since-date 옵션을 지원합니다.
 * @param args CLI 인자 배열 (process.argv.slice(3)으로 전달)
 */
export function parseDictionaryFilterArgs(args: string[]): ParsedDictionaryFilterArgs {
  let sinceCommit: string | undefined
  let commitRange: string | undefined
  let sinceDate: string | undefined
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--since-commit' && args[i + 1]) {
      sinceCommit = args[i + 1]
      i++
    } else if (args[i] === '--commit-range' && args[i + 1]) {
      commitRange = args[i + 1]
      i++
    } else if (args[i] === '--since-date' && args[i + 1]) {
      sinceDate = args[i + 1]
      i++
    }
  }
  
  const hasFilterOptions = !!(sinceCommit || commitRange || sinceDate)
  
  return {
    sinceCommit,
    commitRange,
    sinceDate,
    hasFilterOptions
  }
}
