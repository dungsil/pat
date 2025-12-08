import { vi } from 'vitest'

// 테스트 시 콘솔 로그를 막기 위해 콘솔라를 전역 목으로 대체
vi.mock('consola', () => {
  const createStubLogger = () => {
    const fn = vi.fn()
    return {
      log: fn,
      info: fn,
      start: fn,
      success: fn,
      warn: fn,
      error: fn,
      debug: fn,
      box: fn
    }
  }

  return {
    createConsola: vi.fn(() => createStubLogger()),
    LogLevels: {
      fatal: 0,
      error: 1,
      warn: 2,
      log: 3,
      info: 4,
      success: 5,
      debug: 6,
      trace: 7,
      silent: -1
    }
  }
})
