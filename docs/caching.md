# 캐싱 시스템

## 개요

캐싱 시스템은 번역 결과를 영구 저장하여 중복 AI 호출을 방지하고, API 비용을 절감하며, 번역 속도를 향상시킵니다.

## 아키텍처

### 기술 스택

```
┌─────────────────────────────────┐
│  Application Layer              │
│  (translate.ts)                 │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Cache Layer                    │
│  (cache.ts)                     │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Storage Abstraction            │
│  (unstorage)                    │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Database Layer                 │
│  (db0 + LibSQL)                 │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Physical Storage               │
│  (translate-cache.db)           │
└─────────────────────────────────┘
```

### 모듈

**캐시 인터페이스:** `scripts/utils/cache.ts`
**데이터베이스:** SQLite (LibSQL)
**저장소 추상화:** unstorage
**DB 드라이버:** db0

## 캐시 키 전략

### 해시 기반 키

캐시 키는 소스 텍스트의 xxHash64 해시를 사용합니다.

```typescript
const sourceText = "The Duke arrives"
const hash = await hashing(sourceText)
// "a1b2c3d4e5f6..." (16진수 문자열)

const cacheKey = getCacheKey(hash, 'ck3')
// CK3: "a1b2c3d4e5f6..."
// VIC3: "vic3:a1b2c3d4e5f6..."
```

**장점:**
- 빠른 조회 (O(1))
- 동일한 텍스트는 항상 동일한 키
- 텍스트 길이에 무관

### 게임별 네임스페이스

```typescript
function getCacheKey(key: string, gameType: GameType): string {
  // CK3는 하위 호환성을 위해 프리픽스 없음
  if (gameType === 'ck3') {
    return key
  }
  
  // 다른 게임은 프리픽스 포함
  return `${gameType}:${key}`
}
```

**네임스페이스 예:**
```
ck3:       abc123...           (프리픽스 없음)
vic3:      vic3:abc123...
stellaris: stellaris:abc123...
```

**이유:**
- CK3가 첫 번째 구현이므로 기존 캐시와 호환성 유지
- 새 게임은 명시적 네임스페이스 사용
- 동일한 텍스트라도 게임별로 다른 번역 가능

## 캐시 흐름

### 읽기 흐름

```
┌─────────────────────────────┐
│ 1. 번역 요청                │
│    translate(text, hash)    │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 2. 캐시 확인                │
│    hasCache(hash)?          │
├──────────┬──────────────────┤
│ Yes      │ No               │
│ ↓        │ ↓                │
│ getCache │ AI 번역          │
└──────────┴──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 3. 결과 반환                │
└─────────────────────────────┘
```

### 쓰기 흐름

```
┌─────────────────────────────┐
│ 1. AI 번역 완료             │
│    translated = "..."       │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 2. 캐시 저장                │
│    setCache(hash, text)     │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 3. SQLite 영구 저장         │
│    translate-cache.db       │
└─────────────────────────────┘
```

## API

### `hasCache(key, gameType)`

캐시 존재 여부를 확인합니다.

**매개변수:**
- `key: string` - 캐시 키 (해시)
- `gameType: GameType` - 게임 타입 (기본값: `'ck3'`)

**반환값:** `Promise<boolean>`

**예제:**

```typescript
const hash = await hashing("The Duke arrives")

if (await hasCache(hash, 'ck3')) {
  console.log('캐시 존재')
} else {
  console.log('캐시 없음')
}
```

**내부 구현:**

```typescript
export async function hasCache(key: string, gameType: GameType = 'ck3'): Promise<boolean> {
  return await translationCache.hasItem(getCacheKey(key, gameType))
}
```

### `getCache(key, gameType)`

캐시에서 번역을 조회합니다.

**매개변수:**
- `key: string` - 캐시 키
- `gameType: GameType` - 게임 타입

**반환값:** `Promise<string | null>`

**예제:**

