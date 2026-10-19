import { ObjectId } from 'mongodb'
import type { CreateMyFoodRequest, ListFoodsQuery, RecommendQuery, UpsertFoodRequest } from './food.dto.js'
import { toResponse, type Food, type FoodResponse, type FoodTag } from './food.model.js'
import { parseFoodID, type FoodRepo } from './food.repo.js'
import { MIN_MEAL_SHARE, rankMenus } from './recommend.js'
import { SEED_FOODS } from './food.seed.js'

export class FoodService {
  constructor(private readonly repo: FoodRepo) {}

  seed(): Promise<number> {
    return this.repo.seedIfEmpty(SEED_FOODS)
  }

  async names(): Promise<{ id: string; nameTh: string; tags: FoodTag[] }[]> {
    return (await this.repo.names()).map((f) => ({ id: f._id.toHexString(), nameTh: f.nameTh, tags: f.tags }))
  }

  async list(q: ListFoodsQuery, viewer: string): Promise<{ rows: FoodResponse[]; hasMore: boolean }> {
    const { rows, hasMore } = await this.repo.list(q, new ObjectId(viewer))
    return { rows: rows.map(toResponse), hasMore }
  }

  async recommend(q: RecommendQuery, viewer: string): Promise<FoodResponse[]> {
    const candidates = await this.repo.inKcalRange(Math.ceil(q.remainingKcal * MIN_MEAL_SHARE), q.remainingKcal, new ObjectId(viewer))
    return rankMenus(candidates, q.remainingKcal, q.proteinGapG, q.limit).map(toResponse)
  }

  async get(id: string, viewer: string): Promise<FoodResponse> {
    return toResponse(await this.repo.getVisible(parseFoodID(id), new ObjectId(viewer)))
  }

  // ให้ daylog ดึงสารอาหารไป snapshot ตอนบันทึก
  getRaw(id: string, viewer: string): Promise<Food> {
    return this.repo.getVisible(parseFoodID(id), new ObjectId(viewer))
  }

  async create(req: UpsertFoodRequest): Promise<FoodResponse> {
    return toResponse(await this.repo.insert(req))
  }

  async createMine(req: CreateMyFoodRequest, owner: string): Promise<FoodResponse> {
    return toResponse(await this.repo.insertOwned(req, new ObjectId(owner)))
  }

  deleteMine(id: string, owner: string): Promise<void> {
    return this.repo.deleteOwned(parseFoodID(id), new ObjectId(owner))
  }

  async update(id: string, req: UpsertFoodRequest): Promise<FoodResponse> {
    return toResponse(await this.repo.update(parseFoodID(id), req))
  }

  delete(id: string): Promise<void> {
    return this.repo.delete(parseFoodID(id))
  }
}
