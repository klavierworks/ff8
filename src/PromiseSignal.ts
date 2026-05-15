class PromiseSignal {
  promise: Promise<void>
  reject: (reason?: PromiseRejectedResult) => void
  resolve: () => void

  constructor() {
    this.resolve = () => {}
    this.reject = () => {}

    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
  }
}

export default PromiseSignal
