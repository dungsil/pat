import { describe, it, expect } from 'vitest'
import { getSystemPrompt, CK3_SYSTEM_PROMPT, STELLARIS_SYSTEM_PROMPT, VIC3_SYSTEM_PROMPT } from './prompts'

describe('시스템 프롬프트', () => {
  describe('getSystemPrompt', () => {
    it('CK3 게임 타입에 대해 CK3 프롬프트를 반환해야 함', () => {
      const prompt = getSystemPrompt('ck3')
      
      expect(prompt).toBe(CK3_SYSTEM_PROMPT)
      expect(prompt).toContain('Crusader Kings III')
      expect(prompt).toContain('medieval')
    })

    it('Stellaris 게임 타입에 대해 Stellaris 프롬프트를 반환해야 함', () => {
      const prompt = getSystemPrompt('stellaris')
      
      expect(prompt).toBe(STELLARIS_SYSTEM_PROMPT)
      expect(prompt).toContain('Stellaris')
      expect(prompt).toContain('science fiction')
    })

    it('VIC3 게임 타입에 대해 VIC3 프롬프트를 반환해야 함', () => {
      const prompt = getSystemPrompt('vic3')
      
      expect(prompt).toBe(VIC3_SYSTEM_PROMPT)
      expect(prompt).toContain('Victoria 3')
      expect(prompt).toContain('19th century')
    })

    it('지원하지 않는 게임 타입에 대해 오류를 발생시켜야 함', () => {
      expect(() => getSystemPrompt('invalid' as any)).toThrow('Unsupported game type: invalid')
    })
  })

  describe('프롬프트 내용 검증', () => {
    it('모든 프롬프트에 번역 지침이 포함되어야 함', () => {
      expect(CK3_SYSTEM_PROMPT).toContain('Translation Instructions')
      expect(STELLARIS_SYSTEM_PROMPT).toContain('Translation Instructions')
      expect(VIC3_SYSTEM_PROMPT).toContain('Translation Memory')
    })

    it('모든 프롬프트에 변수 보존 규칙이 포함되어야 함', () => {
      expect(CK3_SYSTEM_PROMPT).toContain('Preserve all variables')
      expect(STELLARIS_SYSTEM_PROMPT).toContain('Preserve all variables')
      expect(VIC3_SYSTEM_PROMPT).toContain('Preserve all variables')
    })

    it('CK3 프롬프트에 중세 관련 지침이 포함되어야 함', () => {
      expect(CK3_SYSTEM_PROMPT).toContain('Duke')
      expect(CK3_SYSTEM_PROMPT).toContain('공작')
      expect(CK3_SYSTEM_PROMPT).toContain('medieval')
    })

    it('Stellaris 프롬프트에 SF 관련 지침이 포함되어야 함', () => {
      expect(STELLARIS_SYSTEM_PROMPT).toContain('Empire')
      expect(STELLARIS_SYSTEM_PROMPT).toContain('제국')
      expect(STELLARIS_SYSTEM_PROMPT).toContain('sci-fi')
    })

    it('VIC3 프롬프트에 산업혁명 시대 관련 지침이 포함되어야 함', () => {
      expect(VIC3_SYSTEM_PROMPT).toContain('Prime Minister')
      expect(VIC3_SYSTEM_PROMPT).toContain('총리')
      expect(VIC3_SYSTEM_PROMPT).toContain('industrial')
    })
  })
})
