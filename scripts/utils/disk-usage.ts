import { statfsSync } from 'node:fs'

export interface DiskUsageInfo {
  totalGB: number
  usedGB: number
  availableGB: number
  usagePercent: number
}

// bytes를 GB로 변환하기 위한 상수
const BYTES_TO_GB = BigInt(1024 * 1024 * 1024)

/**
 * 디스크 사용률 정보를 가져옵니다.
 * 현재 작업 디렉토리의 파일 시스템 정보를 반환합니다.
 */
export function getDiskUsage(path: string = '.'): DiskUsageInfo | null {
  try {
    const stats = statfsSync(path)
    
    const blockSize = stats.bsize
    const totalBlocks = stats.blocks
    const freeBlocks = stats.bfree
    const availableBlocks = stats.bavail
    
    const totalBytes = BigInt(blockSize) * BigInt(totalBlocks)
    const freeBytes = BigInt(blockSize) * BigInt(freeBlocks)
    const availableBytes = BigInt(blockSize) * BigInt(availableBlocks)
    const usedBytes = totalBytes - freeBytes
    
    // BigInt 공간에서 나눈 후 Number로 변환하여 정밀도 손실 방지
    const totalGB = Number(totalBytes / BYTES_TO_GB) + Number(totalBytes % BYTES_TO_GB) / Number(BYTES_TO_GB)
    const usedGB = Number(usedBytes / BYTES_TO_GB) + Number(usedBytes % BYTES_TO_GB) / Number(BYTES_TO_GB)
    const availableGB = Number(availableBytes / BYTES_TO_GB) + Number(availableBytes % BYTES_TO_GB) / Number(BYTES_TO_GB)
    
    // 0으로 나누기 방지
    const usagePercent = totalBytes > 0n 
      ? Number((usedBytes * 100n) / totalBytes) 
      : 0
    
    return {
      totalGB: Math.round(totalGB * 100) / 100,
      usedGB: Math.round(usedGB * 100) / 100,
      availableGB: Math.round(availableGB * 100) / 100,
      usagePercent: Math.round(usagePercent * 100) / 100
    }
  } catch {
    return null
  }
}

/**
 * 디스크 사용률을 사람이 읽기 쉬운 문자열로 포맷합니다.
 */
export function formatDiskUsage(info: DiskUsageInfo): string {
  return `디스크 사용률: ${info.usagePercent}% (사용: ${info.usedGB}GB / 전체: ${info.totalGB}GB, 사용 가능: ${info.availableGB}GB)`
}

/**
 * 현재 디스크 사용률 정보를 문자열로 반환합니다.
 * 정보를 가져올 수 없는 경우 null을 반환합니다.
 */
export function getDiskUsageString(path: string = '.'): string | null {
  const info = getDiskUsage(path)
  if (info) {
    return formatDiskUsage(info)
  }
  return null
}
