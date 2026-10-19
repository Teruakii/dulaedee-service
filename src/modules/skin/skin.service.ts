import { ObjectId } from 'mongodb'
import type { SkinSlot } from '../daylog/daylog.model.js'
import { findClashes, findSlotWarnings, type Clash, type SlotWarning } from './clash.js'
import type { UpsertProductRequest } from './skin.dto.js'
import { toProductResponse, type SkinProductResponse } from './skin.model.js'
import { ErrProductNotFound, parseID, type SkinProductRepo } from './skin.repo.js'

export type RoutineResponse = { slot: SkinSlot; products: SkinProductResponse[]; clashes: Clash[]; warnings: SlotWarning[] }

export class SkinService {
  constructor(private readonly products: SkinProductRepo) {}

  async listProducts(userID: string): Promise<SkinProductResponse[]> {
    return (await this.products.list(new ObjectId(userID))).map(toProductResponse)
  }

  async routine(userID: string, slot: SkinSlot): Promise<RoutineResponse> {
    const products = (await this.products.inSlot(new ObjectId(userID), slot)).map(toProductResponse)
    return { slot, products, clashes: findClashes(products), warnings: findSlotWarnings(products, slot) }
  }

  async createProduct(userID: string, req: UpsertProductRequest): Promise<SkinProductResponse> {
    return toProductResponse(await this.products.insert(new ObjectId(userID), req))
  }

  async updateProduct(userID: string, id: string, req: UpsertProductRequest): Promise<SkinProductResponse> {
    return toProductResponse(await this.products.update(new ObjectId(userID), parseID(id, ErrProductNotFound), req))
  }

  deleteProduct(userID: string, id: string): Promise<void> {
    return this.products.delete(new ObjectId(userID), parseID(id, ErrProductNotFound))
  }

  async reorder(userID: string, slot: SkinSlot, productIds: string[]): Promise<RoutineResponse> {
    await this.products.reorder(
      new ObjectId(userID),
      slot,
      productIds.map((id) => parseID(id, ErrProductNotFound)),
    )
    return this.routine(userID, slot)
  }
}
