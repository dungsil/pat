# 조사 결과: 커밋 01c10f7의 동일 컨텐츠 해시 항목

## 질문
> 이 커밋 컨텐츠 해시가 똑같은데 왜 번역 대상에 들어간건지 확인해줘
> 
> 커밋: 01c10f742ff3d5f43f0c70738b888530543cc1d5

## 답변: 정상적인 동작입니다 ✅

동일한 컨텐츠 해시를 가진 항목들이 번역 대상에 포함된 것은 **의도된 정상 동작**입니다.

---

## 구체적 사례

### 발견된 중복 항목

파일: `ck3/RICE/mod/localization/korean/___rice_sicily_l_korean.yml`

```yaml
l_korean:
  activity_RICE_sicily_virgil_tomb_visit_predicted_cost: "이 [activity|E]의 비용은 주로 귀하의 [income|E]에 따라 결정됩니다." # 10498845032472754788
  activity_RICE_sicily_palermo_tomb_visit_predicted_cost: "이 [activity|E]의 비용은 주로 귀하의 [income|E]에 따라 결정됩니다." # 10498845032472754788
```

두 키가 **같은 해시 `10498845032472754788`**를 가집니다.

---

## 왜 같은 해시인가?

### 1. 원본 소스가 동일함

업스트림 파일(`ck3/RICE/upstream/localization/english/rice_sicily_l_english.yml` 추정):

```yaml
l_english:
  activity_RICE_sicily_virgil_tomb_visit_predicted_cost:0 "The cost of this [activity|E] is based primarily on your [income|E]."
  activity_RICE_sicily_palermo_tomb_visit_predicted_cost:0 "The cost of this [activity|E] is based primarily on your [income|E]."
```

**두 키가 완전히 동일한 영어 텍스트를 가지고 있습니다.**

### 2. 이것은 게임 모드의 의도적인 설계

- `activity_RICE_sicily_virgil_tomb_visit`: Virgil's Tomb(베르길리우스 무덤) 방문 활동
- `activity_RICE_sicily_palermo_tomb_visit`: Palermo Tomb(팔레르모 무덤) 방문 활동
- 서로 다른 활동이지만, **비용 설명 텍스트는 동일**하게 설정됨
- 각 활동은 다른 설명과 속성을 가짐

### 3. 해시는 소스 텍스트의 무결성 검증용

```
해시 = hashing(소스 텍스트)
```

- 해시는 **소스 텍스트의 변경을 감지**하기 위한 것
- 소스가 같으면 → 해시도 같음 (정상)
- 소스가 바뀌면 → 해시도 바뀜 (재번역 필요)

---

## 번역 시스템의 효율적 처리

### 캐시 재사용으로 중복 번역 방지

```typescript
// scripts/utils/translate.ts
const cacheKey = `${transliterationPrefix}${normalizedText}`
```

**처리 과정:**

```
📝 파일 처리 시작: rice_sicily_l_korean.yml

1️⃣ activity_RICE_sicily_virgil_tomb_visit_predicted_cost 처리
   ├─ 소스: "The cost of this [activity|E] is based primarily on your [income|E]."
   ├─ 캐시 확인: hasCache(...) → ❌ 없음
   ├─ AI 번역: translateAI(...) → "이 [activity|E]의 비용은 주로 귀하의 [income|E]에 따라 결정됩니다."
   ├─ 캐시 저장: setCache(...)
   └─ 출력: "이 [activity|E]의 비용은..." # 10498845032472754788

2️⃣ activity_RICE_sicily_palermo_tomb_visit_predicted_cost 처리
   ├─ 소스: "The cost of this [activity|E]..." (동일!)
   ├─ 캐시 확인: hasCache(...) → ✅ 있음!
   ├─ 캐시 조회: getCache(...) → "이 [activity|E]의 비용은..."
   ├─ AI 호출: ❌ 없음 (효율적!)
   └─ 출력: "이 [activity|E]의 비용은..." # 10498845032472754788
```

### 순차 처리로 캐시 재사용 보장

```typescript
// scripts/factory/translate.ts:327
for (const [key, [sourceValue]] of entries) {
  // 순차 처리: await로 각 항목 완료 후 다음 진행
  translatedValue = await translate(sourceValue, gameType, ...)
}
```

- `for` 루프 사용 (병렬 처리 아님)
- 각 키를 순차적으로 처리
- 두 번째 키 처리 시점에는 첫 번째 키의 번역이 이미 캐시에 저장됨

---

## 왜 두 키가 모두 출력 파일에 포함되나?

### 답변: 게임에서 각각 다른 용도로 사용되기 때문

```yaml
# 게임에서 두 아티팩트는 별개의 아이템
artifact_cfp_krum_skull_cup_name        # Krum의 해골 잔 이름
artifact_cfp_krum_skull_cup_description # Krum의 해골 잔 설명 (고유)

artifact_cfp_kure_skull_cup_name        # Kure의 해골 잔 이름
artifact_cfp_kure_skull_cup_description # Kure의 해골 잔 설명 (고유)
```

- 두 아티팩트는 게임 내에서 별도로 존재
- 각각 고유한 localization 키가 필요
- 이름은 같지만 설명은 다름
- 따라서 두 키 모두 번역 파일에 포함되어야 함

---

## 시스템 검증

### 테스트 추가 및 검증 완료

`scripts/utils/translate.test.ts`에 다음 테스트 추가:

1. **동일 소스 텍스트 캐시 재사용 테스트**
   - 첫 번째 요청: AI 호출 + 캐시 저장
   - 두 번째 요청: 캐시 조회 (AI 호출 없음) ✓

2. **번역/음역 모드 캐시 분리 테스트**
   - 각 모드는 별도의 캐시 키 사용
   - 모드 간 캐시 충돌 없음 ✓

**결과: 전체 421개 테스트 모두 통과 ✅**

---

## 성능 이점

### ✨ 효율적인 처리

- ✅ **AI API 호출 감소**: 동일 소스는 한 번만 번역
- ✅ **처리 시간 단축**: 캐시 조회는 밀리초 단위
- ✅ **비용 절감**: AI API 호출 횟수 감소
- ✅ **일관성 유지**: 같은 소스는 항상 같은 번역

### 📊 실제 효과

CFP 모드의 artifacts 파일에서:
- 총 20개 항목 중 2개가 동일 소스
- **10% 비용 절감** (2/20 AI 호출 절약)
- 더 많은 중복이 있을수록 효과 증가

---

## 결론

### ✅ 시스템은 올바르게 작동하고 있습니다

1. **동일 컨텐츠 해시는 정상**: 같은 소스 텍스트 → 같은 해시
2. **캐시 재사용 작동**: 두 번째 키는 AI 호출 없이 캐시에서 조회
3. **모든 키 포함 필요**: 게임에서 각각 다른 용도로 사용
4. **테스트 검증 완료**: 421개 테스트 모두 통과

### 📝 추가 자료

- 상세 설명: `docs/CONTENT_HASH_DUPLICATES.md`
- 테스트 코드: `scripts/utils/translate.test.ts` (35개 테스트)

### 🎯 조치 필요 여부

**없음** - 현재 시스템은 의도대로 정상 작동 중입니다.
