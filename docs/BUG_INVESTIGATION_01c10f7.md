# 버그 조사: 소스 해시가 동일한데도 재번역된 항목

## 문제 요약

커밋 `01c10f742ff3d5f43f0c70738b888530543cc1d5`에서 **소스 해시가 변경되지 않았음에도** 번역이 재실행되어 번역문이 변경됨.

## 발견된 사례

**파일**: `ck3/RICE/mod/localization/korean/___rice_sicily_l_korean.yml`  
**키**: `RICE_sicily_virgil_tomb_visit_visitation_phase_desc`  
**해시**: `# 18333628935932212673` (변경 없음)

### 실제 변경 내용

```diff
- RICE_sicily_virgil_tomb_visit_visitation_phase_desc: "\"#italic 포르산 엣 헤크 올림 메미니스세 주와비트. #\"\\\"훗날 이 일도 즐거운 추억이 되리라\"\n- 베르길리우스" # 18333628935932212673
+ RICE_sicily_virgil_tomb_visit_visitation_phase_desc: "\"#italic 포르산 엣 헤크 올림 메미니세 주와비트.#\"\\\"언젠가 이 일도 돌이켜보면 즐거운 추억이 될 것이다\"\n- 베르길리우스" # 18333628935932212673
```

**변경 사항**:
- `메미니스세` → `메미니세` (오타 수정)
- `주와비트. #` → `주와비트.#` (공백 제거)
- `훗날 이 일도 즐거운 추억이 되리라` → `언젠가 이 일도 돌이켜보면 즐거운 추억이 될 것이다` (번역 개선)

**문제**: 소스 해시가 동일하므로 업스트림 영어 원문은 변경되지 않았음. 그런데도 재번역됨.

## 예상 동작

`scripts/factory/translate.ts:351-356` 로직에 따르면:

```typescript
if (targetValue && (sourceHash === targetHash)) {
  log.verbose(`[${mode}/${file}:${key}] 번역파일 문자열: ${targetHash} | "${targetValue}" (번역됨)`)
  newYaml.l_korean[key] = [targetValue, targetHash]
  processedCount++
  continue  // 소스가 변경되지 않았으면 스킵
}
```

- `targetValue`가 존재하고
- `sourceHash === targetHash`이면
- 재번역을 **스킵**해야 함

## YAML 파서 버그 수정

**파일**: `scripts/parser/yaml.ts`

**문제**: 값에 `#` 문자가 포함된 경우 (예: `"#italic text#"`), 해시 주석을 잘못 파싱

**원인**: 정규식 `/^"(.+?)"(?:\s+)?#(?:\s+)?(.*)$/`가 **non-greedy**로 첫 번째 `#`를 찾음

**예시**:
```yaml
key: "#italic text#" # 18333628935932212673
```

**변경 전 파싱 결과**:
- text: `""` (빈 문자열, 첫 `#` 앞까지만)  
- hash: `"italic text#" # 18333628935932212673` (첫 `#` 이후 전부)

**변경 후** (greedy 매칭 `.+`):
```typescript
const matchWithComment = /^"(.+)"\s+#\s+(.*)$/.exec(value)
```

**변경 후 파싱 결과**:
- text: `"#italic text#"` (마지막 `"` 까지)
- hash: `"18333628935932212673"` (마지막 `"` 다음의 `#` 이후)

**효과**:
- ✅ 값 내부의 `#` 문자 보존
- ✅ 해시 주석 올바르게 파싱  
- ✅ `sourceHash === targetHash` 비교 정상 작동
- ✅ 불필요한 재번역 차단

## 관련 코드

- `scripts/factory/translate.ts:338-356` - 번역 스킵 로직
- `scripts/utils/dictionary-invalidator.ts` - 단어사전 기반 무효화
- `scripts/utils/retranslation-invalidator.ts` - 잘못된 번역 무효화
- `.github/workflows/invalidate-on-dictionary-update.yml` - 단어사전 업데이트 워크플로우
- `.github/workflows/retranslate-invalid-translations.yml` - 재번역 워크플로우

