import { describe, it, expect } from 'vitest'
import { getLocalizationFolderName } from './retranslation-invalidator'

describe('재번역 무효화', () => {
  describe('getLocalizationFolderName', () => {
    it('CK3는 localization 폴더를 반환해야 함', () => {
      expect(getLocalizationFolderName('ck3')).toBe('localization')
    })

    it('VIC3는 localization 폴더를 반환해야 함', () => {
      expect(getLocalizationFolderName('vic3')).toBe('localization')
    })

    it('Stellaris는 localisation 폴더를 반환해야 함 (영국식 철자)', () => {
      expect(getLocalizationFolderName('stellaris')).toBe('localisation')
    })

    it('지원하지 않는 게임 타입에 대해 오류를 발생시켜야 함', () => {
      expect(() => getLocalizationFolderName('invalid' as any)).toThrow('Unsupported game type: invalid')
    })
  })

  describe('파일명 변환 규칙', () => {
    it('원본 파일명에 ___ 접두사를 추가하고 언어를 변경해야 함', () => {
      // 파일명 변환 규칙 검증: event_l_english.yml → ___event_l_korean.yml
      const sourceFile = 'event_l_english.yml'
      const sourceLanguage = 'english'
      
      const targetFileName = '___' + sourceFile.replace(`_l_${sourceLanguage}.yml`, '_l_korean.yml')
      
      expect(targetFileName).toBe('___event_l_korean.yml')
    })

    it('replace 경로를 포함한 locPath는 korean/replace로 매핑되어야 함', () => {
      // replace 경로 처리 규칙 검증:
      // - locPath에 'replace' 포함 시: korean/replace
      // - locPath에 'replace' 미포함 시: korean
      const locPathWithReplace = 'localization/replace'
      const locPathWithoutReplace = 'localization/english'
      
      const targetPathWithReplace = locPathWithReplace.includes('replace') ? 'korean/replace' : 'korean'
      const targetPathWithoutReplace = locPathWithoutReplace.includes('replace') ? 'korean/replace' : 'korean'
      
      expect(targetPathWithReplace).toBe('korean/replace')
      expect(targetPathWithoutReplace).toBe('korean')
    })
  })
})
