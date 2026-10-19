import type { Request, Response } from 'express'
import { ZodError } from 'zod'
import { Logger } from '../logs.js'

const log = new Logger()

export type PayloadField = { field: string; msg: string }

type AppResponse = { code: number; message: string; payload?: PayloadField[] }

function respond(res: Response, status: number, message: string, payload?: PayloadField[]) {
  const body: AppResponse = { code: status, message }
  if (payload?.length) body.payload = payload
  res.status(status).json(body)
}

const errPayload = (err?: unknown): PayloadField[] =>
  err instanceof Error ? [{ field: 'body', msg: err.message }] : []

export const badRequest = (res: Response, msg: string, err?: unknown) => respond(res, 400, msg, errPayload(err))
export const invalidRequest = (res: Response, msg: string, payload: PayloadField[]) => respond(res, 400, msg, payload)
export const unauthorized = (res: Response, msg: string) => respond(res, 401, msg)
export const forbidden = (res: Response, msg: string) => respond(res, 403, msg)
export const notFound = (res: Response, msg: string) => respond(res, 404, msg)
export const serviceUnavailable = (res: Response, msg: string) => respond(res, 503, msg)
// ไม่ส่งข้อความ error ภายในกลับไป อาจมีชื่อ collection, path หรือ query ติดไปด้วย · เก็บรายละเอียดไว้ใน log แทน
export const internalError = (res: Response, err: unknown) => {
  log.error('INTERNAL_SERVER_ERROR', err)
  respond(res, 500, 'INTERNAL_SERVER_ERROR')
}

export const ok = (res: Response, data: unknown) => res.status(200).json({ data })

// hasMore แทน COUNT เพื่อไม่ต้องนับทั้ง collection
export const okPaginated = (res: Response, data: unknown, page: number, limit: number, hasMore: boolean) =>
  res.status(200).json({ data, pagination: { page, limit, hasMore } })

export const created = (res: Response, message: string, data: unknown) =>
  res.status(201).json({ code: 201, message, data })

export const success = (res: Response, message: string) => res.status(200).json({ code: 200, message })

// ตาราง sentinel → status ของแต่ละ module · error อื่นเป็น 500 · zod เป็น 400 พร้อม field
export type ErrTable = ReadonlyMap<Error, 400 | 401 | 403 | 404 | 409 | 503>

// ห่อ handler async ให้ error ทุกตัววิ่งผ่าน writeErr ของ module นั้น
export const errorBoundary =
  (writeErr: (res: Response, err: unknown) => void) =>
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  async (req: Request, res: Response) => {
    try {
      await fn(req, res)
    } catch (err) {
      writeErr(res, err)
    }
  }

export const param = (req: Request, key: string) => String(req.params[key] ?? '')

export function writeMapped(res: Response, err: unknown, table: ErrTable) {
  if (err instanceof ZodError) {
    invalidRequest(res, 'INVALID_REQUEST', err.issues.map((i) => ({ field: i.path.join('.') || 'body', msg: i.message })))
    return
  }
  const status = err instanceof Error ? table.get(err) : undefined
  if (status) respond(res, status, (err as Error).message)
  else internalError(res, err)
}
