import { describe, it, expect, vi } from 'vitest'
import { delay } from './delay'

describe('지연', () => {
  it('지정된 밀리초 동안 실행을 지연시켜야 함', async () => {
    const start = Date.now()
    await delay(100)
    const elapsed = Date.now() - start
    
    // 타이머 정밀도로 인한 허용 오차 (±20ms)
    expect(elapsed).toBeGreaterThanOrEqual(90)
    expect(elapsed).toBeLessThan(150)
  })

  it('0ms 지연을 올바르게 처리해야 함', async () => {
    const start = Date.now()
    await delay(0)
    const elapsed = Date.now() - start
    
    // 거의 즉시 완료되어야 함
    expect(elapsed).toBeLessThan(50)
  })

  it('더 긴 지연에서도 작동해야 함', async () => {
    const start = Date.now()
    await delay(200)
    const elapsed = Date.now() - start
    
    expect(elapsed).toBeGreaterThanOrEqual(190)
    expect(elapsed).toBeLessThan(250)
  })
})
