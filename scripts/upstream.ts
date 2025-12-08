import { join } from 'pathe'
import { updateAllUpstreams } from './utils/upstream'
import { log } from './utils/logger'
import process from 'node:process'

/**
 * 사용법 도움말 출력
 */
function printUsage() {
  log.box(`
    Upstream 최적화 관리 도구
    
    사용법:
      pnpm upstream [게임] [모드]
    
    예시:
      pnpm upstream              # 모든 게임의 모든 모드 업데이트
      pnpm upstream ck3          # CK3 게임의 모든 모드 업데이트
      pnpm upstream ck3 RICE     # CK3 게임의 RICE 모드만 업데이트
      pnpm upstream vic3         # VIC3 게임의 모든 모드 업데이트
      pnpm upstream stellaris    # Stellaris 게임의 모든 모드 업데이트
    
    참고:
      - 게임 이름은 대소문자 구분 없음 (ck3, CK3, Ck3 모두 동일)
      - 모드 이름은 대소문자를 구분함 (디렉토리 이름과 정확히 일치해야 함)
      - 공백이 포함된 모드 이름은 따옴표로 감싸기: pnpm upstream vic3 "Better Politics Mod"
    
    특징:
      - Sparse checkout을 사용한 고성능 업데이트
      - 기존 git submodule 대비 96% 성능 향상
      - 게임별, 모드별 선택적 업데이트 지원
  `)
}

async function main() {
  try {
    const rootDir = join(import.meta.dirname, '..')
    
    // 명령줄 인자 파싱
    const args = process.argv.slice(2)
    
    // --help 또는 -h 옵션 처리
    if (args.includes('--help') || args.includes('-h')) {
      printUsage()
      return
    }
    
    const targetGameType = args[0]?.toLowerCase()
    const targetMod = args[1]?.trim()
    
    // 게임 타입 검증
    if (targetGameType && !['ck3', 'vic3', 'stellaris'].includes(targetGameType)) {
      log.error(`올바르지 않은 게임 타입: ${targetGameType}`)
      log.info('지원하는 게임: ck3, vic3, stellaris')
      printUsage()
      process.exit(1)
    }
    
    await updateAllUpstreams(rootDir, targetGameType, targetMod)
    
  } catch (error) {
    throw new Error(`Upstream 업데이트 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error
    })
  }
}

main().catch((error) => {
  log.error('Upstream 업데이트 중 오류 발생:', error)
  process.exit(1)
})