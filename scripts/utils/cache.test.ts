import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { hasCache, getCache, setCache, removeCache, isSqliteIOError } from './cache'
import { unlinkSync, existsSync } from 'fs'

describe('캐시', () => {
  const testDbPath = 'translate-cache.db'
  
  afterEach(async () => {
    // 테스트 캐시 항목 정리
    try {
      await removeCache('test-key-1', 'ck3')
      await removeCache('test-key-2', 'ck3')
      await removeCache('test-key-stellaris', 'stellaris')
      await removeCache('test-key-vic3', 'vic3')
    } catch (error) {
      // 정리 오류 무시
    }
  })

  describe('isSqliteIOError', () => {
    it('SQLITE_IOERR 메시지가 있는 오류를 감지해야 함', () => {
      const error = new Error('SQLITE_IOERR_FSYNC: disk I/O error')
      expect(isSqliteIOError(error)).toBe(true)
    })

    it('disk I/O error 메시지가 있는 오류를 감지해야 함', () => {
      const error = new Error('disk I/O error occurred')
      expect(isSqliteIOError(error)).toBe(true)
    })

    it('database is locked 메시지가 있는 오류를 감지해야 함', () => {
      const error = new Error('database is locked')
      expect(isSqliteIOError(error)).toBe(true)
    })

    it('대소문자를 구분하지 않아야 함', () => {
      const error = new Error('DISK I/O ERROR')
      expect(isSqliteIOError(error)).toBe(true)
    })

    it('관련 없는 오류에 대해 false를 반환해야 함', () => {
      const error = new Error('Some other error')
      expect(isSqliteIOError(error)).toBe(false)
    })

    it('Error가 아닌 값에 대해 false를 반환해야 함', () => {
      expect(isSqliteIOError('not an error')).toBe(false)
      expect(isSqliteIOError(null)).toBe(false)
      expect(isSqliteIOError(undefined)).toBe(false)
      expect(isSqliteIOError(123)).toBe(false)
    })
  })

  describe('setCache와 getCache', () => {
    it('캐시 값을 저장하고 조회할 수 있어야 함', async () => {
      await setCache('test-key-1', 'test-value', 'ck3')
      const value = await getCache('test-key-1', 'ck3')
      
      expect(value).toBe('test-value')
    })

    it('존재하지 않는 키에 대해 null을 반환해야 함', async () => {
      const value = await getCache('non-existent-key', 'ck3')
      
      expect(value).toBe(null)
    })

    it('기존 캐시 값을 덮어쓸 수 있어야 함', async () => {
      await setCache('test-key-2', 'value1', 'ck3')
      await setCache('test-key-2', 'value2', 'ck3')
      const value = await getCache('test-key-2', 'ck3')
      
      expect(value).toBe('value2')
    })

    it('빈 문자열 값을 처리할 수 있어야 함', async () => {
      await setCache('test-key-1', '', 'ck3')
      const value = await getCache('test-key-1', 'ck3')
      
      expect(value).toBe('')
    })

    it('유니코드 값을 처리할 수 있어야 함', async () => {
      const koreanText = '한글 텍스트'
      await setCache('test-key-1', koreanText, 'ck3')
      const value = await getCache('test-key-1', 'ck3')
      
      expect(value).toBe(koreanText)
    })

    it('긴 텍스트 값을 처리할 수 있어야 함', async () => {
      const longText = 'a'.repeat(10000)
      await setCache('test-key-1', longText, 'ck3')
      const value = await getCache('test-key-1', 'ck3')
      
      expect(value).toBe(longText)
    })
  })

  describe('hasCache', () => {
    it('존재하는 캐시 키에 대해 true를 반환해야 함', async () => {
      await setCache('test-key-1', 'value', 'ck3')
      const exists = await hasCache('test-key-1', 'ck3')
      
      expect(exists).toBe(true)
    })

    it('존재하지 않는 키에 대해 false를 반환해야 함', async () => {
      const exists = await hasCache('non-existent-key', 'ck3')
      
      expect(exists).toBe(false)
    })

    it('제거 후 false를 반환해야 함', async () => {
      await setCache('test-key-1', 'value', 'ck3')
      await removeCache('test-key-1', 'ck3')
      const exists = await hasCache('test-key-1', 'ck3')
      
      expect(exists).toBe(false)
    })
  })

  describe('removeCache', () => {
    it('기존 캐시 항목을 제거할 수 있어야 함', async () => {
      await setCache('test-key-1', 'value', 'ck3')
      await removeCache('test-key-1', 'ck3')
      const value = await getCache('test-key-1', 'ck3')
      
      expect(value).toBe(null)
    })

    it('존재하지 않는 키 제거 시 오류가 발생하지 않아야 함', async () => {
      await expect(removeCache('non-existent-key', 'ck3')).resolves.not.toThrow()
    })
  })

  describe('게임 타입 격리', () => {
    it('CK3와 Stellaris 캐시를 격리해야 함', async () => {
      await setCache('test-key-stellaris', 'ck3-value', 'ck3')
      await setCache('test-key-stellaris', 'stellaris-value', 'stellaris')
      
      const ck3Value = await getCache('test-key-stellaris', 'ck3')
      const stellarisValue = await getCache('test-key-stellaris', 'stellaris')
      
      expect(ck3Value).toBe('ck3-value')
      expect(stellarisValue).toBe('stellaris-value')
    })

    it('세 가지 게임 타입을 모두 격리해야 함', async () => {
      await setCache('shared-key', 'ck3-value', 'ck3')
      await setCache('shared-key', 'stellaris-value', 'stellaris')
      await setCache('shared-key', 'vic3-value', 'vic3')
      
      const ck3Value = await getCache('shared-key', 'ck3')
      const stellarisValue = await getCache('shared-key', 'stellaris')
      const vic3Value = await getCache('shared-key', 'vic3')
      
      expect(ck3Value).toBe('ck3-value')
      expect(stellarisValue).toBe('stellaris-value')
      expect(vic3Value).toBe('vic3-value')
    })

    it('게임 타입이 지정되지 않으면 ck3를 기본값으로 사용해야 함', async () => {
      await setCache('test-key-1', 'value')
      const value = await getCache('test-key-1', 'ck3')
      
      expect(value).toBe('value')
    })
  })

  describe('키의 특수 문자', () => {
    it('특수 문자가 포함된 키를 처리할 수 있어야 함', async () => {
      const key = 'key:with:colons'
      await setCache(key, 'value', 'ck3')
      const value = await getCache(key, 'ck3')
      
      expect(value).toBe('value')
    })

    it('슬래시가 포함된 키를 처리할 수 있어야 함', async () => {
      const key = 'key/with/slashes'
      await setCache(key, 'value', 'ck3')
      const value = await getCache(key, 'ck3')
      
      expect(value).toBe('value')
    })
  })
})
