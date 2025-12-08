#!/usr/bin/env node
/**
 * Script to check for improperly translated proper nouns in More Character Names
 * 
 * This script scans Korean translation files line by line to find cases where
 * English words that should be transliterated as proper nouns are instead
 * translated to their Korean meanings.
 * 
 * Example: "Gold" should be "골드" (transliteration) not "금" (meaning)
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface TranslationEntry {
  key: string
  englishValue: string
  koreanValue: string
  lineNumber: number
  file: string
}

interface Issue {
  entry: TranslationEntry
  reason: string
  severity: 'high' | 'medium' | 'low'
}

// 고유명사로 나타나는 일반 영어 단어 및 잘못된 한국어 번역
// 더 높은 정밀도를 위해 정확한 값 매칭 사용
const PROBLEMATIC_PATTERNS = [
  // 금속 및 재료 (단일 단어는 정확히 일치, 복합 이름은 단어 경계 일치)
  { english: ['Gold'], incorrect: ['금'], correct: '골드', severity: 'high' as const },
  { english: ['Silver'], incorrect: ['은'], correct: '실버', severity: 'high' as const },
  { english: ['Iron'], incorrect: ['철', '쇠'], correct: '아이언', severity: 'high' as const },
  { english: ['Stone'], incorrect: ['돌', '석'], correct: '스톤', severity: 'medium' as const },
  { english: ['Wood'], incorrect: ['나무', '목'], correct: '우드', severity: 'medium' as const },
  { english: ['Steel'], incorrect: ['강철'], correct: '스틸', severity: 'medium' as const },
  
  // 일반 단어처럼 보이지만 이름인 단어들
  { english: ['Stake'], incorrect: ['말뚝'], correct: '스테이크', severity: 'high' as const },
  { english: ['Stale'], incorrect: ['시들한'], correct: '스테일', severity: 'high' as const },
  { english: ['Stare'], incorrect: ['주시', '응시'], correct: '스테어', severity: 'high' as const },
  { english: ['Watch'], incorrect: ['주시', '시계'], correct: '왓치/워치', severity: 'high' as const },
  { english: ['Ask'], incorrect: ['질문', '물어', '묻다'], correct: '애스크', severity: 'high' as const },
  { english: ['Find'], incorrect: ['찾기', '찾다', '발견'], correct: '파인드', severity: 'high' as const },
  { english: ['Give'], incorrect: ['주다', '제공', '주시오', '제공하라'], correct: '기브', severity: 'high' as const },
  { english: ['Hold'], incorrect: ['잡다', '잡으시오', '보유'], correct: '홀드', severity: 'high' as const },
  { english: ['Can'], incorrect: ['할 수 있'], correct: '캔', severity: 'high' as const },
  { english: ['Some'], incorrect: ['일부', '몇몇', '약간'], correct: '썸', severity: 'high' as const },
  { english: ['Far'], incorrect: ['멀리', '먼'], correct: '파', severity: 'high' as const },
  { english: ['Bad'], incorrect: ['나쁘', '악', '못된'], correct: '배드', severity: 'high' as const },
  { english: ['Best'], incorrect: ['최고', '가장 좋은'], correct: '베스트', severity: 'high' as const },
  { english: ['Wide'], incorrect: ['광활', '넓', '폭넓'], correct: '와이드', severity: 'high' as const },
  { english: ['Long'], incorrect: ['긴', '장'], correct: '롱', severity: 'high' as const },
  { english: ['Short'], incorrect: ['짧은', '단'], correct: '쇼트', severity: 'high' as const },
  { english: ['High'], incorrect: ['높은', '고'], correct: '하이', severity: 'high' as const },
  { english: ['Low'], incorrect: ['낮은', '저'], correct: '로우', severity: 'high' as const },
  { english: ['Strong'], incorrect: ['강한', '강력'], correct: '스트롱', severity: 'high' as const },
  { english: ['Weak'], incorrect: ['약한', '약'], correct: '위크', severity: 'high' as const },
  { english: ['Fast'], incorrect: ['빠른', '속'], correct: '패스트', severity: 'high' as const },
  { english: ['Slow'], incorrect: ['느린', '완만'], correct: '슬로우', severity: 'high' as const },
  { english: ['Old'], incorrect: ['늙은', '오래된', '고'], correct: '올드', severity: 'high' as const },
  { english: ['Young'], incorrect: ['젊은', '소'], correct: '영', severity: 'high' as const },
  { english: ['New'], incorrect: ['새로운', '신'], correct: '뉴', severity: 'high' as const },
  { english: ['Good'], incorrect: ['좋은', '선', '양호'], correct: '굿', severity: 'high' as const },
  { english: ['Great'], incorrect: ['위대한', '대'], correct: '그레이트', severity: 'high' as const },
  { english: ['Small'], incorrect: ['작은', '소'], correct: '스몰', severity: 'high' as const },
  { english: ['Big'], incorrect: ['큰', '대'], correct: '빅', severity: 'high' as const },
  { english: ['Little'], incorrect: ['작은', '소'], correct: '리틀', severity: 'high' as const },
  { english: ['Rich'], incorrect: ['부유한', '부자'], correct: '리치', severity: 'high' as const },
  { english: ['Poor'], incorrect: ['가난한', '빈'], correct: '푸어', severity: 'high' as const },
  { english: ['True'], incorrect: ['진실', '참된'], correct: '트루', severity: 'high' as const },
  { english: ['False'], incorrect: ['거짓', '허위'], correct: '폴스', severity: 'high' as const },
  { english: ['Fair'], incorrect: ['공정한', '정당'], correct: '페어', severity: 'high' as const },
  { english: ['Just'], incorrect: ['단지', '공정'], correct: '저스트', severity: 'high' as const },
  { english: ['Wild'], incorrect: ['야생', '거친'], correct: '와일드', severity: 'high' as const },
  { english: ['Free'], incorrect: ['자유', '무료'], correct: '프리', severity: 'high' as const },
  { english: ['Brave'], incorrect: ['용감한', '용맹'], correct: '브레이브', severity: 'high' as const },
  { english: ['Bold'], incorrect: ['대담한', '굵은'], correct: '볼드', severity: 'high' as const },
  { english: ['Wise'], incorrect: ['현명한', '지혜'], correct: '와이즈', severity: 'high' as const },
  { english: ['Swift'], incorrect: ['빠른', '신속'], correct: '스위프트', severity: 'high' as const },
  { english: ['Sharp'], incorrect: ['날카로운', '예리'], correct: '샤프', severity: 'high' as const },
  { english: ['Noble'], incorrect: ['고귀한', '귀족'], correct: '노블', severity: 'high' as const },
  
  // 이름으로 사용되는 일반 동사
  { english: ['Will'], incorrect: ['의지', '유언'], correct: '윌', severity: 'high' as const },
  { english: ['May'], incorrect: ['할 수 있다', '5월'], correct: '메이', severity: 'high' as const },
  { english: ['March'], incorrect: ['행진', '3월'], correct: '마치', severity: 'high' as const },
  { english: ['Mark'], incorrect: ['표시', '점수'], correct: '마크', severity: 'high' as const },
  { english: ['Grant'], incorrect: ['부여', '승인'], correct: '그랜트', severity: 'high' as const },
  { english: ['Hunt'], incorrect: ['사냥', '수색'], correct: '헌트', severity: 'high' as const },
  { english: ['Battle'], incorrect: ['전투'], correct: '배틀', severity: 'high' as const },
  { english: ['War'], incorrect: ['전쟁'], correct: '워', severity: 'high' as const },
  { english: ['Peace'], incorrect: ['평화'], correct: '피스', severity: 'high' as const },
  { english: ['Hope'], incorrect: ['희망'], correct: '호프', severity: 'high' as const },
  { english: ['Grace'], incorrect: ['은혜', '우아'], correct: '그레이스', severity: 'high' as const },
  { english: ['Faith'], incorrect: ['신앙', '믿음'], correct: '페이스', severity: 'high' as const },
  { english: ['Joy'], incorrect: ['기쁨'], correct: '조이', severity: 'high' as const },
  { english: ['Love'], incorrect: ['사랑'], correct: '러브', severity: 'high' as const },
  { english: ['Mercy'], incorrect: ['자비'], correct: '머시', severity: 'high' as const },
  { english: ['Charity'], incorrect: ['자선'], correct: '채리티', severity: 'high' as const },
  { english: ['Prudence'], incorrect: ['신중'], correct: '프루던스', severity: 'high' as const },
  { english: ['Justice'], incorrect: ['정의'], correct: '저스티스', severity: 'high' as const },
  { english: ['Constance'], incorrect: ['항상성', '불변'], correct: '콘스탄스', severity: 'high' as const },
  { english: ['Patience'], incorrect: ['인내'], correct: '페이션스', severity: 'high' as const },
  { english: ['Honor'], incorrect: ['명예'], correct: '아너', severity: 'high' as const },
  { english: ['Glory'], incorrect: ['영광'], correct: '글로리', severity: 'high' as const },
  { english: ['Victor'], incorrect: ['승리자'], correct: '빅터', severity: 'high' as const },
  { english: ['Victoria'], incorrect: ['승리'], correct: '빅토리아', severity: 'high' as const },
  
  // 천체
  { english: ['Sun'], incorrect: ['태양', '해'], correct: '선/썬', severity: 'high' as const },
  { english: ['Moon'], incorrect: ['달', '월'], correct: '문', severity: 'high' as const },
  { english: ['Star'], incorrect: ['별', '성'], correct: '스타', severity: 'high' as const },
  
  // 직함 (이름의 일부일 때) - "atte Stone"과 같은 복합 이름에 나타날 수 있음
  { english: ['King'], incorrect: ['왕'], correct: '킹', severity: 'medium' as const },
  { english: ['Queen'], incorrect: ['여왕'], correct: '퀸', severity: 'medium' as const },
  { english: ['Prince'], incorrect: ['왕자'], correct: '프린스', severity: 'medium' as const },
  { english: ['Duke'], incorrect: ['공작'], correct: '듀크', severity: 'medium' as const },
  
  // 색상
  { english: ['White'], incorrect: ['하얀', '백'], correct: '화이트', severity: 'medium' as const },
  { english: ['Black'], incorrect: ['검은', '흑'], correct: '블랙', severity: 'medium' as const },
  { english: ['Red'], incorrect: ['빨간', '적'], correct: '레드', severity: 'low' as const },
  { english: ['Blue'], incorrect: ['파란', '청'], correct: '블루', severity: 'low' as const },
  { english: ['Green'], incorrect: ['초록', '녹'], correct: '그린', severity: 'low' as const },
  { english: ['Gray'], incorrect: ['회색', '灰'], correct: '그레이', severity: 'low' as const },
  { english: ['Brown'], incorrect: ['갈색', '褐'], correct: '브라운', severity: 'low' as const },
  { english: ['Yellow'], incorrect: ['노란', '황'], correct: '옐로우', severity: 'low' as const },
  { english: ['Purple'], incorrect: ['보라', '자주'], correct: '퍼플', severity: 'low' as const },
  
  // 자연
  { english: ['Rose'], incorrect: ['장미'], correct: '로즈', severity: 'medium' as const },
  { english: ['River'], incorrect: ['강'], correct: '리버', severity: 'medium' as const },
  { english: ['Mountain'], incorrect: ['산'], correct: '마운틴', severity: 'medium' as const },
  { english: ['Forest'], incorrect: ['숲'], correct: '포레스트', severity: 'medium' as const },
  { english: ['Lake'], incorrect: ['호수'], correct: '레이크', severity: 'medium' as const },
  { english: ['Ocean'], incorrect: ['대양', '바다'], correct: '오션', severity: 'medium' as const },
  { english: ['Sky'], incorrect: ['하늘'], correct: '스카이', severity: 'medium' as const },
  { english: ['Rain'], incorrect: ['비'], correct: '레인', severity: 'medium' as const },
  { english: ['Snow'], incorrect: ['눈'], correct: '스노우', severity: 'medium' as const },
  { english: ['Storm'], incorrect: ['폭풍'], correct: '스톰', severity: 'medium' as const },
  { english: ['Wind'], incorrect: ['바람'], correct: '윈드', severity: 'medium' as const },
  { english: ['Fire'], incorrect: ['불', '화재'], correct: '파이어', severity: 'medium' as const },
  { english: ['Water'], incorrect: ['물'], correct: '워터', severity: 'medium' as const },
  { english: ['Earth'], incorrect: ['땅', '지구'], correct: '어스', severity: 'medium' as const },
  { english: ['Cloud'], incorrect: ['구름'], correct: '클라우드', severity: 'medium' as const },
  { english: ['Frost'], incorrect: ['서리', '얼음'], correct: '프로스트', severity: 'medium' as const },
  { english: ['Ice'], incorrect: ['얼음', '빙'], correct: '아이스', severity: 'medium' as const },
  { english: ['Flame'], incorrect: ['불꽃', '화염'], correct: '플레임', severity: 'medium' as const },
  { english: ['Thunder'], incorrect: ['천둥', '우레'], correct: '선더', severity: 'medium' as const },
  { english: ['Lightning'], incorrect: ['번개'], correct: '라이트닝', severity: 'medium' as const },
  { english: ['Spring'], incorrect: ['봄'], correct: '스프링', severity: 'medium' as const },
  { english: ['Summer'], incorrect: ['여름'], correct: '서머', severity: 'medium' as const },
  { english: ['Autumn'], incorrect: ['가을'], correct: '오텀', severity: 'medium' as const },
  { english: ['Winter'], incorrect: ['겨울'], correct: '윈터', severity: 'medium' as const },
  { english: ['Dawn'], incorrect: ['새벽'], correct: '던', severity: 'medium' as const },
  { english: ['Dusk'], incorrect: ['황혼'], correct: '더스크', severity: 'medium' as const },
  { english: ['Night'], incorrect: ['밤'], correct: '나이트', severity: 'medium' as const },
  { english: ['Day'], incorrect: ['날', '낮'], correct: '데이', severity: 'medium' as const },
  
  // 동물
  { english: ['Lion'], incorrect: ['사자'], correct: '라이언', severity: 'medium' as const },
  { english: ['Bear'], incorrect: ['곰'], correct: '베어', severity: 'medium' as const },
  { english: ['Wolf'], incorrect: ['늑대'], correct: '울프', severity: 'medium' as const },
  { english: ['Eagle'], incorrect: ['독수리'], correct: '이글', severity: 'medium' as const },
  { english: ['Fox'], incorrect: ['여우'], correct: '폭스', severity: 'medium' as const },
  { english: ['Deer'], incorrect: ['사슴'], correct: '디어', severity: 'medium' as const },
  { english: ['Hawk'], incorrect: ['매'], correct: '호크', severity: 'medium' as const },
  { english: ['Raven'], incorrect: ['까마귀', '흑조'], correct: '레이븐', severity: 'medium' as const },
  { english: ['Crow'], incorrect: ['까마귀'], correct: '크로우', severity: 'medium' as const },
  { english: ['Swan'], incorrect: ['백조'], correct: '스완', severity: 'medium' as const },
  { english: ['Dragon'], incorrect: ['용', '드래곤'], correct: '드래곤', severity: 'medium' as const },
  
  // 기타 일반 단어
  { english: ['Heart'], incorrect: ['심장', '마음'], correct: '하트', severity: 'low' as const },
  { english: ['Light'], incorrect: ['빛'], correct: '라이트', severity: 'low' as const },
  { english: ['Dark'], incorrect: ['어둠', '암흑'], correct: '다크', severity: 'low' as const },
  { english: ['Hand'], incorrect: ['손'], correct: '핸드', severity: 'low' as const },
  { english: ['Eye'], incorrect: ['눈', '안목'], correct: '아이', severity: 'low' as const },
  { english: ['Tooth'], incorrect: ['이', '치아'], correct: '투스', severity: 'low' as const },
  { english: ['Beard'], incorrect: ['수염'], correct: '비어드', severity: 'low' as const },
  { english: ['Hair'], incorrect: ['머리카락', '털'], correct: '헤어', severity: 'low' as const },
  { english: ['Head'], incorrect: ['머리', '두부'], correct: '헤드', severity: 'low' as const },
  { english: ['Arm'], incorrect: ['팔'], correct: '암', severity: 'low' as const },
  { english: ['Leg'], incorrect: ['다리'], correct: '레그', severity: 'low' as const },
  { english: ['Foot'], incorrect: ['발'], correct: '풋', severity: 'low' as const },
  
  // 방향
  { english: ['North'], incorrect: ['북', '북쪽'], correct: '노스', severity: 'medium' as const },
  { english: ['South'], incorrect: ['남', '남쪽'], correct: '사우스', severity: 'medium' as const },
  { english: ['East'], incorrect: ['동', '동쪽'], correct: '이스트', severity: 'medium' as const },
  { english: ['West'], incorrect: ['서', '서쪽'], correct: '웨스트', severity: 'medium' as const },
  
  // 나무
  { english: ['Oak'], incorrect: ['참나무', '떡갈나무'], correct: '오크', severity: 'medium' as const },
  { english: ['Pine'], incorrect: ['소나무'], correct: '파인', severity: 'medium' as const },
  { english: ['Ash'], incorrect: ['재', '물푸레나무'], correct: '애쉬', severity: 'medium' as const },
  { english: ['Elm'], incorrect: ['느릅나무'], correct: '엘름', severity: 'medium' as const },
  { english: ['Birch'], incorrect: ['자작나무'], correct: '버치', severity: 'medium' as const },
  { english: ['Willow'], incorrect: ['버드나무'], correct: '윌로우', severity: 'medium' as const },
  
  // 추가 동물
  { english: ['Horse'], incorrect: ['말'], correct: '호스', severity: 'medium' as const },
  { english: ['Bull'], incorrect: ['황소'], correct: '불', severity: 'medium' as const },
  { english: ['Ram'], incorrect: ['숫양'], correct: '램', severity: 'medium' as const },
  { english: ['Boar'], incorrect: ['멧돼지'], correct: '보어', severity: 'medium' as const },
  { english: ['Stag'], incorrect: ['수사슴'], correct: '스태그', severity: 'medium' as const },
  
  // 추가 자연
  { english: ['Sea'], incorrect: ['바다'], correct: '시', severity: 'medium' as const },
  { english: ['Hill'], incorrect: ['언덕'], correct: '힐', severity: 'medium' as const },
  { english: ['Valley'], incorrect: ['계곡'], correct: '밸리', severity: 'medium' as const },
  { english: ['Field'], incorrect: ['들판', '밭'], correct: '필드', severity: 'medium' as const },
  { english: ['Moor'], incorrect: ['황무지'], correct: '무어', severity: 'medium' as const },
  
  // 무기 및 물체
  { english: ['Sword'], incorrect: ['검'], correct: '소드', severity: 'medium' as const },
  { english: ['Spear'], incorrect: ['창'], correct: '스피어', severity: 'medium' as const },
  { english: ['Axe'], incorrect: ['도끼'], correct: '액스', severity: 'medium' as const },
  { english: ['Bow'], incorrect: ['활'], correct: '보우', severity: 'medium' as const },
  { english: ['Shield'], incorrect: ['방패'], correct: '쉴드', severity: 'medium' as const },
  { english: ['Arrow'], incorrect: ['화살'], correct: '애로우', severity: 'medium' as const },
  { english: ['Crown'], incorrect: ['왕관'], correct: '크라운', severity: 'medium' as const },
  { english: ['Ring'], incorrect: ['반지'], correct: '링', severity: 'medium' as const },
  
  // 추가 추상 개념
  { english: ['Blood'], incorrect: ['피', '혈'], correct: '블러드', severity: 'medium' as const },
  { english: ['Bone'], incorrect: ['뼈', '골'], correct: '본', severity: 'medium' as const },
  { english: ['Soul'], incorrect: ['영혼', '혼'], correct: '소울', severity: 'medium' as const },
  { english: ['Spirit'], incorrect: ['정신', '영'], correct: '스피릿', severity: 'medium' as const },
  { english: ['Shadow'], incorrect: ['그림자'], correct: '쉐도우', severity: 'medium' as const },
  { english: ['Dream'], incorrect: ['꿈'], correct: '드림', severity: 'medium' as const },
]

/**
 * Process a Korean YAML translation file line by line without storing all in memory
 */