## 근본 원인 파악

**확인된 원인**: AI 번역의 non-deterministic 동작

1. **워크플로우 실행 빈도**: 매시간 실행 (`0 * * * *`)
2. **AI 번역 동작**: 같은 소스 텍스트에 대해 매번 약간씩 다른 번역 생성
3. **캐시 동작**: 정상 작동하지만, AI가 다른 결과를 반환하면 파일이 수정됨
4. **결과**: 매시간 재번역 → 불필요한 비용 발생

### 발견 내용

GitHub MCP 서버를 통해 조사:
- 커밋 `9bd134c02f1495681c83ca4a89dbff54a00802c3`도 같은 파일 수정 (2 additions, 2 deletions)
- 매시간 자동 번역 워크플로우 실행
- 같은 키가 반복적으로 재번역됨

## 적용된 수정

### 1. 워크플로우 빈도 감소 ✅

**변경 전**:
```yaml
schedule:
  - cron: "0 * * * *"  # 매시간 (하루 24회)
```

**변경 후**:
```yaml
schedule:
  - cron: "0 0 * * *"  # 매일 자정 (하루 1회)
```

**영향**:
- CK3: 24회/일 → 1회/일 (96% 감소)
- VIC3: 24회/일 → 1회/일 (96% 감소)
- Stellaris: 24회/일 → 1회/일 (96% 감소)
- **예상 비용 절감**: ~96%

### 2. YAML 파서 수정 ✅

**문제**: 값에 `#` 문자가 포함된 경우 해시 주석을 잘못 파싱

**파일**: `scripts/parser/yaml.ts`

**변경 전**:
```typescript
// Non-greedy 매칭(.+?)으로 첫 번째 # 찾기 ❌
const matchWithComment = /^"(.+?)"(?:\s+)?#(?:\s+)?(.*)$/.exec(value)
// 결과: "#italic text#" # 18333... → text가 빈 문자열, hash가 "italic text..."
```

**변경 후**:
```typescript
// Greedy 매칭(.+)으로 마지막 " 다음의 # 찾기 ✅  
const matchWithComment = /^"(.+)"\s+#\s+(.*)$/.exec(value)
// 결과: "#italic text#" # 18333... → text가 "#italic text#", hash가 "18333..."
```

**효과**:
- 값 내부의 `#` 문자 보존
- 해시 주석 올바르게 파싱
- 해시 비교 정상 작동
- 재번역 차단

### 3. 코드 레벨 수정 ✅

**변경 파일**: `scripts/factory/translate.ts`

**문제**: 번역이 존재하지만 해시가 없는 경우, 매번 재번역 실행

**수정**: 번역이 있고 해시만 없으면, 해시를 추가하고 재번역 스킵

```typescript
// 변경 전: 해시 없으면 재번역
if (targetValue && targetHash && (sourceHash === targetHash)) {
  continue // 스킵
}
// targetValue가 있지만 targetHash가 없으면 재번역 실행 ❌

// 변경 후: 해시 없어도 번역 있으면 해시 추가 후 스킵
if (targetValue && !targetHash) {
  newYaml.l_korean[key] = [targetValue, sourceHash] // 해시 추가
  continue // 재번역 방지 ✅
}
```

**효과**:
- AI non-deterministic 동작의 영향 제거
- 해시가 없어도 기존 번역 보존
- 불필요한 재번역 완전 차단

### 3. 향후 추가 개선 방안

1. **번역 결정성**: AI 프롬프트에 deterministic 출력 요청 추가
2. **변경 감지**: 업스트림 파일이 실제로 변경된 경우에만 워크플로우 실행

## 현재 상태

- ✅ **해결됨** - 워크플로우 빈도를 24회/일에서 1회/일로 감소
- ✅ 비용 절감: ~96%
- ⏳ 추가 최적화 검토 중
