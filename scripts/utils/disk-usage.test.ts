import { describe, it, expect } from 'vitest'
import { getDiskUsage, formatDiskUsage, getDiskUsageString, DiskUsageInfo } from './disk-usage'

describe('disk-usage', () => {
  describe('getDiskUsage', () => {
    it('현재 디렉토리의 디스크 사용률 정보를 반환해야 함', () => {
      const info = getDiskUsage('.')
      
      expect(info).not.toBeNull()
      expect(info!.totalGB).toBeGreaterThan(0)
      expect(info!.usedGB).toBeGreaterThanOrEqual(0)
      expect(info!.availableGB).toBeGreaterThanOrEqual(0)
      expect(info!.usagePercent).toBeGreaterThanOrEqual(0)
      expect(info!.usagePercent).toBeLessThanOrEqual(100)
    })

    it('루트 디렉토리의 디스크 사용률 정보를 반환해야 함', () => {
      const info = getDiskUsage('/')
      
      expect(info).not.toBeNull()
      expect(info!.totalGB).toBeGreaterThan(0)
    })

    it('존재하지 않는 경로에 대해 null을 반환해야 함', () => {
      const info = getDiskUsage('/non-existent-path-12345')
      
      expect(info).toBeNull()
    })

    it('기본 경로를 사용해야 함', () => {
      const info = getDiskUsage()
      
      expect(info).not.toBeNull()
      expect(info!.totalGB).toBeGreaterThan(0)
    })
  })

  describe('formatDiskUsage', () => {
    it('디스크 사용률 정보를 읽기 쉬운 문자열로 포맷해야 함', () => {
      const info: DiskUsageInfo = {
        totalGB: 100,
        usedGB: 50,
        availableGB: 50,
        usagePercent: 50
      }
      
      const result = formatDiskUsage(info)
      
      expect(result).toContain('디스크 사용률')
      expect(result).toContain('50%')
      expect(result).toContain('50GB')
      expect(result).toContain('100GB')
    })

    it('소수점 값을 올바르게 포맷해야 함', () => {
      const info: DiskUsageInfo = {
        totalGB: 100.55,
        usedGB: 75.25,
        availableGB: 25.30,
        usagePercent: 75.25
      }
      
      const result = formatDiskUsage(info)
      
      expect(result).toContain('75.25%')
      expect(result).toContain('75.25GB')
      expect(result).toContain('100.55GB')
    })
  })

  describe('getDiskUsageString', () => {
    it('디스크 사용률 문자열을 반환해야 함', () => {
      const result = getDiskUsageString('.')
      
      expect(result).not.toBeNull()
      expect(result).toContain('디스크 사용률')
      expect(result).toContain('%')
      expect(result).toContain('GB')
    })

    it('존재하지 않는 경로에 대해 null을 반환해야 함', () => {
      const result = getDiskUsageString('/non-existent-path-12345')
      
      expect(result).toBeNull()
    })

    it('기본 경로를 사용해야 함', () => {
      const result = getDiskUsageString()
      
      expect(result).not.toBeNull()
      expect(result).toContain('디스크 사용률')
    })
  })
})