function* parseKoreanFileStreaming(filePath: string): Generator<TranslationEntry> {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 매칭 패턴: key: "korean value" # hash
    const match = line.match(/^\s+([^:]+):\s+"([^"]+)"/)
    if (match) {
      yield {
        key: match[1].trim(),
        englishValue: '', // Will be filled later
        koreanValue: match[2],
        lineNumber: i + 1,
        file: filePath
      }
    }
  }
}

/**
 * Load English file into a map for fast lookup
 */
function loadEnglishFile(englishFilePath: string): Map<string, string> {
  const content = readFileSync(englishFilePath, 'utf-8')
  const lines = content.split('\n')
  const map = new Map<string, string>()
  
  for (const line of lines) {
    // 매칭 패턴: key:0 "value"
    const match = line.match(/^\s+([^:]+):\d+\s+"([^"]+)"/)
    if (match) {
      map.set(match[1].trim(), match[2])
    }
  }
  
  return map
}

/**
 * Get English value from the loaded map
 */
function getEnglishValue(key: string, englishMap: Map<string, string>): string {
  return englishMap.get(key) || ''
}

/**
 * Check if a translation entry has a problematic translation
 */
function checkEntry(entry: TranslationEntry, type: string): Issue | null {
  for (const pattern of PROBLEMATIC_PATTERNS) {
    // 영어 값이 패턴 값과 정확히 일치하는지 확인 (대소문자 무시)
    // 또는 영어 값이 패턴 단어를 포함하는지 확인 (예: "atte Stone"과 같은 복합 이름)
    const englishValueLower = entry.englishValue.toLowerCase()
    const hasMatch = pattern.english.some(word => {
      const wordLower = word.toLowerCase()
      // 정확히 일치
      if (englishValueLower === wordLower) {
        return true
      }
      // 복합 이름에 대한 단어 경계 일치 (예: "atte Stone"은 "Stone"과 일치해야 함)
      const wordBoundaryRegex = new RegExp(`\\b${word}\\b`, 'i')
      return wordBoundaryRegex.test(entry.englishValue)
    })
    
    if (!hasMatch) {
      continue
    }
    
    // 특수 경우: "Old"가 역사적 설명자로 사용되는 문화 이름 건너뛰기
    // 예: "Old Saxon", "Old Norse", "Old English"는 역사적 시대를 가리키며 이름이 아님
    if (pattern.english.includes('Old') && type === 'Culture Names') {
      if (/^Old\s+[A-Z]/i.test(entry.englishValue)) {
        continue // This is a culture name with historical descriptor, not a proper name
      }
    }
    
    // 한국어 값에 잘못된 번역이 포함되어 있는지 확인
    for (const incorrect of pattern.incorrect) {
      if (entry.koreanValue.includes(incorrect)) {
        // 한국어의 경우, 전체 값인지 중요한 부분인지 확인
        // 한국어는 항상 단어 사이에 공백을 사용하지 않기 때문
        const koreanWords = entry.koreanValue.split(/\s+/)
        const isMatch = koreanWords.some(word => word === incorrect || word.startsWith(incorrect)) ||
                        entry.koreanValue === incorrect ||
                        (incorrect.length >= 3 && entry.koreanValue.includes(incorrect))
        
        if (isMatch) {
          const matchedWord = pattern.english.find(word => 
            word.toLowerCase() === englishValueLower || 
            new RegExp(`\\b${word}\\b`, 'i').test(entry.englishValue)
          )
          return {
            entry,
            reason: `"${entry.englishValue}" contains "${matchedWord}" but is translated with "${incorrect}" (meaning-based) instead of "${pattern.correct}" (name-based)`,
            severity: pattern.severity
          }
        }
      }
    }
  }
  
  return null
}

