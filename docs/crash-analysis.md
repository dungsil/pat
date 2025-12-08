# CK3 RICE 모드 크래시 분석 보고서

## 문제 요약
CK3 RICE 모드의 한국어 번역을 게임에 적용하면 **게임이 크래시**하는 문제가 발생함.

## 원인 분석

### 1. 발견된 문제
번역 파일에서 **214개의 잘못된 변수 패턴**이 발견됨:
- **패턴**: `$[` (달러 변수 구문과 대괄호 함수 구문의 혼합)
- **위치**: `ck3/RICE/mod/localization/korean/` 디렉토리의 여러 yml 파일

### 2. 구체적인 예시

#### 잘못된 번역 (크래시 발생):
```yaml
RICE_sri_lanka_aspiration_vijayabahu_desc: "...\n$EFFECT_LIST_BULLET$[GetTitleByKey('k_lanka').GetNameNoTier]의 [king|E]이 되십시오"
```

#### 올바른 형식 (원본):
```yaml
RICE_sri_lanka_aspiration_vijayabahu_desc: "...\n$EFFECT_LIST_BULLET$ [GetTitleByKey('k_lanka').GetNameNoTier]의 [king|E]이 되십시오"
```

**차이점**: `$EFFECT_LIST_BULLET$` 다음에 공백이 있어야 하는데, 번역 과정에서 공백이 제거되어 `$EFFECT_LIST_BULLET$[`가 되면서 게임 엔진이 인식할 수 없는 잘못된 구문이 생성됨.

### 3. 게임 크래시가 발생하는 이유

Crusader Kings III의 게임 엔진은 다음과 같은 변수 구문을 지원:
- `$variable$` - 달러 변수
- `[Function]` - 대괄호 함수
- `£variable£` - 파운드 변수 (화폐/자원)
- `@icon@` - 아이콘 참조

그러나 **혼합 구문은 지원하지 않음**:
- `$[...]` ❌ (달러 + 대괄호)
- `£[...]` ❌ (파운드 + 대괄호)
- `[$...]` ❌ (대괄호 내 달러)

이러한 잘못된 구문을 게임 엔진이 파싱하려고 시도하다가 **크래시가 발생**.

## 영향 범위

### 파일별 분포
분석 결과, 주로 다음 파일들에서 발견됨:
- `___rice_sri_lanka_l_korean.yml` - 대부분의 오류 포함
- `___RICE_north_atlantic_l_korean.yml` - 다수의 오류 포함
- 기타 RICE 모드 번역 파일들

### 총 214개의 malformed pattern
모두 `$[` 패턴 (달러-대괄호 혼합)

## 해결 방법

### 자동 수정: retranslate 스크립트 실행

프로젝트에 이미 구현된 검증 로직(`scripts/utils/translation-validator.ts`)이 이 문제를 감지할 수 있음:

```typescript
// detectMalformedVariables 함수가 이미 $[ 패턴을 감지함 (line 48)
const dollarMixedPatterns = [
  /\$\[/g,  // $[
  /\$</g,   // $<
  /\$\s+\w+\s+\$/g,  // $ variable $ (공백 포함)
]
```

**해결 명령어**:
```bash
# 1. 잘못 번역된 항목 무효화 (해시 초기화)
pnpm ck3:retranslate

# 2. 재번역 실행
pnpm ck3
```

이 과정을 통해:
1. `retranslate` 스크립트가 기존 번역의 유효성을 검증
2. 잘못된 패턴이 감지된 항목의 해시를 초기화
3. 다음 번역 시 올바르게 재번역됨 (공백이 유지됨)

### 검증된 해결책

테스트 결과, 현재 구현된 `validateTranslation` 함수가 정상적으로 작동함:

```javascript
// Test input
const translation = "$EFFECT_LIST_BULLET$[GetTitleByKey('k_lanka').GetNameNoTier]의"

// Validation result
{
  isValid: false,
  reason: '잘못된 형식의 변수 패턴 감지 (게임 크래시 위험): $['
}
```

## 예방 조치

### 현재 구현된 안전장치
1. **번역 검증** (`scripts/utils/translate.ts`, line 89-95):
   - 새로운 AI 번역이 생성될 때마다 검증
   - 검증 실패 시 자동 재번역

2. **캐시 검증** (`scripts/utils/translate.ts`, line 70-77):
   - 캐시된 번역도 검증
   - 잘못된 캐시는 자동 제거

3. **재번역 스크립트** (`scripts/utils/retranslation-invalidator.ts`):
   - 기존 번역 파일의 품질 검증
   - 문제가 있는 항목의 해시 초기화

### 이 문제가 발생한 이유
검증 로직은 이미 구현되어 있었으나, 해당 번역들은 **검증 로직이 추가되기 전에 생성**된 것으로 추정됨.

## 권장 사항

### 즉시 조치
```bash
# RICE 모드의 잘못된 번역 수정
pnpm ck3:retranslate  # 잘못된 항목 식별 및 무효화
pnpm ck3              # 재번역 실행
```

### 장기 조치
1. 정기적으로 `pnpm ck3:retranslate` 실행하여 번역 품질 유지
2. 새로운 번역 추가 시 게임 내에서 즉시 테스트
3. 번역 검증 로직이 활성화된 상태 유지

## 기술 세부사항

### 감지된 패턴의 예시
```
파일: ___rice_sri_lanka_l_korean.yml:455
패턴: $[
내용: $EFFECT_LIST_BULLET$[GetTitleByKey('k_lanka').GetNameNoTier]의 [king|E]이 되십시오

파일: ___RICE_north_atlantic_l_korean.yml:529
패턴: $[
내용: $EFFECT_LIST_BULLET$[greenland_estates_long|E]에서 매년 추가 [prestige_i|E] 획득
```

### 검증 로직 위치
- 메인 검증 함수: `scripts/utils/translation-validator.ts` (line 181-320)
- 잘못된 패턴 감지: `scripts/utils/translation-validator.ts` (line 42-175)
- 번역 시 검증 적용: `scripts/utils/translate.ts` (line 89-95)
- 재번역 무효화: `scripts/utils/retranslation-invalidator.ts`
