import {
  AnimationClip,
  NumberKeyframeTrack,
  Object3D,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
} from 'three'

const extractNamesFromTrack = (trackName: string): [string, string] => {
  const propertyIndex = trackName.lastIndexOf('.')
  const objectName = trackName.substring(0, propertyIndex)
  const propertyName = trackName.substring(propertyIndex + 1)
  return [objectName, propertyName]
}

export const applyAnimationAtTime = (mesh: Object3D, clip: AnimationClip, time: number): void => {
  clip.tracks.forEach((track) => {
    const trackName = track.name
    const [objectName, propertyName] = extractNamesFromTrack(trackName)
    const object = mesh.getObjectByName(objectName)
    if (object) {
      applyTrackToObjectAtTime(track, object, propertyName, time)
    }
  })

  mesh.updateMatrix()
  mesh.updateMatrixWorld(true)
}

const applyTrackToObjectAtTime = (
  track: NumberKeyframeTrack | QuaternionKeyframeTrack | VectorKeyframeTrack,
  object: Object3D,
  propertyName: string,
  time: number,
): void => {
  const stride = track.getValueSize()
  const times = track.times
  const values = track.values

  if (times.length === 0) {
    return
  }

  const clampedTime = Math.min(Math.max(0, time), times[times.length - 1])

  if (clampedTime <= times[0]) {
    applyValuesAtIndex(track, object, propertyName, values, 0, stride)
    return
  }

  if (clampedTime >= times[times.length - 1]) {
    const lastIndex = (times.length - 1) * stride
    applyValuesAtIndex(track, object, propertyName, values, lastIndex, stride)
    return
  }

  let leftIndex = 0
  let rightIndex = 1

  for (let i = 0; i < times.length - 1; i++) {
    if (clampedTime <= times[i + 1]) {
      leftIndex = i
      rightIndex = i + 1
      break
    }
  }

  if (clampedTime === times[leftIndex]) {
    const valueIndex = leftIndex * stride
    applyValuesAtIndex(track, object, propertyName, values, valueIndex, stride)
  } else if (clampedTime === times[rightIndex]) {
    const valueIndex = rightIndex * stride
    applyValuesAtIndex(track, object, propertyName, values, valueIndex, stride)
  } else {
    const t = (clampedTime - times[leftIndex]) / (times[rightIndex] - times[leftIndex])
    interpolateAndApply(track, object, propertyName, values, leftIndex, rightIndex, t, stride)
  }
}

const applyValuesAtIndex = (
  track: NumberKeyframeTrack | QuaternionKeyframeTrack | VectorKeyframeTrack,
  object: Object3D,
  propertyName: string,
  values: Float32Array,
  index: number,
  stride: number,
): void => {
  if (track instanceof QuaternionKeyframeTrack) {
    const quaternionValues = Array.from(values.slice(index, index + 4))
    const [x, y, z, w] = quaternionValues
    object.quaternion.set(x, y, z, w)
  } else if (track instanceof VectorKeyframeTrack) {
    const value = Array.from(values.slice(index, index + stride))

    if (stride === 3) {
      const [x, y, z] = value
      const targetProperty = (object as any)[propertyName] as Vector3
      if (targetProperty && targetProperty.isVector3) {
        targetProperty.set(x, y, z)
      }
    } else if (stride === 2) {
      const [x, y] = value
      const targetProperty = (object as any)[propertyName]
      if (targetProperty && targetProperty.set) {
        targetProperty.set(x, y)
      }
    }
  } else if (track instanceof NumberKeyframeTrack) {
    const value = values[index]
    ;(object as any)[propertyName] = value
  }
}

const interpolateAndApply = (
  track: NumberKeyframeTrack | QuaternionKeyframeTrack | VectorKeyframeTrack,
  object: Object3D,
  propertyName: string,
  values: Float32Array,
  leftIndex: number,
  rightIndex: number,
  t: number,
  stride: number,
): void => {
  const leftValueIndex = leftIndex * stride
  const rightValueIndex = rightIndex * stride

  if (track instanceof QuaternionKeyframeTrack) {
    const leftQuat = new Quaternion().fromArray(values, leftValueIndex)
    const rightQuat = new Quaternion().fromArray(values, rightValueIndex)
    const result = new Quaternion().slerpQuaternions(leftQuat, rightQuat, t)
    object.quaternion.copy(result)
  } else if (track instanceof VectorKeyframeTrack) {
    const leftValues = Array.from(values.slice(leftValueIndex, leftValueIndex + stride))
    const rightValues = Array.from(values.slice(rightValueIndex, rightValueIndex + stride))

    const interpolated = leftValues.map((val, i) => val * (1 - t) + rightValues[i] * t)

    if (stride === 3) {
      const [x, y, z] = interpolated
      const targetProperty = (object as any)[propertyName] as Vector3
      if (targetProperty && targetProperty.isVector3) {
        targetProperty.set(x, y, z)
      }
    } else if (stride === 2) {
      const [x, y] = interpolated
      const targetProperty = (object as any)[propertyName]
      if (targetProperty && targetProperty.set) {
        targetProperty.set(x, y)
      }
    }
  } else if (track instanceof NumberKeyframeTrack) {
    const leftValue = values[leftValueIndex]
    const rightValue = values[rightValueIndex]
    const interpolated = leftValue * (1 - t) + rightValue * t
    ;(object as any)[propertyName] = interpolated
  }
}