```typescript
const hash = await hashing("The Duke arrives")
const cached = await getCache(hash, 'ck3')

if (cached) {
  console.log('캐시된 번역:', cached)
  // "공작이 도착합니다"
} else {
  console.log('캐시 미스')
}
```

### `setCache(key, value, gameType)`

번역을 캐시에 저장합니다.

**매개변수:**
- `key: string` - 캐시 키
- `value: string` - 번역된 텍스트
- `gameType: GameType` - 게임 타입

**반환값:** `Promise<void>`

**예제:**

```typescript
const hash = await hashing("The Duke arrives")
const translated = await translateAI("The Duke arrives", 'ck3')

await setCache(hash, translated, 'ck3')
console.log('캐시 저장 완료')
```

### `removeCache(key, gameType)`

캐시에서 항목을 제거합니다.

**매개변수:**
- `key: string` - 캐시 키
- `gameType: GameType` - 게임 타입

**반환값:** `Promise<void>`

**사용 시나리오:**
- 잘못된 번역 수정
- 사전 업데이트 시 무효화
- 재번역 강제 실행

**예제:**

```typescript
const hash = await hashing("The Duke arrives")

// 캐시 무효화
await removeCache(hash, 'ck3')

// 다음 번역 시 AI 재호출
const newTranslation = await translate("The Duke arrives", hash, 'ck3')
```

## 캐시 계층

### 3단계 캐시

```
1. Dictionary (즉시)
   ↓ 미스
2. Cache (빠름)
   ↓ 미스
3. AI Translation (느림)
```

**예제:**

```typescript
async function translate(text: string, hash: string, gameType: GameType) {
  // 1단계: 사전 (가장 빠름)
  if (hasDictionary(text, gameType)) {
    log.verbose('사전에서 번역 로드')
    return getDictionary(text, gameType)
  }
  
  // 2단계: 캐시 (빠름)
  if (await hasCache(hash, gameType)) {
    log.verbose('캐시에서 번역 로드')
    return await getCache(hash, gameType)
  }
  
  // 3단계: AI 번역 (느림)
  log.info('AI 번역 요청')
  const translated = await translateAI(text, gameType)
  
  // 캐시 저장
  await setCache(hash, translated, gameType)
  
  return translated
}
```

## 캐시 통계

### 히트율 계산

```typescript
interface CacheStats {
  totalRequests: number
  cacheHits: number
  cacheMisses: number
  hitRate: number
}

let stats: CacheStats = {
  totalRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  hitRate: 0
}

async function translateWithStats(text: string, hash: string, gameType: GameType) {
  stats.totalRequests++
  
  if (await hasCache(hash, gameType)) {
    stats.cacheHits++
    const cached = await getCache(hash, gameType)
    stats.hitRate = stats.cacheHits / stats.totalRequests
    return cached
  }
  
  stats.cacheMisses++
  const translated = await translateAI(text, gameType)
  await setCache(hash, translated, gameType)
  stats.hitRate = stats.cacheHits / stats.totalRequests
  
  return translated
}
```

**일반적인 히트율:**

```
초기 실행:  0-5%     (대부분 새 번역)
2차 실행:   90-95%   (변경된 항목만 재번역)
3차+ 실행:  95-99%   (거의 모든 항목 캐시됨)
```

## 캐시 무효화 전략

### 1. 해시 기반 자동 무효화

소스 텍스트가 변경되면 해시가 달라져 자동으로 무효화됩니다.

```typescript
// 원본 텍스트
const v1 = "The Duke arrives"
const hash1 = await hashing(v1)  // "abc123..."

await setCache(hash1, "공작이 도착합니다", 'ck3')

// 텍스트 변경
const v2 = "The Duke has arrived"
const hash2 = await hashing(v2)  // "def456..." (다른 해시!)

// 자동으로 캐시 미스 → 재번역
```

### 2. 사전 기반 무효화

사전이 업데이트되면 관련 항목을 무효화합니다.

