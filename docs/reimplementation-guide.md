# 재구현 가이드

## 개요

현재 작성된 사양을 기준으로 시스템을 깔끔하게 재구현하기 위한 가이드입니다. 이 문서는 기존 코드를 참조하되, 더 나은 구조와 설계 원칙을 적용하여 처음부터 다시 구축하는 방법을 제시합니다.

## 재구현의 필요성

### 현재 시스템의 개선 가능한 부분

1. **모듈 분리**: 일부 기능이 단일 파일에 과도하게 집중
2. **타입 안정성**: 더 엄격한 TypeScript 타입 적용 가능
3. **테스트**: 자동화된 테스트 인프라 부족
4. **에러 처리**: 더 체계적인 에러 핸들링 필요
5. **확장성**: 플러그인 시스템으로 확장 용이하게

## 재구현 단계

### Phase 1: 기반 인프라 (1-2주)

#### 1.1 프로젝트 초기화

```bash
# 새 프로젝트 디렉토리
mkdir paradox-auto-translate-v2
cd paradox-auto-translate-v2

# pnpm 초기화
pnpm init

# TypeScript 설정
pnpm add -D typescript @types/node
pnpm exec tsc --init
```

**tsconfig.json 권장 설정:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### 1.2 의존성 설치

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.24.1",
    "@iarna/toml": "^2.2.5",
    "@libsql/client": "^0.15.4",
    "consola": "^3.4.2",
    "db0": "^0.3.2",
    "dotenv": "^16.6.1",
    "pathe": "^2.0.3",
    "unstorage": "^1.15.0",
    "xxhash-wasm": "^1.1.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^22.18.6",
    "typescript": "^5.8.3",
    "vitest": "^1.0.0",
    "tsx": "^4.7.0"
  }
}
```

**새로 추가:**
- `zod`: 런타임 타입 검증
- `vitest`: 테스트 프레임워크
- `tsx`: TypeScript 실행 (jiti 대체)

#### 1.3 디렉토리 구조

```
src/
├── core/                    # 핵심 비즈니스 로직
│   ├── translation/        # 번역 엔진
│   ├── validation/         # 검증 시스템
│   └── pipeline/           # 파이프라인 오케스트레이션
├── infrastructure/          # 인프라 계층
│   ├── cache/              # 캐싱 구현
│   ├── storage/            # 파일 시스템
│   ├── ai/                 # AI 통합
│   └── git/                # Git/Upstream 관리
├── domain/                  # 도메인 모델
│   ├── models/             # 데이터 모델
│   ├── types/              # 타입 정의
│   └── schemas/            # Zod 스키마
├── adapters/                # 어댑터 패턴
│   ├── parsers/            # 파일 파서
│   └── formatters/         # 출력 포맷터
├── application/             # 애플리케이션 레이어
│   ├── commands/           # CLI 명령
│   └── services/           # 애플리케이션 서비스
└── shared/                  # 공유 유틸리티
    ├── logger/             # 로깅
    ├── config/             # 설정 관리
    └── utils/              # 유틸리티
```

### Phase 2: 도메인 모델 정의 (1주)

#### 2.1 핵심 도메인 타입

**src/domain/types/game.ts:**

```typescript
export type GameType = 'ck3' | 'vic3' | 'stellaris'

export interface GameConfig {
  readonly type: GameType
  readonly localizationFolder: 'localization' | 'localisation'
  readonly sourceLanguage: string
  readonly targetLanguage: string
}
```

**src/domain/types/translation.ts:**

```typescript
export interface TranslationEntry {
  readonly key: string
  readonly sourceText: string
  readonly translatedText: string | null
  readonly sourceHash: string
  readonly targetHash: string | null
  readonly metadata?: Record<string, unknown>
}

export interface TranslationFile {
  readonly path: string
  readonly language: string
  readonly entries: Map<string, TranslationEntry>
}

export interface TranslationResult {
  readonly success: boolean
  readonly entry: TranslationEntry
  readonly source: 'dictionary' | 'cache' | 'ai'
  readonly error?: Error
}
```

**src/domain/types/validation.ts:**

```typescript
export interface ValidationRule {
  readonly name: string
  readonly validate: (source: string, target: string) => ValidationResult
}

export interface ValidationResult {
  readonly isValid: boolean
  readonly reason?: string
  readonly details?: Record<string, unknown>
}

