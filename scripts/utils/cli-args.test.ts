import { describe, it, expect } from 'vitest'
import { parseDictionaryFilterArgs } from './cli-args'

describe('cli-args', () => {
  describe('parseDictionaryFilterArgs', () => {
    it('모든 옵션이 없을 때 hasFilterOptions가 false여야 함', () => {
      const result = parseDictionaryFilterArgs([])
      expect(result.hasFilterOptions).toBe(false)
      expect(result.sinceCommit).toBeUndefined()
      expect(result.commitRange).toBeUndefined()
      expect(result.sinceDate).toBeUndefined()
    })

    it('--since-commit 옵션만 있을 때 올바르게 파싱해야 함', () => {
      const result = parseDictionaryFilterArgs(['--since-commit', 'abc1234'])
      expect(result.hasFilterOptions).toBe(true)
      expect(result.sinceCommit).toBe('abc1234')
      expect(result.commitRange).toBeUndefined()
      expect(result.sinceDate).toBeUndefined()
    })

    it('--commit-range 옵션만 있을 때 올바르게 파싱해야 함', () => {
      const result = parseDictionaryFilterArgs(['--commit-range', 'abc1234..def5678'])
      expect(result.hasFilterOptions).toBe(true)
      expect(result.sinceCommit).toBeUndefined()
      expect(result.commitRange).toBe('abc1234..def5678')
      expect(result.sinceDate).toBeUndefined()
    })

    it('--since-date 옵션만 있을 때 올바르게 파싱해야 함', () => {
      const result = parseDictionaryFilterArgs(['--since-date', '2024-01-01'])
      expect(result.hasFilterOptions).toBe(true)
      expect(result.sinceCommit).toBeUndefined()
      expect(result.commitRange).toBeUndefined()
      expect(result.sinceDate).toBe('2024-01-01')
    })

    it('여러 옵션이 동시에 제공될 때 모두 파싱해야 함', () => {
      const result = parseDictionaryFilterArgs([
        '--since-commit', 'abc1234',
        '--commit-range', 'def5678..ghi9012',
        '--since-date', '2024-01-01'
      ])
      expect(result.hasFilterOptions).toBe(true)
      expect(result.sinceCommit).toBe('abc1234')
      expect(result.commitRange).toBe('def5678..ghi9012')
      expect(result.sinceDate).toBe('2024-01-01')
    })

    it('옵션 값이 누락되었을 때 해당 옵션은 undefined여야 함', () => {
      const result = parseDictionaryFilterArgs(['--since-commit'])
      expect(result.hasFilterOptions).toBe(false)
      expect(result.sinceCommit).toBeUndefined()
    })

    it('빈 문자열 값이 제공될 때 undefined로 처리해야 함', () => {
      const result = parseDictionaryFilterArgs(['--since-commit', ''])
      expect(result.hasFilterOptions).toBe(false)
      expect(result.sinceCommit).toBeUndefined()
    })

    it('알 수 없는 옵션이 포함되어도 알려진 옵션만 파싱해야 함', () => {
      const result = parseDictionaryFilterArgs([
        '--unknown-option', 'value',
        '--since-commit', 'abc1234',
        '--another-unknown'
      ])
      expect(result.hasFilterOptions).toBe(true)
      expect(result.sinceCommit).toBe('abc1234')
    })

    it('git date 형식의 since-date도 올바르게 파싱해야 함', () => {
      const result = parseDictionaryFilterArgs(['--since-date', '1 week ago'])
      expect(result.hasFilterOptions).toBe(true)
      expect(result.sinceDate).toBe('1 week ago')
    })
  })
})
