import { useEffect, useState } from 'react'

const Queues = () => {
  const [queues, setQueues] = useState<Record<number, string>>({})
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      if (!window.QUEUES) {
        return
      }
      setQueues({ ...window.QUEUES })
    }, 200)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="queues" onClick={() => setIsExpanded(!isExpanded)}>
      {isExpanded ? (
        Object.entries(queues).map(([id, queue]) => (
          <div key={id}>
            {id}: {queue}
          </div>
        ))
      ) : (
        <>
          <button>View all script queues</button>
          {Object.entries(queues)
            .slice(0, 5)
            .map(([id, queue]) => (
              <div key={id}>
                {id}: {queue}
              </div>
            ))}
          <div>...</div>
        </>
      )}
    </div>
  )
}

export default Queues