export interface ValidationReport {
  readonly totalChecks: number
  readonly passed: number
  readonly failed: number
  readonly failures: ValidationFailure[]
}

export interface ValidationFailure {
  readonly key: string
  readonly rule: string
  readonly reason: string
  readonly sourceText: string
  readonly translatedText: string
}
```

#### 2.2 Zod 스키마 정의

**src/domain/schemas/meta.schema.ts:**

```typescript
import { z } from 'zod'

export const MetaTomlSchema = z.object({
  upstream: z.object({
    url: z.string().url().optional(),
    localization: z.array(z.string()),
    language: z.string().default('english')
  })
})

export type MetaToml = z.infer<typeof MetaTomlSchema>
```

**src/domain/schemas/config.schema.ts:**

```typescript
import { z } from 'zod'

export const ConfigSchema = z.object({
  googleAiToken: z.string().min(1),
  cacheDatabase: z.string().default('translate-cache.db'),
  logLevel: z.enum(['debug', 'verbose', 'info', 'warn', 'error']).default('info'),
  maxConcurrency: z.number().int().positive().default(5),
  retryAttempts: z.number().int().nonnegative().default(2)
})

export type Config = z.infer<typeof ConfigSchema>
```

### Phase 3: 인프라 레이어 (2주)

#### 3.1 캐싱 시스템

**src/infrastructure/cache/cache.interface.ts:**

```typescript
export interface ICache {
  has(key: string): Promise<boolean>
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
}

export interface ICacheKeyGenerator {
  generate(text: string, context: Record<string, unknown>): Promise<string>
}
```

**src/infrastructure/cache/hash-cache.ts:**

```typescript
import { ICache, ICacheKeyGenerator } from './cache.interface'
import { GameType } from '../../domain/types/game'

export class HashBasedCache implements ICache {
  constructor(
    private readonly storage: ICache,
    private readonly keyGenerator: ICacheKeyGenerator,
    private readonly gameType: GameType
  ) {}

  async has(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key)
    return this.storage.has(fullKey)
  }

  async get(key: string): Promise<string | null> {
    const fullKey = this.getFullKey(key)
    return this.storage.get(fullKey)
  }

  async set(key: string, value: string): Promise<void> {
    const fullKey = this.getFullKey(key)
    return this.storage.set(fullKey, value)
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key)
    return this.storage.delete(fullKey)
  }

  async clear(): Promise<void> {
    return this.storage.clear()
  }

  private getFullKey(key: string): string {
    // CK3는 하위 호환성을 위해 프리픽스 없음
    if (this.gameType === 'ck3') {
      return key
    }
    return `${this.gameType}:${key}`
  }
}
```

**src/infrastructure/cache/xxhash-key-generator.ts:**

```typescript
import { ICacheKeyGenerator } from './cache.interface'
import { xxhash64 } from 'xxhash-wasm'

export class XXHashKeyGenerator implements ICacheKeyGenerator {
  private hasher: Awaited<ReturnType<typeof xxhash64>> | null = null

  async generate(text: string, context: Record<string, unknown> = {}): Promise<string> {
    if (!this.hasher) {
      this.hasher = await xxhash64()
    }
    
    const contextStr = JSON.stringify(context)
    const input = `${text}:${contextStr}`
    
    return this.hasher.hash(Buffer.from(input)).toString(16)
  }
}
```

#### 3.2 AI 통합

**src/infrastructure/ai/ai.interface.ts:**

```typescript
export interface IAIProvider {
  translate(text: string, context: AIContext): Promise<string>
  healthCheck(): Promise<boolean>
}

export interface AIContext {
  readonly gameType: string
  readonly systemPrompt: string
  readonly translationMemory?: Map<string, string>
  readonly temperature?: number
  readonly maxTokens?: number
}

