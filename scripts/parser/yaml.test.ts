import { describe, it, expect } from 'vitest'
import { parseYaml, stringifyYaml } from './yaml'

describe('parseYaml 파싱', () => {
  it('기본 YAML 구조를 파싱할 수 있어야 함', () => {
    const content = `l_english:
  key1: "value1"
  key2: "value2"`
    
    const result = parseYaml(content)
    
    expect(result).toEqual({
      'l_english': {
        'key1': ['value1', null],
        'key2': ['value2', null]
      }
    })
  })

  it('주석이 있는 값을 처리할 수 있어야 함', () => {
    const content = `l_english:
  key1: "value1" # comment1
  key2: "value2" # comment2`
    
    const result = parseYaml(content)
    
    expect(result).toEqual({
      'l_english': {
        'key1': ['value1', 'comment1'],
        'key2': ['value2', 'comment2']
      }
    })
  })

  it('주석 라인을 건너뛸 수 있어야 함', () => {
    const content = `l_english:
  # This is a comment
  key1: "value1"
  # Another comment
  key2: "value2"`
    
    const result = parseYaml(content)
    
    expect(result).toEqual({
      'l_english': {
        'key1': ['value1', null],
        'key2': ['value2', null]
      }
    })
  })

  it('키 정의의 숫자 값을 처리할 수 있어야 함', () => {
    const content = `l_english: 0
  key1: "value1"
  key2: "value2"`
    
    const result = parseYaml(content)
    
    expect(result['l_english']).toBeDefined()
    expect(result['l_english']['key1']).toEqual(['value1', null])
  })

  it('빈 값을 처리할 수 있어야 함', () => {
    const content = `l_english:
  key1: ""
  key2: "value2"`
    
    const result = parseYaml(content)
    
    expect(result['l_english']['key1']).toBeUndefined()
    expect(result['l_english']['key2']).toEqual(['value2', null])
  })

  it('Unix 줄바꿈(LF)을 처리할 수 있어야 함', () => {
    const content = `l_english:\n  key1: "value1"\n  key2: "value2"`
    
    const result = parseYaml(content)
    
    expect(result['l_english']['key1']).toEqual(['value1', null])
    expect(result['l_english']['key2']).toEqual(['value2', null])
  })

  it('Windows 줄바꿈(CRLF)을 처리할 수 있어야 함', () => {
    const content = `l_english:\r\n  key1: "value1"\r\n  key2: "value2"`
    
    const result = parseYaml(content)
    
    expect(result['l_english']['key1']).toEqual(['value1', null])
    expect(result['l_english']['key2']).toEqual(['value2', null])
  })

  it('값의 특수 문자를 처리할 수 있어야 함', () => {
    const content = `l_english:
  key1: "Value with $variable$"
  key2: "Value with [GetTitle]"`
    
    const result = parseYaml(content)
    
    expect(result['l_english']['key1']).toEqual(['Value with $variable$', null])
    expect(result['l_english']['key2']).toEqual(['Value with [GetTitle]', null])
  })

  it('값의 이스케이프된 따옴표를 처리할 수 있어야 함', () => {
    const content = `l_english:
  key1: "Value with \\"quoted\\" text"`
    
    const result = parseYaml(content)
    
    expect(result['l_english']['key1']).toEqual(['Value with \\"quoted\\" text', null])
  })

  it('여러 섹션을 처리할 수 있어야 함', () => {
    // 별도 파일 또는 적절한 분리로
    const content1 = `l_english:
  key1: "value1"`
    const content2 = `l_korean:
  key1: "값1"`
    
    const result1 = parseYaml(content1)
    const result2 = parseYaml(content2)
    
    expect(result1['l_english']['key1']).toEqual(['value1', null])
    expect(result2['l_korean']['key1']).toEqual(['값1', null])
  })
})

describe('stringifyYaml 직렬화', () => {
  it('기본 데이터 구조를 직렬화할 수 있어야 함', () => {
    const data = {
      'l_korean': {
        'key1': ['값1', null] as [string, string | null],
        'key2': ['값2', null] as [string, string | null]
      }
    }
    
    const result = stringifyYaml(data)
    
    expect(result).toContain('\uFEFFl_korean:')
    expect(result).toContain('  key1: "값1"')
    expect(result).toContain('  key2: "값2"')
  })

  it('해시 주석이 있을 때 포함해야 함', () => {
    const data = {
      'l_korean': {
        'key1': ['값1', 'hash123'] as [string, string | null]
      }
    }
    
    const result = stringifyYaml(data)
    
    expect(result).toContain('  key1: "값1" # hash123')
  })

  it('섹션 헤더에 UTF-8 BOM을 추가해야 함', () => {
    const data = {
      'l_korean': {
        'key1': ['값1', null] as [string, string | null]
      }
    }
    
    const result = stringifyYaml(data)
    
    expect(result.startsWith('\uFEFFl_korean:')).toBe(true)
  })

  it('값의 따옴표를 이스케이프해야 함', () => {
    const data = {
      'l_korean': {
        'key1': ['값 with "quotes"', null] as [string, string | null]
      }
    }
    
    const result = stringifyYaml(data)
    
    expect(result).toContain('  key1: "값 with \\"quotes\\""')
  })

  it('이미 이스케이프된 따옴표를 올바르게 처리해야 함', () => {
    const data = {
      'l_korean': {
        'key1': ['값 with \\"quotes\\"', null] as [string, string | null]
      }
    }
    
    const result = stringifyYaml(data)
    
    // 중복 이스케이프하지 않아야 함
    expect(result).toContain('  key1: "값 with \\"quotes\\""')
  })

  it('빈 값을 처리할 수 있어야 함', () => {
    const data = {
      'l_korean': {
        'key1': ['', null] as [string, string | null],
        'key2': ['값2', null] as [string, string | null]
      }
    }
    
    const result = stringifyYaml(data)
    
    expect(result).toContain('  key2: "값2"')
    // 빈 값은 개행을 생성해야 함
    expect(result.split('\n').length).toBeGreaterThan(2)
  })

  it('여러 섹션을 처리할 수 있어야 함', () => {
    const data = {
      'l_korean': {
        'key1': ['값1', null] as [string, string | null]
      },
      'l_japanese': {
        'key1': ['値1', null] as [string, string | null]
      }
    }
    
    const result = stringifyYaml(data)
    
    expect(result).toContain('\uFEFFl_korean:')
    expect(result).toContain('\uFEFFl_japanese:')
  })

  it('값의 특수 문자를 처리할 수 있어야 함', () => {
    const data = {
      'l_korean': {
        'key1': ['$variable$ 변수', null] as [string, string | null],
        'key2': ['[GetTitle] 제목', null] as [string, string | null]
      }
    }
    
    const result = stringifyYaml(data)
    
    expect(result).toContain('  key1: "$variable$ 변수"')
    expect(result).toContain('  key2: "[GetTitle] 제목"')
  })
})

describe('parseYaml과 stringifyYaml 통합', () => {
  it('파싱과 직렬화를 왕복 처리할 수 있어야 함', () => {
    const original = `l_korean:
  key1: "값1"
  key2: "값2" # hash123`
    
    const parsed = parseYaml(original)
    const stringified = stringifyYaml(parsed)
    const reparsed = parseYaml(stringified)
    
    expect(reparsed).toEqual(parsed)
  })
})
