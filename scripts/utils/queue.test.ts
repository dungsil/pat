import { describe, expect, it, vi, beforeEach } from 'vitest'
import { TranslationRefusedError } from './ai'

// delay와 logger를 최소 동작으로 모킹
vi.mock('./delay', () => ({
  delay: vi.fn(() => Promise.resolve())
}))

const logSpies = vi.hoisted(() => ({
  warn: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  error: vi.fn()
}))

vi.mock('./logger', () => ({
  log: logSpies
}))

describe('큐 동작', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('작업이 순차 실행되고 Promise가 resolve되어야 함', async () => {
    const { addQueue } = await import('./queue')
    const order: string[] = []

    const first = addQueue('t1', async () => { order.push('첫번째') })
    const second = addQueue('t2', async () => { order.push('두번째') })

    await Promise.all([first, second])
    expect(order).toEqual(['첫번째', '두번째'])
  })

  it('TranslationRefusedError 발생 시 Promise가 reject되어야 함', async () => {
    const { addQueue } = await import('./queue')

    const promise = addQueue('refuse', async () => {
      throw new TranslationRefusedError('text', 'reason')
    })

    await expect(promise).rejects.toBeInstanceOf(TranslationRefusedError)
  })

  it('일반 오류는 재시도 후 성공하면 resolve되어야 함', async () => {
    const { addQueue } = await import('./queue')
    const delayMock = (await import('./delay')).delay as unknown as vi.Mock

    const task = vi.fn()
      .mockRejectedValueOnce(new Error('일시 오류'))
      .mockResolvedValueOnce(undefined)

    await addQueue('retry', async () => task())

    expect(task).toHaveBeenCalledTimes(2)
    expect(delayMock).toHaveBeenCalled()
  })
})
