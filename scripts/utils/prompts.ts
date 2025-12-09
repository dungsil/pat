import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type GameType } from './types'
import { getTranslationMemories, getProperNouns } from './dictionary'

// Re-export GameType for backward compatibility
export type { GameType }

// 프로젝트 루트 디렉토리
const projectRoot = join(import.meta.dirname, '../..')

/**
 * Load a Markdown prompt from the repository prompts directory and apply template substitutions.
 *
 * @param filename - Path to the prompt file relative to the `prompts/` directory
 * @param gameType - Game type used to generate translation memory and proper-noun substitutions
 * @returns The prompt content with `{{TRANSLATION_MEMORY}}` and `{{PROPER_NOUNS_DICTIONARY}}` replaced
 * @throws Error if the file cannot be read or processing fails
 */
function loadPromptFromFile(filename: string, gameType: GameType): string {
  const filePath = join(projectRoot, 'prompts', filename)
  try {
    let content = readFileSync(filePath, 'utf-8')
    
    // 템플릿 치환
    content = content.replace(/\{\{TRANSLATION_MEMORY\}\}/g, getTranslationMemories(gameType))
    content = content.replace(/\{\{PROPER_NOUNS_DICTIONARY\}\}/g, getProperNounsForPrompt(gameType))
    
    return content
  } catch (error: any) {
    throw new Error(`Failed to load prompt from ${filename}: ${error.message}`)
  }
}

/**
 * Produce a string of proper-noun examples formatted for inclusion in transliteration prompts.
 *
 * @param gameType - The game identifier used to select which proper-noun dictionary to format
 * @returns A newline-joined list of entries in the form ` - "key" → "value"`, or the placeholder `"(No transliteration examples available for this game yet)"` if the dictionary is empty
 */
function getProperNounsForPrompt(gameType: GameType): string {
  const properNouns = getProperNouns(gameType)
  const entries = Object.entries(properNouns)
  
  if (entries.length === 0) {
    return '(No transliteration examples available for this game yet)'
  }
  
  return entries.map(([key, value]) => ` - "${key}" → "${value}"`).join('\n')
}

// 프롬프트 상수들 (외부 파일에서 로드)
export const CK3_SYSTEM_PROMPT = loadPromptFromFile('ck3-translation.md', 'ck3')
export const STELLARIS_SYSTEM_PROMPT = loadPromptFromFile('stellaris-translation.md', 'stellaris')
export const VIC3_SYSTEM_PROMPT = loadPromptFromFile('vic3-translation.md', 'vic3')
export const CK3_TRANSLITERATION_PROMPT = loadPromptFromFile('ck3-transliteration.md', 'ck3')
export const STELLARIS_TRANSLITERATION_PROMPT = loadPromptFromFile('stellaris-transliteration.md', 'stellaris')
export const VIC3_TRANSLITERATION_PROMPT = loadPromptFromFile('vic3-transliteration.md', 'vic3')

/**
 * Selects the appropriate system prompt for a given game.
 *
 * When `useTransliteration` is true, returns the game's transliteration prompt; otherwise returns the standard system prompt.
 *
 * @param gameType - The game identifier ('ck3', 'stellaris', or 'vic3')
 * @param useTransliteration - If true, return the transliteration prompt instead of the standard prompt
 * @returns The prompt text for the requested game and mode
 * @throws Error if `gameType` is not supported
 */
export function getSystemPrompt(gameType: GameType, useTransliteration: boolean = false): string {
  if (useTransliteration) {
    switch (gameType) {
      case 'ck3':
        return CK3_TRANSLITERATION_PROMPT
      case 'stellaris':
        return STELLARIS_TRANSLITERATION_PROMPT
      case 'vic3':
        return VIC3_TRANSLITERATION_PROMPT
      default:
        throw new Error(`Unsupported game type: ${gameType}`)
    }
  }

  switch (gameType) {
    case 'ck3':
      return CK3_SYSTEM_PROMPT
    case 'stellaris':
      return STELLARIS_SYSTEM_PROMPT
    case 'vic3':
      return VIC3_SYSTEM_PROMPT
    default:
      throw new Error(`Unsupported game type: ${gameType}`)
  }
}

/**
 * 파일명을 기반으로 음역 모드를 사용해야 하는지 판단합니다.
 * culture, dynasty, names 등의 키워드가 포함된 파일은 음역 모드를 사용합니다.
 * 
 * @param filename 검사할 파일명
 * @returns 음역 모드를 사용해야 하면 true
 */
export function shouldUseTransliteration(filename: string): boolean {
  const lowerFilename = filename.toLowerCase()
  
  // 음역 대상 키워드 목록
  // - 'culture', 'cultures': 문화 이름 파일 (예: rice_cultures_l_english.yml)
  // - 'dynasty', 'dynasties': 왕조 이름 파일 (예: wap_dynasty_names_l_english.yml)
  // - 'names': 이름 파일 (예: RICE_sea_character_names_l_english.yml)
  // - 'character_name': 단수형 패턴 (예: character_name_list_l_english.yml)
  // - 'name_list': 이름 목록 파일 (예: culture_name_lists_l_english.yml)
  const transliterationKeywords = [
    'culture',
    'cultures',
    'dynasty',
    'dynasties',
    'names',
    'character_name',
    'name_list',
  ]
  
  // 파일명을 구분자(_,-, /)로 분할하여 세그먼트 확인
  const segments = lowerFilename.split(/[_\-\/]/)
  
  // 각 키워드에 대해:
  // 1. 단일 단어 키워드(culture, cultures, dynasty, dynasties, names)는 세그먼트와 정확히 일치해야 함
  // 2. 복합 키워드(character_name, name_list)는 원본 파일명에 포함되어 있으면 매치
  return transliterationKeywords.some(keyword => {
    if (keyword.includes('_')) {
      // 복합 키워드는 원본 파일명에 포함되어 있는지 확인
      return lowerFilename.includes(keyword)
    } else {
      // 단일 키워드는 세그먼트와 정확히 일치하는지 확인 (false positive 방지)
      return segments.includes(keyword)
    }
  })
}