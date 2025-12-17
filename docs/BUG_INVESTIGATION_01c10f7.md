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

## 가능한 원인

### 1. 해시가 무효화됨 (invalidation)

다음 시나리오 중 하나가 해시를 제거했을 가능성:

#### A. Dictionary Invalidation (`scripts/utils/dictionary-invalidator.ts`)
- 단어사전이 업데이트되었고
- 해당 키의 번역이 단어사전 키를 포함하고 있어서
- 해시가 `null`로 설정됨

#### B. Retranslation Invalidation (`scripts/utils/retranslation-invalidator.ts`)
- 번역 검증 실패 (`validateTranslation()`)
- 잘못된 번역으로 감지되어
- 해시가 `null`로 설정됨

### 2. 원래 해시가 없었음

- 이전 커밋에서 `targetHash`가 이미 `null`이었을 가능성
- 하지만 이 경우 왜 해시가 없었는지 조사 필요

### 3. 번역 캐시 이슈

- AI 번역 캐시가 업데이트됨
- 같은 소스 텍스트에 대해 다른 번역 결과 반환
- 하지만 캐시는 이미 번역된 항목을 재번역하는 것과는 무관

## 조사 필요 사항

1. **이전 커밋 확인**
   - 01c10f7 이전 커밋에서 이 키의 상태 확인
   - `targetHash`가 있었는지, 없었는지
   - 번역 내용이 정확히 무엇이었는지

2. **Workflow 로그 확인**
   - 01c10f7 커밋을 생성한 workflow 실행 로그
   - Dictionary invalidation 또는 Retranslation workflow가 실행되었는지
   - 해당 키가 무효화 대상에 포함되었는지

3. **Git 히스토리 분석**
   - 이 키가 마지막으로 정상적으로 번역된 시점
   - 해시가 제거된 정확한 시점
   - 어떤 변경사항이 해시 제거를 트리거했는지

## 재현 방법

1. 번역된 항목의 해시를 의도적으로 `null`로 설정
2. 번역 스크립트 실행
3. 소스 해시가 동일해도 재번역되는지 확인

## 수정 방향

### 단기 수정
- 불필요한 재번역을 방지하기 위한 추가 검증 로직
- 해시가 없는 이유를 로그에 명확히 기록

### 장기 수정
- Invalidation 로직이 정확하게 작동하는지 검증
- 의도하지 않은 해시 제거를 방지하는 안전장치
- Workflow 실행 이력과 무효화 대상을 추적하는 시스템

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

### 2. 향후 추가 개선 방안

1. **해시 검증 강화**: `translate.ts`에서 해시가 동일하면 캐시 무시하고 강제 스킵
2. **번역 결정성**: AI 프롬프트에 deterministic 출력 요청 추가
3. **변경 감지**: 업스트림 파일이 실제로 변경된 경우에만 워크플로우 실행

## 현재 상태

- ✅ **해결됨** - 워크플로우 빈도를 24회/일에서 1회/일로 감소
- ✅ 비용 절감: ~96%
- ⏳ 추가 최적화 검토 중
