/**
 * Retries a function that returns a promise.
 * @param {Function} fn - The function to retry.
 * @param {number} retries - Number of retries.
 * @param {number} delay - Delay in ms.
 * @returns {Promise<any>}
 */
module.exports = async function retry(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      // Retry on 5xx errors or rate limits (403/429)
      if (error.status >= 500 || error.status === 429 || error.status === 403) {
        console.log(`[Retry] Request failed with status ${error.status}. Retrying in ${delay}ms... (Remaining: ${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return retry(fn, retries - 1, delay * 2); // Exponential backoff
      }
    }
    throw error;
  }
};
