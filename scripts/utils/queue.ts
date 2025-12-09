import { TranslationRefusedError } from './ai'
import { delay } from './delay'
import { log } from './logger'

type QueueTask = { key: string, queue: () => Promise<void>, resolve: () => void, reject: (reason?: any) => void }
const translationQueue: QueueTask[] = []

const MAX_RETRIES = 5
const RETRY_DELAYS = [1_000, 2_000, 8_000, 10_000, 60_000] // 밀리초 단위

let lastRequestTime = 0
let isProcessing = false

/**
 * 번역 요청을 큐에 등록하고 완료 여부를 Promise로 반환합니다.
 * 실패 시에는 거부된 에러를 그대로 전파하여 상위 로직이 중단/저장 동작을 수행할 수 있게 합니다.
 */
export function addQueue (key: string, newQueue: () => Promise<void>) {
  return new Promise<void>((resolve, reject) => {
    translationQueue.push({ key, queue: newQueue, resolve, reject })
    void processQueue()
  })
}

async function processQueue (): Promise<void> {
  if (isProcessing) {
    return
  }

  isProcessing = true

  while (translationQueue.length > 0) {
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime
    if (timeSinceLastRequest < 100) {
      await delay(100 - timeSinceLastRequest)
    }

    const task = translationQueue.shift()
    if (!task) {
      break
    }

    lastRequestTime = Date.now()
    try {
      await executeTaskWithRetry(task)
      task.resolve()
    } catch (error) {
      task.reject(error)
      // 남은 작업들도 모두 reject 처리
      while (translationQueue.length > 0) {
        const remainingTask = translationQueue.shift()
        if (remainingTask) {
          remainingTask.reject(new Error('큐 처리가 이전 에러로 인해 중단됨', { cause: error }))
        }
      }
      isProcessing = false
      return
    }
  }

  isProcessing = false
}

async function executeTaskWithRetry (task: QueueTask, retryCount = 0): Promise<void> {
  try {
    await task.queue()
  } catch (error) {
    // TranslationRefusedError는 재시도 없이 즉시 전파
    if (error instanceof TranslationRefusedError) {
      throw error
    }

    const message = (error as Error).message
    if (message) {
      if (!message.includes('429 Too Many Requests')) {
        log.warn('[', task.key ,']요청 실패:', (error as Error).message)
        log.debug('\t', error)
      }
    }

    if (retryCount < MAX_RETRIES) {
      log.info(`요청에 실패하여 잠시후 다시 시도합니다. (${retryCount + 1})`)

      // 지수 백오프
      const retryDelay = RETRY_DELAYS[retryCount]
      await delay(retryDelay)

      // 재시도
      return executeTaskWithRetry(task, retryCount + 1)
    } else {
      log.error('[', task.key, ']', '재시도 횟수가 초과되어 종료됩니다:', error)
      throw error
    }
  }
}
