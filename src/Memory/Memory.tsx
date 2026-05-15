import { useEffect, useState } from 'react'

import { MEMORY } from '../Field/Scripts/Script/handlers'

const Memory = () => {
  const [memory, setMemory] = useState<Record<number, number>>({})
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setMemory({ ...MEMORY })
    }, 200)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="memory" onClick={() => setIsExpanded(!isExpanded)}>
      {isExpanded ? (
        Object.entries(memory).map(([address, value]) => (
          <div key={address}>
            {address}: {value}
          </div>
        ))
      ) : (
        <>
          <button>View all memory</button>
          {Object.entries(memory)
            .slice(0, 5)
            .map(([address, value]) => (
              <div key={address}>
                {address}: {value}
              </div>
            ))}
          <div>...</div>
        </>
      )}
    </div>
  )
}

export default Memory