export interface AIConfig {
  readonly apiKey: string
  readonly model: string
  readonly fallbackModel?: string
  readonly timeout?: number
  readonly retryAttempts?: number
}
```

**src/infrastructure/ai/gemini-provider.ts:**

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'
import { IAIProvider, AIContext, AIConfig } from './ai.interface'

export class GeminiAIProvider implements IAIProvider {
  private readonly client: GoogleGenerativeAI
  private readonly config: AIConfig

  constructor(config: AIConfig) {
    this.config = config
    this.client = new GoogleGenerativeAI(config.apiKey)
  }

  async translate(text: string, context: AIContext): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: this.config.model,
      systemInstruction: context.systemPrompt,
      generationConfig: {
        temperature: context.temperature ?? 0.5,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: context.maxTokens ?? 8192
      }
    })

    try {
      const result = await model.generateContent(text)
      const response = result.response.text()
      return this.postProcess(response)
    } catch (error) {
      if (this.config.fallbackModel) {
        return this.translateWithFallback(text, context)
      }
      throw error
    }
  }

  private async translateWithFallback(text: string, context: AIContext): Promise<string> {
    const fallbackModel = this.client.getGenerativeModel({
      model: this.config.fallbackModel!,
      systemInstruction: context.systemPrompt
    })

    const result = await fallbackModel.generateContent(text)
    return this.postProcess(result.response.text())
  }

  private postProcess(text: string): string {
    return text
      .trim()
      .replaceAll(/\n/g, '\\n')
      .replaceAll(/[^\\]"/g, '\\"')
      .replaceAll(/#약(하게|화된|[화한])/g, '#weak')
      .replaceAll(/#강조/g, '#bold')
  }

  async healthCheck(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: this.config.model })
      await model.generateContent('test')
      return true
    } catch {
      return false
    }
  }
}
```

#### 3.3 Git/Upstream 관리

**src/infrastructure/git/upstream-manager.ts:**

```typescript
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export interface UpstreamConfig {
  readonly url: string
  readonly path: string
  readonly localizationPaths: string[]
}

export class UpstreamManager {
  async updateRepository(config: UpstreamConfig): Promise<void> {
    const exists = await this.repositoryExists(config.path)
    
    if (!exists) {
      await this.cloneRepository(config)
    } else {
      await this.pullRepository(config.path)
    }
  }

  private async repositoryExists(path: string): Promise<boolean> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: path })
      return true
    } catch {
      return false
    }
  }

  private async cloneRepository(config: UpstreamConfig): Promise<void> {
    // Sparse checkout으로 최적화
    await execAsync(
      `git clone --filter=blob:none --no-checkout --depth=1 ${config.url} ${config.path}`
    )
    
    await execAsync('git sparse-checkout init --cone', { cwd: config.path })
    await execAsync(
      `git sparse-checkout set ${config.localizationPaths.join(' ')}`,
      { cwd: config.path }
    )
    
    await execAsync('git checkout', { cwd: config.path })
    await this.checkoutLatestVersion(config.path)
  }

  private async pullRepository(path: string): Promise<void> {
    await execAsync('git pull --rebase', { cwd: path })
    await this.checkoutLatestVersion(path)
  }

  private async checkoutLatestVersion(path: string): Promise<void> {
    try {
      // 태그 확인
      await execAsync('git tag | grep -q .', { cwd: path })
      
      // 최신 태그로 체크아웃
      const { stdout } = await execAsync(
        'git describe --tags `git rev-list --tags --max-count=1`',
        { cwd: path }
      )
      const latestTag = stdout.trim()
      await execAsync(`git checkout ${latestTag}`, { cwd: path })
    } catch {
      // 태그가 없으면 최신 커밋 사용
      await execAsync('git checkout HEAD', { cwd: path })
    }
  }
}
```

### Phase 4: 검증 시스템 (1주)

#### 4.1 검증 규칙 인터페이스

**src/core/validation/validation-engine.ts:**

```typescript
import { ValidationRule, ValidationResult, ValidationReport, ValidationFailure } from '../../domain/types/validation'
import { TranslationEntry } from '../../domain/types/translation'

export class ValidationEngine {
  constructor(private readonly rules: ValidationRule[]) {}

  validate(entry: TranslationEntry): ValidationResult {
    for (const rule of this.rules) {
      const result = rule.validate(entry.sourceText, entry.translatedText || '')
      if (!result.isValid) {
        return result
      }
    }
    return { isValid: true }
  }

  validateBatch(entries: TranslationEntry[]): ValidationReport {
    const failures: ValidationFailure[] = []
    let passed = 0

    for (const entry of entries) {
      const result = this.validate(entry)
      if (result.isValid) {
        passed++
      } else {
        failures.push({
          key: entry.key,
          rule: result.details?.rule as string || 'unknown',
          reason: result.reason || 'Unknown error',
          sourceText: entry.sourceText,
          translatedText: entry.translatedText || ''
        })
      }
    }

    return {
      totalChecks: entries.length,
      passed,
      failed: failures.length,
      failures
    }
  }
}
```

