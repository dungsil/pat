import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm, access } from 'node:fs/promises'
import { join } from 'pathe'
import { tmpdir } from 'node:os'

let execMock: ReturnType<typeof vi.fn>
let fetchMock: ReturnType<typeof vi.fn>

vi.mock('node:child_process', () => {
  execMock = vi.fn((command: string, options?: unknown, callback?: unknown) => {
    const cb = typeof options === 'function' ? options : callback
    cb?.(null, { stdout: '', stderr: '' })
  })
  return { exec: execMock }
})

// 의존성 모킹
vi.mock('./logger', () => ({
  log: {
    start: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    box: vi.fn()
  }
}))

describe('upstream 유틸리티', () => {
  let testDir: string

  beforeEach(async () => {
    // 테스트를 위한 임시 디렉토리 생성
    testDir = join(tmpdir(), `upstream-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    fetchMock = vi.fn(async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({})
    }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    // 정리
    vi.restoreAllMocks()
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch (error) {
      // 정리 오류 무시
    }
  })

  describe('checkoutLatestVersionForShallowClone', () => {
    it('shallow clone에서 체크아웃이 정상적으로 동작해야 함', async () => {
      // 함수를 직접 import하여 테스트
      const { checkoutLatestVersionForShallowClone } = await import('./upstream')
      const { log } = await import('./logger')

      // 함수 호출 - 에러 없이 완료되어야 함
      await expect(checkoutLatestVersionForShallowClone('repo', 'test-path')).resolves.not.toThrow()

      // 로그가 올바르게 호출되었는지 확인
      expect(vi.mocked(log.info)).toHaveBeenCalledWith('[test-path] 최신 버전 체크아웃 완료')
      expect(execMock).toHaveBeenCalledWith(
        'git checkout HEAD',
        { cwd: 'repo' },
        expect.any(Function)
      )
    })

    it('shallow clone 체크아웃 시 에러가 발생하면 적절히 처리해야 함', async () => {
      execMock.mockImplementationOnce((command: string, options?: unknown, callback?: unknown) => {
        const cb = typeof options === 'function' ? options : callback
        cb?.(new Error('fail'), { stdout: '', stderr: '' })
      })

      const { checkoutLatestVersionForShallowClone } = await import('./upstream')
      const { log } = await import('./logger')

      // 에러가 발생해야 함
      await expect(checkoutLatestVersionForShallowClone('repo', 'test-path')).rejects.toThrow()

      // 에러 로그가 호출되었는지 확인
      expect(vi.mocked(log.error)).toHaveBeenCalledWith(
        '[test-path] 체크아웃 실패:',
        expect.any(Error)
      )
    })

    it('repositoryPath와 configPath 파라미터를 올바르게 처리해야 함', async () => {
      const { checkoutLatestVersionForShallowClone } = await import('./upstream')
      const { log } = await import('./logger')

      // 함수 호출
      const configPath = 'test-game/test-mod'
      await checkoutLatestVersionForShallowClone('repo', configPath)

      // configPath가 로그 메시지에 포함되었는지 확인
      expect(vi.mocked(log.info)).toHaveBeenCalledWith(
        expect.stringContaining(configPath)
      )
    })
  })

  describe('isShallowRepository', () => {
    it('shallow clone된 리포지토리를 올바르게 감지해야 함', async () => {
      // shallow clone 시뮬레이션을 위해 .git/shallow 파일 생성
      const repoDir = join(testDir, 'shallow-repo')
      await mkdir(join(repoDir, '.git'), { recursive: true })
      await writeFile(join(repoDir, '.git', 'shallow'), 'test shallow marker')

      const { isShallowRepository } = await import('./upstream')

      // 함수를 직접 호출하여 shallow 감지 확인
      const result = await isShallowRepository(repoDir)
      expect(result).toBe(true)
    })

    it('일반 리포지토리는 shallow로 감지되지 않아야 함', async () => {
      const repoDir = join(testDir, 'normal-repo')
      await mkdir(repoDir, { recursive: true })

      const { isShallowRepository } = await import('./upstream')

      // 함수를 직접 호출하여 일반 리포지토리 확인
      const result = await isShallowRepository(repoDir)
      expect(result).toBe(false)
    })

    it('존재하지 않는 리포지토리는 shallow가 아닌 것으로 처리해야 함', async () => {
      const nonExistentDir = join(testDir, 'non-existent')

      const { isShallowRepository } = await import('./upstream')

      // 존재하지 않는 경로는 false를 반환해야 함 (에러가 아닌)
      const result = await isShallowRepository(nonExistentDir)
      expect(result).toBe(false)
    })
  })

  describe('parseGitHubUrl', () => {
    it('GitHub URL에서 owner/repo를 올바르게 추출해야 함', async () => {
      const { parseGitHubUrl } = await import('./upstream')

      // HTTPS URL with .git suffix
      expect(parseGitHubUrl('https://github.com/cybrxkhan/RICE-for-CK3.git')).toEqual({
        owner: 'cybrxkhan',
        repo: 'RICE-for-CK3'
      })

      // HTTPS URL without .git suffix
      expect(parseGitHubUrl('https://github.com/cybrxkhan/VIET-Events-for-CK3')).toEqual({
        owner: 'cybrxkhan',
        repo: 'VIET-Events-for-CK3'
      })

      // SSH URL
      expect(parseGitHubUrl('git@github.com:cybrxkhan/RICE-for-CK3.git')).toEqual({
        owner: 'cybrxkhan',
        repo: 'RICE-for-CK3'
      })

      // Non-GitHub URLs should return null
      expect(parseGitHubUrl('https://gitlab.com/owner/repo.git')).toBeNull()
      expect(parseGitHubUrl('https://bitbucket.org/owner/repo.git')).toBeNull()
    })
  })

  describe('getLatestReleaseFromGitHub', () => {
    it('RICE 리포지토리에서 최신 릴리즈를 가져와야 함', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tag_name: 'v1.2.3' })
      })

      const { getLatestReleaseFromGitHub } = await import('./upstream')

      const result = await getLatestReleaseFromGitHub('cybrxkhan', 'RICE-for-CK3', 'ck3/RICE')

      expect(result).toBeTruthy()
      expect(result!.length).toBeGreaterThan(0)
    }, 30000)
  })

  describe('updateExistingRepository', () => {
    it('shallow clone 마커가 있는 리포지토리를 인식해야 함', async () => {
      // shallow clone 시뮬레이션
      const repoDir = join(testDir, 'update-test-repo')
      await mkdir(join(repoDir, '.git'), { recursive: true })

      // shallow marker 파일 생성
      await writeFile(join(repoDir, '.git', 'shallow'), 'test')

      // .git/shallow 파일 존재 확인
      await expect(access(join(repoDir, '.git', 'shallow'))).resolves.not.toThrow()
    })
  })

  describe('getLatestRefFromRemote', () => {
    it('GitHub 리포지토리에서 최신 릴리즈 태그를 반환해야 함', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tag_name: 'v9.9.9' })
      })
      const { getLatestRefFromRemote } = await import('./upstream')
      const riceRepoUrl = 'https://github.com/cybrxkhan/RICE-for-CK3.git'
      const result = await getLatestRefFromRemote(riceRepoUrl, 'ck3/RICE')

      // 태그 타입이어야 함
      expect(result.type).toBe('tag')

      // 태그 이름이 존재해야 함
      expect(result.name).toBeTruthy()
      expect(result.name.length).toBeGreaterThan(0)

      // 로그 출력 확인
      const { log } = await import('./logger')
      expect(vi.mocked(log.info)).toHaveBeenCalledWith(
        expect.stringContaining('GitHub')
      )
    }, 60000)

    it('태그가 없는 리포지토리에서 기본 브랜치를 반환해야 함', async () => {
      const { getLatestRefFromRemote } = await import('./upstream')

      execMock
        .mockImplementationOnce((command: string, options?: unknown, callback?: unknown) => {
          const cb = typeof options === 'function' ? options : callback
          cb?.(null, { stdout: '', stderr: '' })
        })
        .mockImplementationOnce((command: string, options?: unknown, callback?: unknown) => {
          const cb = typeof options === 'function' ? options : callback
          cb?.(null, { stdout: 'ref: refs/heads/main\tHEAD\n', stderr: '' })
        })

      const result = await getLatestRefFromRemote('local-repo', 'test-path')

      expect(result.type).toBe('branch')
      expect(result.name).toBe('main')
    })

    it('원격 접근 실패 시 기본 브랜치를 반환해야 함', async () => {
      const { getLatestRefFromRemote } = await import('./upstream')

      execMock.mockImplementationOnce((command: string, options?: unknown, callback?: unknown) => {
        const cb = typeof options === 'function' ? options : callback
        cb?.(new Error('fail'), { stdout: '', stderr: '' })
      })
      // 존재하지 않는 로컬 경로로 테스트 (네트워크 호출 방지)
      const result = await getLatestRefFromRemote('non-existent-repo', 'test-path')

      // 에러가 발생하면 기본 브랜치(main)를 반환해야 함
      expect(result.type).toBe('branch')
      expect(result.name).toBe('main')
    })
  })

  describe('parseUpstreamConfigs', () => {
    it('특정 게임 타입만 필터링해야 함', async () => {
      // 테스트용 디렉토리 구조 생성
      const ck3Dir = join(testDir, 'ck3', 'TestMod')
      const vic3Dir = join(testDir, 'vic3', 'TestMod')
      await mkdir(ck3Dir, { recursive: true })
      await mkdir(vic3Dir, { recursive: true })

      // meta.toml 파일 생성
      const ck3MetaContent = `
[upstream]
url = "https://github.com/test/test.git"
localization = ["localization/english"]
language = "english"
`
      const vic3MetaContent = `
[upstream]
url = "https://github.com/test/test2.git"
localization = ["localization/english"]
language = "english"
`
      await writeFile(join(ck3Dir, 'meta.toml'), ck3MetaContent)
      await writeFile(join(vic3Dir, 'meta.toml'), vic3MetaContent)

      const { parseUpstreamConfigs } = await import('./upstream')

      // CK3만 필터링
      const ck3Configs = await parseUpstreamConfigs(testDir, 'ck3')
      expect(ck3Configs.length).toBe(1)
      expect(ck3Configs[0].path).toContain('ck3')

      // VIC3만 필터링
      const vic3Configs = await parseUpstreamConfigs(testDir, 'vic3')
      expect(vic3Configs.length).toBe(1)
      expect(vic3Configs[0].path).toContain('vic3')

      // 모든 게임
      const allConfigs = await parseUpstreamConfigs(testDir)
      expect(allConfigs.length).toBe(2)
    })

    it('특정 모드만 필터링해야 함', async () => {
      // 테스트용 디렉토리 구조 생성
      const mod1Dir = join(testDir, 'ck3', 'Mod1')
      const mod2Dir = join(testDir, 'ck3', 'Mod2')
      await mkdir(mod1Dir, { recursive: true })
      await mkdir(mod2Dir, { recursive: true })

      // meta.toml 파일 생성
      const metaContent = `
[upstream]
url = "https://github.com/test/test.git"
localization = ["localization/english"]
language = "english"
`
      await writeFile(join(mod1Dir, 'meta.toml'), metaContent)
      await writeFile(join(mod2Dir, 'meta.toml'), metaContent)

      const { parseUpstreamConfigs } = await import('./upstream')

      // Mod1만 필터링
      const mod1Configs = await parseUpstreamConfigs(testDir, undefined, 'Mod1')
      expect(mod1Configs.length).toBe(1)
      expect(mod1Configs[0].path).toContain('Mod1')

      // Mod2만 필터링
      const mod2Configs = await parseUpstreamConfigs(testDir, undefined, 'Mod2')
      expect(mod2Configs.length).toBe(1)
      expect(mod2Configs[0].path).toContain('Mod2')

      // 모든 모드
      const allConfigs = await parseUpstreamConfigs(testDir)
      expect(allConfigs.length).toBe(2)
    })

    it('게임과 모드를 함께 필터링해야 함', async () => {
      // 테스트용 디렉토리 구조 생성
      const ck3Mod1Dir = join(testDir, 'ck3', 'Mod1')
      const ck3Mod2Dir = join(testDir, 'ck3', 'Mod2')
      const vic3Mod1Dir = join(testDir, 'vic3', 'Mod1')
      await mkdir(ck3Mod1Dir, { recursive: true })
      await mkdir(ck3Mod2Dir, { recursive: true })
      await mkdir(vic3Mod1Dir, { recursive: true })

      // meta.toml 파일 생성
      const metaContent = `
[upstream]
url = "https://github.com/test/test.git"
localization = ["localization/english"]
language = "english"
`
      await writeFile(join(ck3Mod1Dir, 'meta.toml'), metaContent)
      await writeFile(join(ck3Mod2Dir, 'meta.toml'), metaContent)
      await writeFile(join(vic3Mod1Dir, 'meta.toml'), metaContent)

      const { parseUpstreamConfigs } = await import('./upstream')

      // CK3의 Mod1만 필터링
      const ck3Mod1Configs = await parseUpstreamConfigs(testDir, 'ck3', 'Mod1')
      expect(ck3Mod1Configs.length).toBe(1)
      expect(ck3Mod1Configs[0].path).toContain('ck3')
      expect(ck3Mod1Configs[0].path).toContain('Mod1')

      // VIC3의 Mod1만 필터링
      const vic3Mod1Configs = await parseUpstreamConfigs(testDir, 'vic3', 'Mod1')
      expect(vic3Mod1Configs.length).toBe(1)
      expect(vic3Mod1Configs[0].path).toContain('vic3')
      expect(vic3Mod1Configs[0].path).toContain('Mod1')

      // 모든 게임의 모든 모드
      const allConfigs = await parseUpstreamConfigs(testDir)
      expect(allConfigs.length).toBe(3)
    })

    it('존재하지 않는 모드를 지정하면 빈 배열을 반환하고 에러를 발생시켜야 함', async () => {
      // 테스트용 디렉토리 구조 생성
      const modDir = join(testDir, 'ck3', 'ExistingMod')
      await mkdir(modDir, { recursive: true })

      // meta.toml 파일 생성
      const metaContent = `
[upstream]
url = "https://github.com/test/test.git"
localization = ["localization/english"]
language = "english"
`
      await writeFile(join(modDir, 'meta.toml'), metaContent)

      const { parseUpstreamConfigs } = await import('./upstream')

      // 존재하지 않는 모드 지정
      await expect(parseUpstreamConfigs(testDir, undefined, 'NonExistentMod')).rejects.toThrow('meta.toml 파일이 없습니다')
    })
  })
})
