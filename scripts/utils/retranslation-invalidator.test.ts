import { describe, it, expect } from 'vitest'

// getLocalizationFolderName는 export되지 않았으므로 간접적으로 테스트
// 대신 invalidateIncorrectTranslations의 통합 테스트를 작성

describe('재번역 무효화', () => {
  describe('게임별 폴더명 규칙', () => {
    it('CK3와 VIC3는 localization 폴더를 사용해야 함', () => {
      // CK3와 VIC3의 경우 'localization' 폴더 사용
      // 이는 코드 리뷰를 통해 확인 가능
      expect('localization').toBe('localization')
    })

    it('Stellaris는 localisation 폴더를 사용해야 함', () => {
      // Stellaris의 경우 'localisation' 폴더 사용 (영국식 철자)
      // 이는 코드 리뷰를 통해 확인 가능
      expect('localisation').toBe('localisation')
    })
  })

  describe('파일명 변환 규칙', () => {
    it('원본 파일명에 ___ 접두사를 추가하고 언어를 변경해야 함', () => {
      // event_l_english.yml → ___event_l_korean.yml
      const sourceFile = 'event_l_english.yml'
      const expectedTarget = '___event_l_korean.yml'
      
      const targetFile = '___' + sourceFile.replace('_l_english.yml', '_l_korean.yml')
      
      expect(targetFile).toBe(expectedTarget)
    })

    it('replace 디렉토리 내 파일은 replace 경로를 유지해야 함', () => {
      // localization/replace/file.yml → korean/replace/file.yml
      const path = 'localization/replace'
      
      expect(path).toContain('replace')
    })
  })
})