#### 4.2 검증 규칙 구현

**src/core/validation/rules/game-variable-preservation.rule.ts:**

```typescript
import { ValidationRule, ValidationResult } from '../../../domain/types/validation'

export class GameVariablePreservationRule implements ValidationRule {
  readonly name = 'game-variable-preservation'

  private readonly patterns = [
    /\$([a-zA-Z_][a-zA-Z0-9_]*)\$/g,           // $variable$
    /\[([^\]]+)\]/g,                           // [GetTitle]
    /@([a-zA-Z_][a-zA-Z0-9_]*)!/g,             // @icon!
    /£([a-zA-Z_][a-zA-Z0-9_]*)£/g,             // £currency£
    /#([a-zA-Z_]+)#/g                          // #bold#
  ]

  validate(source: string, target: string): ValidationResult {
    const sourceVars = this.extractVariables(source)
    const targetVars = this.extractVariables(target)

    // 모든 소스 변수가 타겟에 존재하는지 확인
    const uniqueSourceVars = [...new Set(sourceVars)]
    const uniqueTargetVars = [...new Set(targetVars)]

    const missingVars = uniqueSourceVars.filter(sourceVar => {
      const normalizedSource = this.normalizeStructure(sourceVar)
      return !uniqueTargetVars.some(targetVar =>
        this.normalizeStructure(targetVar) === normalizedSource
      )
    })

    if (missingVars.length > 0) {
      return {
        isValid: false,
        reason: `누락된 게임 변수: ${missingVars.join(', ')}`,
        details: { rule: this.name, missingVars }
      }
    }

    return { isValid: true }
  }

  private extractVariables(text: string): string[] {
    const variables: string[] = []
    
    for (const pattern of this.patterns) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        variables.push(match[0])
      }
    }
    
    return variables
  }

  private normalizeStructure(variable: string): string {
    // 문자열 리터럴을 플레이스홀더로 치환
    return variable.replace(/(['"])((?:\\.|(?!\1)[^\\])*?)\1/g, "'__STRING__'")
  }
}
```

### Phase 5: 번역 파이프라인 (2주)

#### 5.1 파이프라인 오케스트레이터

**src/core/pipeline/translation-pipeline.ts:**

```typescript
import { TranslationEntry, TranslationResult } from '../../domain/types/translation'
import { ICache } from '../../infrastructure/cache/cache.interface'
import { IAIProvider } from '../../infrastructure/ai/ai.interface'
import { ValidationEngine } from '../validation/validation-engine'
import { IDictionary } from '../dictionary/dictionary.interface'

export interface PipelineConfig {
  readonly cache: ICache
  readonly ai: IAIProvider
  readonly dictionary: IDictionary
  readonly validator: ValidationEngine
  readonly maxRetries: number
}

export class TranslationPipeline {
  constructor(private readonly config: PipelineConfig) {}

  async translate(entry: TranslationEntry): Promise<TranslationResult> {
    // 1. Dictionary 확인
    const dictResult = await this.tryDictionary(entry)
    if (dictResult) return dictResult

    // 2. Cache 확인
    const cacheResult = await this.tryCache(entry)
    if (cacheResult) return cacheResult

    // 3. AI 번역
    const aiResult = await this.tryAI(entry)
    return aiResult
  }

  private async tryDictionary(entry: TranslationEntry): Promise<TranslationResult | null> {
    const translated = await this.config.dictionary.get(entry.sourceText)
    
    if (translated) {
      return {
        success: true,
        entry: { ...entry, translatedText: translated },
        source: 'dictionary'
      }
    }
    
    return null
  }

  private async tryCache(entry: TranslationEntry): Promise<TranslationResult | null> {
    const cached = await this.config.cache.get(entry.sourceHash)
    
    if (cached) {
      // 검증
      const validationResult = this.config.validator.validate({
        ...entry,
        translatedText: cached
      })
      
      if (validationResult.isValid) {
        return {
          success: true,
          entry: { ...entry, translatedText: cached },
          source: 'cache'
        }
      }
      
      // 검증 실패 시 캐시 무효화
      await this.config.cache.delete(entry.sourceHash)
    }
    
    return null
  }

  private async tryAI(entry: TranslationEntry): Promise<TranslationResult> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const translated = await this.config.ai.translate(entry.sourceText, {
          gameType: 'ck3', // 동적으로 설정 필요
          systemPrompt: '' // 프롬프트 로드
        })

        // 검증
        const validationResult = this.config.validator.validate({
          ...entry,
          translatedText: translated
        })

        if (!validationResult.isValid) {
          throw new Error(`Validation failed: ${validationResult.reason}`)
        }

        // 캐시 저장
        await this.config.cache.set(entry.sourceHash, translated)

        return {
          success: true,
          entry: { ...entry, translatedText: translated },
          source: 'ai'
        }
      } catch (error) {
        lastError = error as Error
        
        if (attempt < this.config.maxRetries) {
          // 지수 백오프
          await this.delay(Math.pow(2, attempt) * 1000)
        }
      }
    }

    return {
      success: false,
      entry,
      source: 'ai',
      error: lastError
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
```

