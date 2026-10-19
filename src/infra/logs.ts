import { pino } from 'pino'

export class Logger {
  private readonly log = pino({ timestamp: pino.stdTimeFunctions.isoTime, base: undefined })

  info(message: string, fields: Record<string, unknown> = {}) {
    this.log.info(fields, message)
  }

  error(message: string, err?: unknown) {
    if (err) this.log.error({ err }, message)
    else this.log.error(message)
  }

  debug(message: string, fields: Record<string, unknown> = {}) {
    this.log.debug(fields, message)
  }
}
