import { Injectable } from '@nestjs/common'

/** A badge unlocked by a trigger: `code` is the achievement id (decimal string). */
export interface UnlockedBadge {
  code: string
  name: string
}

/** Runs after a Kotak Misteri opening has committed; answers the badges it unlocked. Must not throw. */
export type BoxOpenedHook = (userId: string) => Promise<readonly UnlockedBadge[]>

/**
 * What the shop calls but the gamification module implements. `GamificationModule` imports `ShopModule` (the reward
 * settings), so the shop cannot import gamification back: gamification binds the hook from its `onModuleInit`
 * (the pattern of `AuthPorts` and `AccountPorts`). Until it is bound the shop answers "nothing unlocked".
 */
@Injectable()
export class ShopPorts {
  private boxOpened: BoxOpenedHook | null = null

  provideBoxOpenedHook(hook: BoxOpenedHook): void {
    if (this.boxOpened !== null) throw new Error('ShopPorts: the box-opened hook is already provided')
    this.boxOpened = hook
  }

  async afterBoxOpened(userId: string): Promise<readonly UnlockedBadge[]> {
    return this.boxOpened === null ? [] : this.boxOpened(userId)
  }
}