### Phase 6: 애플리케이션 레이어 (1주)

#### 6.1 커맨드 패턴

**src/application/commands/translate.command.ts:**

```typescript
import { Command } from './command.interface'
import { TranslationPipeline } from '../../core/pipeline/translation-pipeline'
import { GameType } from '../../domain/types/game'

export interface TranslateCommandOptions {
  readonly gameType: GameType
  readonly mods: string[]
  readonly onlyHash?: boolean
}

export class TranslateCommand implements Command<TranslateCommandOptions, void> {
  constructor(
    private readonly pipeline: TranslationPipeline,
    private readonly logger: ILogger
  ) {}

  async execute(options: TranslateCommandOptions): Promise<void> {
    this.logger.info(`Starting translation for ${options.gameType}`)
    
    // 1. Upstream 업데이트
    // 2. 파일 발견
    // 3. 파싱
    // 4. 번역 파이프라인 실행
    // 5. 출력
    
    this.logger.success('Translation completed')
  }
}
```

### Phase 7: 테스트 (지속적)

#### 7.1 단위 테스트

**tests/unit/infrastructure/cache/hash-cache.test.ts:**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { HashBasedCache } from '../../../../src/infrastructure/cache/hash-cache'
import { InMemoryCache } from '../../../../src/infrastructure/cache/in-memory-cache'
import { XXHashKeyGenerator } from '../../../../src/infrastructure/cache/xxhash-key-generator'

describe('HashBasedCache', () => {
  let cache: HashBasedCache

  beforeEach(() => {
    const storage = new InMemoryCache()
    const keyGenerator = new XXHashKeyGenerator()
    cache = new HashBasedCache(storage, keyGenerator, 'ck3')
  })

  it('should store and retrieve values', async () => {
    await cache.set('key1', 'value1')
    const result = await cache.get('key1')
    expect(result).toBe('value1')
  })

  it('should return null for missing keys', async () => {
    const result = await cache.get('nonexistent')
    expect(result).toBeNull()
  })

  it('should delete values', async () => {
    await cache.set('key1', 'value1')
    await cache.delete('key1')
    const result = await cache.get('key1')
    expect(result).toBeNull()
  })
})
```

#### 7.2 통합 테스트

**tests/integration/pipeline/translation-pipeline.test.ts:**

```typescript
import { describe, it, expect } from 'vitest'
import { TranslationPipeline } from '../../../src/core/pipeline/translation-pipeline'
// ... setup

describe('TranslationPipeline Integration', () => {
  it('should translate using dictionary first', async () => {
    // Test implementation
  })

  it('should fallback to AI when cache misses', async () => {
    // Test implementation
  })

  it('should validate translations', async () => {
    // Test implementation
  })
})
```

## 개선 사항

### 1. 설계 패턴 적용

#### 의존성 주입 (Dependency Injection)
```typescript
// 나쁜 예 (현재)
class TranslationService {
  private cache = new Cache()
  private ai = new AIProvider()
}

// 좋은 예 (재구현)
class TranslationService {
  constructor(
    private readonly cache: ICache,
    private readonly ai: IAIProvider
  ) {}
}
```

#### 전략 패턴 (Strategy Pattern)
```typescript
// 검증 규칙을 전략으로
interface IValidationStrategy {
  validate(source: string, target: string): ValidationResult
}

