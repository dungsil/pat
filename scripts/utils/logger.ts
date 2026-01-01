import { env } from 'node:process' 
import { createConsola, LogLevels } from 'consola'

export const log = createConsola({
  fancy: true,
  formatOptions: {
    colors: true,
  },
  level: env.LOG_LEVEL ?? LogLevels.info,
})
