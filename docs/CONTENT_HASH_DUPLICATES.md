# 컨텐츠 해시 중복 항목에 대한 설명

## 질문: 컨텐츠 해시가 똑같은데 왜 번역 대상에 들어간건가요?

### 답변: 이것은 정상적이고 올바른 동작입니다

## 예시: CFP 모드의 Skull Cup 항목들

커밋 `01c10f742ff3d5f43f0c70738b888530543cc1d5`에서 발견된 사례:

```yaml
# ck3/CFP/mod/localization/korean/___CFP_l_english_artifacts.yml
artifact_cfp_krum_skull_cup_name: "@cfp_icon_artifact! [killed.GetTitledFirstNamePossessiveNoTooltip] 해골 잔" # 15465426826473243722
artifact_cfp_kure_skull_cup_name: "@cfp_icon_artifact! [killed.GetTitledFirstNamePossessiveNoTooltip] 해골 잔" # 15465426826473243722
```

두 키가 **같은 해시 `15465426826473243722`**를 가지는 이유:

### 1. 원본 파일에서 같은 소스 텍스트

```yaml
# ck3/CFP/upstream/localization/english/CFP_l_english_artifacts.yml
artifact_cfp_krum_skull_cup_name:0 "@cfp_icon_artifact! [killed.GetTitledFirstNamePossessiveNoTooltip] Skull Cup"
artifact_cfp_kure_skull_cup_name:0 "@cfp_icon_artifact! [killed.GetTitledFirstNamePossessiveNoTooltip] Skull Cup"
```

- 두 키는 **동일한 영어 원문**을 가짐
- 이것은 게임 모드 제작자가 의도한 설계
- 역사적으로 다른 해골 잔(Khan Krum's vs Prince Kure's)이지만, 게임 내 표시 이름은 같음

### 2. 해시는 소스 텍스트의 무결성 검증용

```typescript
// scripts/utils/hashing.ts
const sourceHash = hashing(sourceValue) // 소스 텍스트 → 해시 변환
```

- 해시는 **소스 텍스트가 변경되었는지 감지**하는 용도
- 같은 소스 텍스트 = 같은 해시 (정상 동작)
- 해시 `15465426826473243722` = `hashing("@cfp_icon_artifact! [killed.GetTitledFirstNamePossessiveNoTooltip] Skull Cup")`

### 3. 번역 캐시는 소스 텍스트 기반

```typescript
// scripts/utils/translate.ts:194
const cacheKey = `${transliterationPrefix}${normalizedText}`
```

**첫 번째 키 처리 과정:**
```
1. artifact_cfp_krum_skull_cup_name 처리 시작
2. hasCache("Skull Cup") → false (캐시 없음)
3. translateAI("Skull Cup") → "해골 잔" (AI 번역)
4. setCache("Skull Cup", "해골 잔") (캐시 저장)
5. 출력: "해골 잔" # 15465426826473243722
```

**두 번째 키 처리 과정:**
```
1. artifact_cfp_kure_skull_cup_name 처리 시작
2. hasCache("Skull Cup") → true (캐시 있음!)
3. getCache("Skull Cup") → "해골 잔" (캐시에서 조회)
4. AI 호출 없음 ✓ (효율적!)
5. 출력: "해골 잔" # 15465426826473243722
```

### 4. 왜 두 키가 모두 출력 파일에 포함되나요?

**답변:** 두 키는 게임에서 서로 다른 목적으로 사용되기 때문입니다.

```yaml
artifact_cfp_krum_skull_cup_name      # Khan Krum의 해골 잔 이름
artifact_cfp_krum_skull_cup_description  # Khan Krum의 해골 잔 설명

artifact_cfp_kure_skull_cup_name      # Prince Kure의 해골 잔 이름  
artifact_cfp_kure_skull_cup_description  # Prince Kure의 해골 잔 설명
```

- 게임은 각 아티팩트를 별도로 추적함
- localization 키가 다르므로 각각 번역이 필요
- 같은 번역을 공유하지만, 각각 출력 파일에 포함되어야 함

## 시스템 동작 요약

### ✅ 올바른 동작들:

1. **같은 소스 텍스트 → 같은 해시** (정상)
2. **첫 번째 키 → AI 번역 호출** (필요)
3. **두 번째 키 → 캐시에서 조회** (효율적)
4. **두 키 모두 출력 파일에 포함** (게임 요구사항)

### 📊 성능 이점:

- AI API 호출 횟수 감소
- 번역 시간 단축
- 일관된 번역 품질 유지
- 중복된 소스 텍스트가 많을수록 효과 증가

## 코드 구현

### 순차 처리로 캐시 재사용 보장

```typescript
// scripts/factory/translate.ts:327
for (const [key, [sourceValue]] of entries) {
  const sourceHash = hashing(sourceValue)
  
  // 기존 번역 확인
  if (targetValue && (sourceHash === targetHash)) {
    continue // 이미 번역됨, 스킵
  }
  
  // 번역 요청 (캐시 확인 포함)
  translatedValue = await translate(sourceValue, gameType, ...)
  
  // 다음 키 처리...
}
```

- `for` 루프로 **순차 처리** (`Promise.all` 사용 안 함)
- `await translate()` 완료 후 다음 키 처리
- 두 번째 키 처리 시점에는 첫 번째 키의 번역이 이미 캐시에 저장됨

## 결론

**"컨텐츠 해시가 똑같은데 왜 번역 대상에 들어간건가?"**

→ 이것은 **정상적이고 의도된 동작**입니다.

1. 같은 소스 텍스트를 가진 **별개의 localization 키**들
2. 각 키는 게임에서 **다른 목적**으로 사용됨
3. 두 번째 키는 **캐시를 재사용**하여 AI 호출 없이 효율적으로 처리됨
4. 같은 해시를 가지는 것은 **소스가 같다는 정확한 증거**

시스템은 올바르게 작동하고 있으며, 중복된 번역 작업을 피하고 있습니다. ✓
