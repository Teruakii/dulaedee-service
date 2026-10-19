import { ObjectId } from 'mongodb'
import type { ListClipsQuery, RecommendClipsQuery, UpsertClipRequest } from './clip.dto.js'
import { toResponse, type Clip, type ClipResponse } from './clip.model.js'
import { parseClipID, type ClipRepo } from './clip.repo.js'

// เรียงคลิปตามลำดับเมนูที่แนะนำ (เมนูอันดับ 1 มาก่อน)
export function orderByFoods(clips: Clip[], foodIds: string[]): Clip[] {
  const rank = (c: Clip) => {
    const ids = c.foodIds.map((f) => f.toHexString())
    const i = foodIds.findIndex((f) => ids.includes(f))
    return i === -1 ? foodIds.length : i
  }
  return [...clips].sort((a, b) => rank(a) - rank(b))
}

export class ClipService {
  constructor(private readonly repo: ClipRepo) {}

  async list(q: ListClipsQuery): Promise<{ rows: ClipResponse[]; hasMore: boolean }> {
    const { rows, hasMore } = await this.repo.list(q)
    return { rows: rows.map(toResponse), hasMore }
  }

  // คลิปของเมนูที่แนะนำก่อน ไม่พอค่อยเติมด้วยคลิปล่าสุด
  async recommend(q: RecommendClipsQuery): Promise<ClipResponse[]> {
    const matched = q.foodIds.length
      ? orderByFoods(await this.repo.forFoods(q.foodIds.map((f) => new ObjectId(f)), q.limit), q.foodIds).slice(0, q.limit)
      : []
    const filler =
      matched.length < q.limit
        ? await this.repo.latest(
            matched.map((c) => c._id),
            q.limit - matched.length,
          )
        : []
    return [...matched, ...filler].map(toResponse)
  }

  async create(req: UpsertClipRequest): Promise<ClipResponse> {
    return toResponse(await this.repo.insert(req))
  }

  async update(id: string, req: UpsertClipRequest): Promise<ClipResponse> {
    return toResponse(await this.repo.update(parseClipID(id), req))
  }

  delete(id: string): Promise<void> {
    return this.repo.delete(parseClipID(id))
  }
}