class ValidationContext {
  constructor(private strategies: IValidationStrategy[]) {}
  
  validate(source: string, target: string): ValidationResult {
    for (const strategy of this.strategies) {
      const result = strategy.validate(source, target)
      if (!result.isValid) return result
    }
    return { isValid: true }
  }
}
```

#### 팩토리 패턴 (Factory Pattern)
```typescript
// AI Provider 팩토리
class AIProviderFactory {
  static create(type: 'gemini' | 'openai', config: AIConfig): IAIProvider {
    switch (type) {
      case 'gemini':
        return new GeminiAIProvider(config)
      case 'openai':
        return new OpenAIProvider(config)
      default:
        throw new Error(`Unknown AI provider: ${type}`)
    }
  }
}
```

### 2. 에러 처리 개선

**src/shared/errors/custom-errors.ts:**

```typescript
export class TranslationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'TranslationError'
  }
}

export class CacheError extends TranslationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CACHE_ERROR', context)
    this.name = 'CacheError'
  }
}

export class ValidationError extends TranslationError {
  constructor(
    message: string,
    public readonly failures: ValidationFailure[]
  ) {
    super(message, 'VALIDATION_ERROR', { failures })
    this.name = 'ValidationError'
  }
}
```

### 3. 설정 관리 개선

**src/shared/config/config-manager.ts:**

```typescript
import { z } from 'zod'
import dotenv from 'dotenv'

export class ConfigManager {
  private static instance: ConfigManager
  private config: Config

  private constructor() {
    dotenv.config()
    this.config = this.loadConfig()
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager()
    }
    return ConfigManager.instance
  }

  private loadConfig(): Config {
    const raw = {
      googleAiToken: process.env.GOOGLE_AI_STUDIO_TOKEN,
      cacheDatabase: process.env.CACHE_DATABASE,
      logLevel: process.env.LOG_LEVEL,
      maxConcurrency: process.env.MAX_CONCURRENCY ? parseInt(process.env.MAX_CONCURRENCY) : undefined,
      retryAttempts: process.env.RETRY_ATTEMPTS ? parseInt(process.env.RETRY_ATTEMPTS) : undefined
    }

    return ConfigSchema.parse(raw)
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key]
  }

  getAll(): Readonly<Config> {
    return { ...this.config }
  }
}
```

### 4. 로깅 개선

**src/shared/logger/structured-logger.ts:**

```typescript
import consola, { LogLevel } from 'consola'

export interface LogContext {
  readonly module?: string
  readonly operation?: string
  readonly [key: string]: unknown
}

export class StructuredLogger {
  constructor(private readonly baseContext: LogContext = {}) {}

  private log(level: LogLevel, message: string, context?: LogContext) {
    const fullContext = { ...this.baseContext, ...context }
    consola.log({
      level,
      message,
      ...fullContext
    })
  }

  debug(message: string, context?: LogContext) {
    this.log(LogLevel.Debug, message, context)
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.Info, message, context)
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.Warn, message, context)
  }

  error(message: string, error: Error, context?: LogContext) {
    this.log(LogLevel.Error, message, {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    })
  }

  child(context: LogContext): StructuredLogger {
    return new StructuredLogger({ ...this.baseContext, ...context })
  }
}
```

## 마이그레이션 전략

### 점진적 마이그레이션

1. **Phase 1: 인프라 레이어**
   - 새 캐시 시스템 구현
   - 기존 데이터베이스와 호환
   - 병렬 실행 가능

2. **Phase 2: 코어 로직**
   - 검증 시스템 먼저 마이그레이션
   - 기존 시스템과 비교 테스트

3. **Phase 3: 전체 전환**
   - 충분한 테스트 후 전환
   - 롤백 계획 준비

### 호환성 레이어

**src/compatibility/legacy-adapter.ts:**

```typescript
// 기존 API와 호환성 유지
export class LegacyAdapter {
  constructor(private newSystem: TranslationPipeline) {}

