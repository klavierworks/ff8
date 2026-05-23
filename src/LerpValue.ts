import { framesToMs } from './timing'

export type EasingFunction = (t: number) => number

export const cosineEaseInOut: EasingFunction = (t) => (1 - Math.cos(Math.PI * t)) / 2

class LerpValue {
  public isAnimating: boolean = false
  private animationId: null | number = null
  private currentValue: number
  private duration: number
  private easing: EasingFunction | undefined
  private isLooping: boolean = false
  private pendingResolve: (() => void) | null = null
  private speedMultiplier: number = 1.0
  private startTime: number
  private startValue: number

  private targetValue: number

  constructor(initialValue: number = 0, speedMultiplier: number = 1.0, easing?: EasingFunction) {
    this.currentValue = initialValue
    this.targetValue = initialValue
    this.startValue = initialValue
    this.duration = 0
    this.startTime = 0
    this.speedMultiplier = speedMultiplier
    this.easing = easing
  }

  calculateDuration(speed: number): number {
    return framesToMs(speed) * this.speedMultiplier
  }

  get(): number {
    return this.currentValue
  }

  set(value: number): void {
    this.stop()
    this.currentValue = value
    this.targetValue = value
    this.startValue = value
  }

  start(targetValue: number, duration: number, delay: number = 0, isLooping: boolean = false): Promise<void> {
    return new Promise((resolve) => {
      // stop() settles any previously-pending Promise (so an interrupted
      // turn/lerp resolves rather than leaking forever), then we install
      // ours as the new pending resolver.
      this.stop()
      this.pendingResolve = resolve

      const settle = () => {
        const pending = this.pendingResolve
        this.pendingResolve = null
        pending?.()
      }

      this.startValue = this.currentValue
      this.targetValue = targetValue
      this.duration = duration
      this.isAnimating = true
      this.isLooping = isLooping

      const startAnimation = () => {
        if (this.duration <= 0) {
          this.currentValue = this.targetValue
          this.isAnimating = false

          if (this.isLooping) {
            this.start(this.targetValue, this.duration, 0, true)
          }
          settle()
          return
        }

        this.startTime = performance.now()

        const animate = (currentTime: number) => {
          const elapsed = currentTime - this.startTime
          const linearProgress = Math.min(elapsed / this.duration, 1)
          const progress = this.easing ? this.easing(linearProgress) : linearProgress

          this.currentValue = this.startValue + (this.targetValue - this.startValue) * progress

          if (progress < 1) {
            this.animationId = requestAnimationFrame(animate)
          } else {
            this.currentValue = this.targetValue

            if (this.isLooping) {
              const temp = this.startValue
              this.startValue = this.targetValue
              this.targetValue = temp
              this.startTime = performance.now()
              this.animationId = requestAnimationFrame(animate)
            } else {
              this.isAnimating = false
              this.animationId = null
              settle()
            }
          }
        }

        this.animationId = requestAnimationFrame(animate)
      }

      if (delay > 0) {
        setTimeout(startAnimation, delay)
      } else {
        startAnimation()
      }
    })
  }

  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    this.isAnimating = false
    const pending = this.pendingResolve
    this.pendingResolve = null
    pending?.()
  }
}

export default LerpValue
