const core = require('@actions/core');

/**
 * GitHub API 재시도 옵션
 */
const defaultOptions = {
  maxRetries: 5,
  baseDelays: [1_000, 2_000, 8_000, 10_000, 60_000] // 밀리초 단위
};

/**
 * GitHub API 오류 정보
 */
function parseApiError(error) {
  if (error.status) {
    return {
      status: error.status,
      message: error.message,
      headers: error.headers || error.response?.headers
    };
  }
  
  if (error.response) {
    return {
      status: error.response.status,
      message: error.response.data?.message || error.message,
      headers: error.response.headers
    };
  }
  
  return {
    status: undefined,
    message: String(error),
    headers: undefined
  };
}

/**
 * 재시도할 오류인지 확인합니다.
 * 
 * @param {number} status HTTP 상태 코드
 * @param {string} message 오류 메시지
 * @returns {boolean} 재시도 여부
 */
function shouldRetry(status, message) {
  // HTTP 상태 코드 확인
  if (status === 403 || status === 429) {
    return true;
  }
  
  if (status && status >= 500 && status < 600) {
    return true;
  }
  
  // 메시지에서 오류 패턴 확인
  if (message) {
    return (
      message.includes('403') ||
      message.includes('429') ||
      message.includes('Too Many Requests') ||
      message.includes('rate limit') ||
      !!message.match(/5[0-9][0-9]/)
    );
  }
  
  return false;
}

/**
 * Retry-After 헤더 값을 파싱합니다.
 * 
 * @param {string} headerValue Retry-After 헤더 값
 * @returns {number|null} 밀리초 단위 대기 시간, 파싱 실패 시 null
 */
function parseRetryAfterHeader(headerValue) {
  try {
    const value = headerValue.trim();
    
    // 숫자 값 (초 단위)
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10) * 1000;
    }
    
    // HTTP 날짜 형식
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const now = new Date();
      const waitTime = date.getTime() - now.getTime();
      return Math.max(0, waitTime);
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * 지정된 시간만큼 대기합니다.
 * 
 * @param {number} ms 밀리초 단위 대기 시간
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * GitHub API 요청에 대한 재시도 로직을 구현합니다.
 * 
 * @param {Function} operation 재시도할 작업
 * @param {string} operationName 작업 이름 (로깅용)
 * @param {Object} options 재시도 옵션
 * @param {number} options.maxRetries 최대 재시도 횟수
 * @param {number[]} options.baseDelays 기본 지연 시간 배열
 * @returns {Promise<any>} 작업 결과
 */
async function githubApiRetry(operation, operationName, options = {}) {
  const config = { ...defaultOptions, ...options };
  const { maxRetries, baseDelays } = config;

  // maxRetries와 baseDelays.length가 동기화되도록 보장
  if (maxRetries !== baseDelays.length) {
    throw new Error(`maxRetries (${maxRetries})와 baseDelays.length (${baseDelays.length})는 동일해야 합니다.`);
  }

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const apiError = parseApiError(error);
      const { status, message } = apiError;
      
      // 재시도할 오류 타입 확인 (403, 429, 5xx)
      if (!shouldRetry(status, message)) {
        throw error;
      }
      
      // 마지막 시도인 경우 실패 처리
      if (attempt === maxRetries) {
        throw new Error(`${operationName} 실패 (최대 재시도 초과): ${message}`);
      }
      
      // Retry-After 헤더 확인
      let retryDelay = baseDelays[attempt];
      if (apiError.headers?.['retry-after']) {
        const retryAfter = parseRetryAfterHeader(apiError.headers['retry-after']);
        if (retryAfter !== null) {
          retryDelay = Math.max(retryDelay, retryAfter);
          core.info(`[${operationName}] Retry-After 헤더에 따라 ${retryAfter}ms 후 재시도`);
        }
      }
      
      core.info(`[${operationName}] 시도 ${attempt + 1}/${maxRetries + 1}: ${message}`);
      await delay(retryDelay);
    }
  }
  
  // 여기까지 오지 않아야 하지만 타입 안정성을 위해
  throw lastError;
}

module.exports = {
  githubApiRetry,
  shouldRetry,
  parseRetryAfterHeader,
  delay,
  parseApiError
};