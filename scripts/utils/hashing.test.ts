import { describe, it, expect } from 'vitest'
import { hashing } from './hashing'

describe('해싱', () => {
  it('동일한 입력에 대해 일관된 해시를 생성해야 함', () => {
    const input = 'test string'
    const hash1 = hashing(input)
    const hash2 = hashing(input)
    
    expect(hash1).toBe(hash2)
  })

  it('다른 입력에 대해 다른 해시를 생성해야 함', () => {
    const hash1 = hashing('test string 1')
    const hash2 = hashing('test string 2')
    
    expect(hash1).not.toBe(hash2)
  })

  it('빈 문자열을 처리할 수 있어야 함', () => {
    const hash = hashing('')
    
    expect(hash).toBeTruthy()
    expect(typeof hash).toBe('string')
  })

  it('유니코드 문자를 처리할 수 있어야 함', () => {
    const hash1 = hashing('한글 테스트')
    const hash2 = hashing('日本語テスト')
    
    expect(hash1).toBeTruthy()
    expect(hash2).toBeTruthy()
    expect(hash1).not.toBe(hash2)
  })

  it('특수 문자를 처리할 수 있어야 함', () => {
    const hash = hashing('$special@#chars!&*()')
    
    expect(hash).toBeTruthy()
    expect(typeof hash).toBe('string')
  })

  it('긴 문자열을 처리할 수 있어야 함', () => {
    const longString = 'a'.repeat(10000)
    const hash = hashing(longString)
    
    expect(hash).toBeTruthy()
    expect(typeof hash).toBe('string')
  })

  it('대소문자를 구분해야 함', () => {
    const hash1 = hashing('Test')
    const hash2 = hashing('test')
    
    expect(hash1).not.toBe(hash2)
  })

  it('개행 문자와 공백을 처리할 수 있어야 함', () => {
    const hash1 = hashing('line1\nline2')
    const hash2 = hashing('line1 line2')
    
    expect(hash1).not.toBe(hash2)
  })
})
