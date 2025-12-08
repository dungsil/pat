// parser/toml.ts - TOML 파일 파싱 유틸리티
import TOML from '@iarna/toml';

export function parseToml(content: string): unknown {
  return TOML.parse(content);
}
