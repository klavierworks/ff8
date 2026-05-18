import { useEffect } from 'react'

import MAP_NAMES from '../../constants/maps'
import { loadGame } from '../field/fieldUtils'
import { MEMORY } from '../field/Scripts/Script/handlers'
import { openMessage } from '../field/Scripts/Script/utils'
import { offlineController } from '../../OfflineController'
import useGlobalStore from '../../store'
import { CHAPTERS } from './CHAPTERS'

const closeAllWindows = () => {
  useGlobalStore.setState({
    currentMessages: [],
  })
}

const hasSavedData = !!window.localStorage.getItem('saveData')

const fieldSelect = async (set = 0) => {
  const options = Object.keys(CHAPTERS).slice(set * 8, set * 8 + 8)
  const isFirstPage = set === 0

  openMessage(
    'warning',
    [`{YellowBlink}Jump points are a\ncrude form of navigation\nand may not work\nas expected.{Grey}`],
    { channel: 0, height: undefined, width: undefined, x: 320, y: 0 },
    false,
  )
  const selectedOption = await openMessage(
    'fieldSelect',
    [`Field Select\n${options.join('\n')}\n{Blue}${isFirstPage ? 'Next Page' : 'Previous Page'}{White}\nCancel`],
    { channel: 1, height: undefined, width: undefined, x: 0, y: 15 },
    true,
    {
      blocked: undefined,
      cancel: Object.keys(CHAPTERS).length - 1,
      default: 1,
      first: 1,
      last: undefined,
    },
  )

  if (selectedOption === options.length + 1) {
    mainMenuSelect(3)
    return
  }

  if (selectedOption === options.length) {
    closeAllWindows()
    fieldSelect(isFirstPage ? 1 : 0)
    return
  }

  const selection = Object.values(CHAPTERS)[selectedOption + set * 8]
  if (!selection) {
    mainMenuSelect(3)
    return
  }

  useGlobalStore.setState((state) => ({
    fieldId: undefined,
    module: 'field',
    // @ts-expect-error Not sepecified in all chapters
    party: selection.party ?? state.party,
    pendingFieldId: selection.fieldId! as (typeof MAP_NAMES)[number],
  }))

  MEMORY[256] = selection.progress
}

const optionsSelect = async () => {
  openMessage(
    'optionsTitle',
    ['Options'],
    { channel: 0, height: undefined, width: undefined, x: 0, y: 0 },
    false,
    undefined,
  )
  const { isEnablingOffline, isOfflineEnabled } = offlineController.getState()
  console.log('isOfflineEnabled', isOfflineEnabled, 'isEnablingOffline', isEnablingOffline)

  let offlineOptionMessage = `{Green}Enable Offline (2GB){White}`
  if (isEnablingOffline) {
    offlineOptionMessage = `{YellowBlink}Enabling offline{White}`
  }
  if (isOfflineEnabled) {
    offlineOptionMessage = `{Red}Disable offline{White}`
  }

  const optionsOption = await openMessage(
    'options',
    [`Controls\n${offlineOptionMessage}\nBack`],
    { channel: 1, height: undefined, width: undefined, x: 100, y: 80 },
    true,
    {
      blocked: undefined,
      cancel: 2,
      default: 0,
      first: 0,
      last: undefined,
    },
  )

  if (optionsOption === 0) {
    await openMessage(
      'controls',
      [
        `Controls
      {Yellow}Move{White} - [Arrows]
      {Yellow}Confirm{White} - [Z]
      {Yellow}Cancel{White} - [X]
      {Yellow}Card/Run{White} - [A]
      {Yellow}Menu{White} - [S]

      {Yellow}Dev Mode{White} - [Esc]`,
      ],
      { channel: 1, height: undefined, width: undefined, x: 70, y: 50 },
      true,
      undefined,
    )
    closeAllWindows()
    optionsSelect()
  }

  if (optionsOption === 1) {
    if (isOfflineEnabled || isEnablingOffline) {
      await offlineController.disableOfflineMode()
    } else {
      await offlineController.enableOfflineMode()
    }
    closeAllWindows()
    mainMenuSelect()
  }
}

const mainMenuSelect = async (defaultValue = hasSavedData ? 1 : 0) => {
  const { fadeSpring } = useGlobalStore.getState()

  const hasMouse = matchMedia('(pointer:fine)').matches

  openMessage('welcome', ['Welcome'], { channel: 0, height: undefined, width: undefined, x: 0, y: 0 }, false, undefined)
  if (hasMouse) {
    await openMessage(
      'controls',
      [
        `Controls
      {Yellow}Move{White} - [Arrows]
      {Yellow}Confirm{White} - [Z]
      {Yellow}Cancel{White} - [X]
      {Yellow}Card/Run{White} - [A]
      {Yellow}Menu{White} - [S]

      {Yellow}Dev Mode{White} - [Esc]  
       `,
      ],
      { channel: 1, height: undefined, width: undefined, x: 220, y: 50 },
      true,
      undefined,
    )
  }

  const option = await openMessage(
    'menu',
    [`New Game\n${hasSavedData ? '' : '{Grey}'}Resume Game{White}\nJump Points\nOptions`],
    { channel: 1, height: undefined, width: undefined, x: 100, y: 80 },
    true,
    {
      blocked: hasSavedData ? [] : [1],
      cancel: undefined,
      default: defaultValue,
      first: 0,
      last: undefined,
    },
  )

  closeAllWindows()

  if (option === 0) {
    await fadeSpring.start(0, 500)
    closeAllWindows()
    useGlobalStore.getState().systemSfxController.play(37, 0, 127, 128)
    useGlobalStore.setState({
      module: 'field',
      pendingFieldId: 'start0',
    })
    return
  }

  if (option === 1) {
    await fadeSpring.start(0, 500)
    closeAllWindows()
    loadGame()
    useGlobalStore.getState().systemSfxController.play(37, 0, 127, 128)

    return
  }

  if (option === 2) {
    fieldSelect()
    return
  }

  if (option === 3) {
    await optionsSelect()
    mainMenuSelect(0)
  }
}
const Menu = () => {
  useEffect(() => {
    mainMenuSelect()
  }, [])

  return null
}

export default Menu