/**
 * Main function
 */
async function main() {
  const baseDir = resolve(process.cwd(), 'ck3/ETC')
  
  const files = [
    {
      korean: resolve(baseDir, 'mod/localization/korean/More Character Names/names/___character_names_l_korean.yml'),
      english: resolve(baseDir, 'upstream/More Character Names/names/character_names_l_english.yml'),
      type: 'Character Names'
    },
    {
      korean: resolve(baseDir, 'mod/localization/korean/More Character Names/dynasties/___dynasty_names_l_korean.yml'),
      english: resolve(baseDir, 'upstream/More Character Names/dynasties/dynasty_names_l_english.yml'),
      type: 'Dynasty Names'
    },
    {
      korean: resolve(baseDir, 'mod/localization/korean/More Character Names/culture/___culture_name_lists_l_korean.yml'),
      english: resolve(baseDir, 'upstream/More Character Names/culture/culture_name_lists_l_english.yml'),
      type: 'Culture Names'
    }
  ]
  
  const allIssues: Issue[] = []
  
  for (const { korean, english, type } of files) {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`Checking ${type}...`)
    console.log(`Korean file: ${korean}`)
    console.log(`English file: ${english}`)
    console.log('='.repeat(80))
    
    try {
      // 영어 파일을 메모리에 한 번 로드
      console.log('Loading English file...')
      const englishMap = loadEnglishFile(english)
      console.log(`Loaded ${englishMap.size} English entries`)
      
      // 한국어 파일을 한 줄씩 처리
      let totalCount = 0
      let checkedCount = 0
      
      for (const entry of parseKoreanFileStreaming(korean)) {
        totalCount++
        entry.englishValue = getEnglishValue(entry.key, englishMap)
        
        if (entry.englishValue) {
          const issue = checkEntry(entry, type)
          if (issue) {
            allIssues.push(issue)
          }
          checkedCount++
        }
        
        // 5000개 항목마다 진행 표시
        if (totalCount % 5000 === 0) {
          console.log(`  Processed ${totalCount} entries, checked ${checkedCount}...`)
        }
      }
      
      console.log(`Completed checking ${checkedCount} entries from ${type}`)
    } catch (error) {
      console.error(`Error processing ${type}:`, error)
    }
  }
  
  // 요약 출력
  console.log(`\n${'='.repeat(80)}`)
  console.log('SUMMARY OF ISSUES FOUND')
  console.log('='.repeat(80))
  console.log(`Total issues found: ${allIssues.length}\n`)
  
  // 심각도별로 그룹화
  const bySeverity = {
    high: allIssues.filter(i => i.severity === 'high'),
    medium: allIssues.filter(i => i.severity === 'medium'),
    low: allIssues.filter(i => i.severity === 'low')
  }
  
  console.log(`High severity: ${bySeverity.high.length}`)
  console.log(`Medium severity: ${bySeverity.medium.length}`)
  console.log(`Low severity: ${bySeverity.low.length}\n`)
  
  // 상세 문제 출력
  for (const severity of ['high', 'medium', 'low'] as const) {
    const issues = bySeverity[severity]
    if (issues.length === 0) continue
    
    console.log(`\n${'─'.repeat(80)}`)
    console.log(`${severity.toUpperCase()} SEVERITY ISSUES (${issues.length})`)
    console.log('─'.repeat(80))
    
    for (const issue of issues) {
      const fileName = issue.entry.file.split('/').slice(-3).join('/')
      console.log(`\nFile: ${fileName}:${issue.entry.lineNumber}`)
      console.log(`Key: ${issue.entry.key}`)
      console.log(`English: "${issue.entry.englishValue}"`)
      console.log(`Korean: "${issue.entry.koreanValue}"`)
      console.log(`Issue: ${issue.reason}`)
    }
  }
  
  // 추가 처리를 위해 JSON으로 내보내기
  const output = {
    timestamp: new Date().toISOString(),
    totalIssues: allIssues.length,
    bySeverity: {
      high: bySeverity.high.length,
      medium: bySeverity.medium.length,
      low: bySeverity.low.length
    },
    issues: allIssues.map(issue => ({
      file: issue.entry.file.split('/').slice(-3).join('/'),
      lineNumber: issue.entry.lineNumber,
      key: issue.entry.key,
      english: issue.entry.englishValue,
      korean: issue.entry.koreanValue,
      reason: issue.reason,
      severity: issue.severity
    }))
  }
  
  const outputPath = '/tmp/proper-noun-issues.json'
  const fs = await import('node:fs/promises')
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2))
  console.log(`\n${'='.repeat(80)}`)
  console.log(`Detailed report saved to: ${outputPath}`)
  console.log('='.repeat(80))
}

main().catch(console.error)
