import useChocoboDismount from './useChocoboDismount'
import useChocoboRunOff from './useChocoboRunOff'
import useCompanionTrail from './useCompanionTrail'

const ChocoboRider = () => {
  useChocoboRunOff()
  useChocoboDismount()
  useCompanionTrail()

  return null
}

export default ChocoboRider