  // 기존 함수 시그니처 유지
  async translate(text: string, hash: string, gameType: GameType): Promise<string> {
    const entry: TranslationEntry = {
      key: 'legacy',
      sourceText: text,
      translatedText: null,
      sourceHash: hash,
      targetHash: null
    }

    const result = await this.newSystem.translate(entry)
    
    if (!result.success) {
      throw result.error || new Error('Translation failed')
    }

    return result.entry.translatedText || ''
  }
}
```

## 성능 최적화

### 1. 배치 처리

```typescript
export class BatchProcessor<T, R> {
  constructor(
    private readonly batchSize: number,
    private readonly processor: (items: T[]) => Promise<R[]>
  ) {}

  async process(items: T[]): Promise<R[]> {
    const results: R[] = []
    
    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize)
      const batchResults = await this.processor(batch)
      results.push(...batchResults)
    }
    
    return results
  }
}
```

### 2. 병렬 처리 제한

```typescript
export class ConcurrencyLimiter {
  private running = 0
  private queue: Array<() => Promise<void>> = []

  constructor(private readonly maxConcurrency: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.maxConcurrency) {
      await new Promise(resolve => this.queue.push(resolve as any))
    }

    this.running++
    
    try {
      return await fn()
    } finally {
      this.running--
      const next = this.queue.shift()
      if (next) next()
    }
  }
}
```

## 모니터링 및 관찰성

### 1. 메트릭 수집

```typescript
export class MetricsCollector {
  private metrics = new Map<string, number>()

  increment(name: string, value = 1): void {
    const current = this.metrics.get(name) || 0
    this.metrics.set(name, current + value)
  }

  gauge(name: string, value: number): void {
    this.metrics.set(name, value)
  }

  getAll(): Record<string, number> {
    return Object.fromEntries(this.metrics)
  }

  report(): void {
    console.log('=== Metrics Report ===')
    for (const [name, value] of this.metrics) {
      console.log(`${name}: ${value}`)
    }
  }
}
```

### 2. 추적 (Tracing)

```typescript
export class TraceContext {
  constructor(
    public readonly traceId: string,
    public readonly spanId: string,
    public readonly parentSpanId?: string
  ) {}

  static create(): TraceContext {
    return new TraceContext(
      this.generateId(),
      this.generateId()
    )
  }

  createChild(): TraceContext {
    return new TraceContext(
      this.traceId,
      TraceContext.generateId(),
      this.spanId
    )
  }

  private static generateId(): string {
    return Math.random().toString(36).substring(2, 15)
  }
}
```

## 배포 및 운영

### 1. CLI 개선

**src/cli/index.ts:**

```typescript
import { Command } from 'commander'
import { TranslateCommand } from '../application/commands/translate.command'

const program = new Command()

program
  .name('paradox-translate')
  .description('Paradox game mod translation tool')
  .version('2.0.0')

program
  .command('translate')
  .description('Translate game mods')
  .argument('<game>', 'Game type (ck3, vic3, stellaris)')
  .option('--only-hash', 'Only update hashes')
  .option('--update-dict', 'Invalidate dictionary-based translations')
  .option('--retranslate', 'Retranslate invalid items')
  .action(async (game, options) => {
    // Execute translation
  })

program.parse()
```

### 2. Docker 지원

**Dockerfile:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 의존성 설치
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# 소스 복사 및 빌드
COPY . .
RUN pnpm build

# 실행
CMD ["pnpm", "start"]
```

## 다음 단계

### 즉시 구현 가능

1. ✅ 프로젝트 초기화 및 의존성 설치
2. ✅ 디렉토리 구조 생성
3. ✅ 도메인 타입 정의
4. ✅ Zod 스키마 작성

### 단기 (1-2주)

5. ⏳ 캐싱 시스템 구현
6. ⏳ AI 통합 구현
7. ⏳ 검증 시스템 구현

### 중기 (3-4주)

8. ⏳ 번역 파이프라인 구현
9. ⏳ 파서 및 포맷터 구현
10. ⏳ CLI 애플리케이션 구현

### 장기 (5-8주)

11. ⏳ 테스트 작성 (단위, 통합, E2E)
12. ⏳ 문서 업데이트
13. ⏳ 마이그레이션 실행
14. ⏳ 프로덕션 배포

## 참고 자료

- [현재 아키텍처](architecture.md)
- [기능 요구사항](requirements.md)
- [API 레퍼런스](api-reference.md)
- [번역 파이프라인](translation-pipeline.md)

---

**작성일:** 2025-10-13 | **버전:** 1.0.0