```bash
pnpm ck3:update-dict
```

**동작:**

```typescript
// 사전 업데이트
'duke': '공작' → '대공'

// 무효화 대상 찾기
for (const [key, [text, hash]] of entries) {
  if (text.toLowerCase().includes('duke')) {
    await removeCache(hash, 'ck3')
  }
}
```

### 3. 검증 기반 무효화

검증 실패 시 무효화합니다.

```bash
pnpm ck3:retranslate
```

**동작:**

```typescript
for (const [key, [translated, hash]] of entries) {
  const valid = validateTranslation(source, translated, gameType)
  
  if (!valid.isValid) {
    await removeCache(hash, gameType)
  }
}
```

### 4. 수동 무효화

전체 캐시 또는 게임별 캐시를 삭제합니다.

```bash
# 전체 캐시 삭제 (주의!)
rm translate-cache.db*

# 다음 실행 시 모든 항목 재번역
pnpm ck3
```

## 캐시 크기 관리

### 예상 크기

```typescript
// 가정
const avgTextLength = 100        // 평균 텍스트 길이
const avgTranslationLength = 120 // 평균 번역 길이
const totalItems = 50000         // 총 항목 수

// 캐시 크기 계산
const keySize = 64                // 해시 크기 (바이트)
const valueSize = avgTranslationLength * 3  // UTF-8 (한글 3바이트)
const itemSize = keySize + valueSize
const totalSize = itemSize * totalItems

console.log(`예상 캐시 크기: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
// 약 20-30 MB
```

### 실제 크기 확인

```bash
ls -lh translate-cache.db

# 예: -rw-r--r-- 1 user user 25M Jan 1 12:00 translate-cache.db
```

### 캐시 정리

```bash
# SQLite VACUUM (공간 회수)
sqlite3 translate-cache.db "VACUUM;"

# 크기 감소 확인
ls -lh translate-cache.db
```

## 성능 최적화

### 배치 조회

```typescript
// 비효율적: 개별 조회
for (const hash of hashes) {
  const cached = await getCache(hash, gameType)
}

// 효율적: 배치 조회 (unstorage 기능 사용 시)
const cachedItems = await Promise.all(
  hashes.map(hash => getCache(hash, gameType))
)
```

### 연결 재사용

```typescript
// 데이터베이스 연결 재사용
const database = createDatabase(libSql({ url: `file:translate-cache.db` }))

// 모든 캐시 작업에서 동일한 연결 사용
const translationCache = createStorage({
  driver: dbDriver({ database })
})
```

## 백업 및 복구

### 백업

```bash
# 캐시 파일 백업
cp translate-cache.db translate-cache.db.backup

# 날짜별 백업
cp translate-cache.db "translate-cache-$(date +%Y%m%d).db"

# tar 압축 백업
tar -czf cache-backup-$(date +%Y%m%d).tar.gz translate-cache.db*
```

### 복구

```bash
# 백업에서 복구
cp translate-cache.db.backup translate-cache.db

# 손상된 캐시 수정
sqlite3 translate-cache.db "PRAGMA integrity_check;"

# 수정 불가능한 경우 재생성
rm translate-cache.db*
pnpm ck3  # 모든 항목 재번역
```

## 캐시 마이그레이션

### 게임 간 캐시 이동

```typescript
// 동일한 텍스트를 다른 게임에서도 사용
const hash = await hashing("The Duke arrives")

// CK3에서 캐시 조회
const ck3Translation = await getCache(hash, 'ck3')
// "공작이 도착합니다"

// VIC3 캐시에 복사
if (ck3Translation) {
  await setCache(hash, ck3Translation, 'vic3')
}
```

### 캐시 키 형식 변경

```typescript
// 구버전: 프리픽스 없음
// 신버전: 게임별 프리픽스

