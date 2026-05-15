const channel = new BroadcastChannel('debugger')
export const sendToDebugger = (type: string, payload?: string, blob?: Blob, condition = true) => {
  if (condition) {
    channel.postMessage({ blob, payload, timestamp: Date.now(), type })
  }
}
