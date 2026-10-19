import { ObjectId } from 'mongodb'
import type { ActivityInput } from './workout.dto.js'
import type { PlanItem, PlanResponse } from './workout.model.js'
import type { PlanRepo } from './workout.repo.js'

export class WorkoutService {
  constructor(private readonly plans: PlanRepo) {}

  async plan(userID: string): Promise<PlanResponse> {
    return toResponse(await this.plans.days(new ObjectId(userID)))
  }

  async setDay(userID: string, weekday: number, items: ActivityInput[]): Promise<PlanResponse> {
    const planItems: PlanItem[] = items.map((i) => ({ id: new ObjectId(), ...i }))
    return toResponse(await this.plans.setDay(new ObjectId(userID), weekday, planItems))
  }
}

const toResponse = (days: PlanItem[][]): PlanResponse => ({ days: days.map((items) => items.map(({ id, ...rest }) => ({ id: id.toHexString(), ...rest }))) })