async function migrateCache() {
  // 1. 모든 CK3 캐시 읽기
  const ck3Items = await getAllCacheItems()
  
  // 2. 새 형식으로 복사
  for (const [hash, translation] of ck3Items) {
    await setCache(hash, translation, 'ck3')
  }
}
```

## 모니터링

### 캐시 상태 확인

```typescript
async function getCacheStatus() {
  // SQLite 정보 조회
  const { stdout } = await execAsync(
    'sqlite3 translate-cache.db "SELECT COUNT(*) FROM storage;"'
  )
  
  console.log(`캐시된 항목 수: ${stdout.trim()}`)
}
```

### 로그 분석

```bash
# 캐시 히트 로그
grep "캐시에서 번역 로드" translation.log | wc -l

# 캐시 미스 로그
grep "AI 번역 요청" translation.log | wc -l

# 히트율 계산
echo "scale=2; $(grep "캐시" translation.log | wc -l) / $(grep "번역" translation.log | wc -l) * 100" | bc
```

## 트러블슈팅

### 캐시가 작동하지 않음

**증상:** 동일한 텍스트가 계속 재번역됨

**원인:**
1. 해시 불일치
2. 캐시 키 오류
3. 데이터베이스 손상

**해결:**

```bash
# 1. 해시 확인
node -e "
const { hashing } = require('./scripts/utils/hashing.js')
hashing('test text').then(console.log)
"

# 2. 캐시 확인
sqlite3 translate-cache.db "SELECT * FROM storage LIMIT 5;"

# 3. 재생성
rm translate-cache.db*
pnpm ck3
```

### 캐시 파일 손상

**증상:** `database is locked` 또는 `database disk image is malformed`

**해결:**

```bash
# WAL 체크포인트
sqlite3 translate-cache.db "PRAGMA wal_checkpoint(FULL);"

# 무결성 검사
sqlite3 translate-cache.db "PRAGMA integrity_check;"

# 복구 시도
sqlite3 translate-cache.db ".recover" > recovered.sql
sqlite3 new-cache.db < recovered.sql
mv new-cache.db translate-cache.db
```

### 캐시 크기 증가

**증상:** 캐시 파일이 계속 커짐

**원인:** SQLite 빈 공간 회수 안 됨

**해결:**

```bash
# VACUUM 실행
sqlite3 translate-cache.db "VACUUM;"

# 자동 VACUUM 설정
sqlite3 translate-cache.db "PRAGMA auto_vacuum = FULL;"
```

## 비용 분석

### API 비용 절감

```typescript
// 가정
const monthlyTranslations = 10000
const hitRate = 0.95
const costPerCall = 0.0001  // $0.0001 per request

// 캐시 없이
const noCacheCost = monthlyTranslations * costPerCall
// $1.00

// 캐시 사용
const cacheMisses = monthlyTranslations * (1 - hitRate)
const withCacheCost = cacheMisses * costPerCall
// $0.05

// 절감
const savings = noCacheCost - withCacheCost
// $0.95 (95% 절감)
```

### 시간 절감

```typescript
// 가정
const avgAITime = 500     // ms
const avgCacheTime = 1    // ms

// 캐시 없이
const noCacheTime = monthlyTranslations * avgAITime
// 5,000,000 ms = 83 분

// 캐시 사용
const cacheHits = monthlyTranslations * hitRate
const cacheMisses = monthlyTranslations * (1 - hitRate)
const withCacheTime = (cacheHits * avgCacheTime) + (cacheMisses * avgAITime)
// 9,500 ms + 250,000 ms = 4.3 분

// 절감
const timeSavings = noCacheTime - withCacheTime
// 78.7 분 (95% 절감)
```

## 다음 단계

- [번역 파이프라인](translation-pipeline.md) - 캐시 통합
- [API 레퍼런스](api-reference.md) - 캐시 함수 상세
- [트러블슈팅](troubleshooting.md) - 캐시 문제 해결

---

**참고:** 캐시는 번역 시스템의 핵심 성능 요소입니다. 정기적인 백업과 모니터링을 권장합니다.
