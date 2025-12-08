import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { addQueue } from './queue'

// 테스트 중 로그 출력을 억제하기 위해 logger를 mock
vi.mock('./logger', () => ({
  log: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}))

describe('큐', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('addQueue', () => {
    it('큐에 추가된 작업을 실행해야 함', async () => {
      const mockTask = vi.fn().mockResolvedValue(undefined)
      
      addQueue('test-key', mockTask)
      
      // 작업 처리 대기
      await vi.runAllTimersAsync()
      
      expect(mockTask).toHaveBeenCalledTimes(1)
    })

    it('작업을 순차적으로 처리해야 함', async () => {
      const executionOrder: number[] = []
      
      const task1 = vi.fn(async () => {
        executionOrder.push(1)
      })
      const task2 = vi.fn(async () => {
        executionOrder.push(2)
      })
      const task3 = vi.fn(async () => {
        executionOrder.push(3)
      })
      
      addQueue('key1', task1)
      addQueue('key2', task2)
      addQueue('key3', task3)
      
      await vi.runAllTimersAsync()
      
      expect(executionOrder).toEqual([1, 2, 3])
    })

    it('속도 제한을 준수해야 함 (요청 간 100ms)', async () => {
      const executionTimes: number[] = []
      
      const createTask = () => vi.fn(async () => {
        executionTimes.push(Date.now())
      })
      
      const task1 = createTask()
      const task2 = createTask()
      const task3 = createTask()
      
      addQueue('key1', task1)
      addQueue('key2', task2)
      addQueue('key3', task3)
      
      await vi.runAllTimersAsync()
      
      // 모든 작업이 실행되어야 함
      expect(task1).toHaveBeenCalledTimes(1)
      expect(task2).toHaveBeenCalledTimes(1)
      expect(task3).toHaveBeenCalledTimes(1)
      
      // 실행 간에 적절한 간격이 있어야 함
      if (executionTimes.length >= 2) {
        const delay1 = executionTimes[1] - executionTimes[0]
        expect(delay1).toBeGreaterThanOrEqual(100)
      }
      if (executionTimes.length >= 3) {
        const delay2 = executionTimes[2] - executionTimes[1]
        expect(delay2).toBeGreaterThanOrEqual(100)
      }
    })

    it('실패 시 재시도해야 함', async () => {
      let attemptCount = 0
      const mockTask = vi.fn(async () => {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error('Temporary failure')
        }
      })
      
      addQueue('test-key', mockTask)
      
      // 재시도 실행
      await vi.runAllTimersAsync()
      
      // 3번 시도해야 함 (초기 + 2번 재시도)
      expect(mockTask).toHaveBeenCalledTimes(3)
    })

    it('재시도 시 지수 백오프를 사용해야 함', async () => {
      let attemptCount = 0
      const attemptTimes: number[] = []
      
      const mockTask = vi.fn(async () => {
        attemptTimes.push(Date.now())
        attemptCount++
        if (attemptCount < 3) {
          throw new Error('Temporary failure')
        }
      })
      
      addQueue('test-key', mockTask)
      
      // 재시도 처리
      await vi.runAllTimersAsync()
      
      // 지연이 증가해야 함 (0ms, 1000ms, 2000ms)
      expect(attemptTimes.length).toBe(3)
      // 첫 번째 재시도는 약 1000ms 후에
      if (attemptTimes.length >= 2) {
        const delay1 = attemptTimes[1] - attemptTimes[0]
        expect(delay1).toBeGreaterThanOrEqual(900)
        expect(delay1).toBeLessThan(1200)
      }
      // 두 번째 재시도는 약 2000ms 후에
      if (attemptTimes.length >= 3) {
        const delay2 = attemptTimes[2] - attemptTimes[1]
        expect(delay2).toBeGreaterThanOrEqual(1900)
        expect(delay2).toBeLessThan(2200)
      }
    })

    it('429 Too Many Requests 오류를 조용히 처리해야 함', async () => {
      let attemptCount = 0
      const mockTask = vi.fn(async () => {
        attemptCount++
        if (attemptCount < 2) {
          throw new Error('429 Too Many Requests')
        }
      })
      
      addQueue('test-key', mockTask)
      
      await vi.runAllTimersAsync()
      
      // 재시도하고 성공해야 함
      expect(mockTask).toHaveBeenCalledTimes(2)
    })

    it('다른 키를 가진 여러 작업을 처리해야 함', async () => {
      const results: string[] = []
      
      const task1 = vi.fn(async () => results.push('task1'))
      const task2 = vi.fn(async () => results.push('task2'))
      const task3 = vi.fn(async () => results.push('task3'))
      
      addQueue('key1', task1)
      addQueue('key2', task2)
      addQueue('key3', task3)
      
      await vi.runAllTimersAsync()
      
      expect(results).toEqual(['task1', 'task2', 'task3'])
      expect(task1).toHaveBeenCalledTimes(1)
      expect(task2).toHaveBeenCalledTimes(1)
      expect(task3).toHaveBeenCalledTimes(1)
    })

    it('성공적인 작업 실행을 처리해야 함', async () => {
      const mockTask = vi.fn(async () => {
        return 'success'
      })
      
      addQueue('test-key', mockTask)
      
      await vi.runAllTimersAsync()
      
      expect(mockTask).toHaveBeenCalledTimes(1)
    })
  })
})
