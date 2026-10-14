import { MapName } from '../initialiseFromUrl'

export const MOUNT_FLAGS = ['hasIntroTransition', 'shouldSyncTitle', 'shouldSyncUrl'] as const

export type MountFlag = (typeof MOUNT_FLAGS)[number]

export type MountProps = Record<MountFlag, boolean> & {
  startField: MapName | undefined
}

export const readMountProps = (search: string): MountProps => {
  const params = new URLSearchParams(search)
  return {
    hasIntroTransition: params.has('hasIntroTransition'),
    shouldSyncTitle: params.has('shouldSyncTitle'),
    shouldSyncUrl: params.has('shouldSyncUrl'),
    startField: (params.get('startField') as MapName | null) ?? undefined,
  }
}

const buildMountSearch = (props: MountProps) => {
  const params = new URLSearchParams()
  MOUNT_FLAGS.filter((flag) => props[flag]).forEach((flag) => params.set(flag, ''))
  if (props.startField) {
    params.set('startField', props.startField)
  }
  return params.toString()
}

export const reloadWithMountProps = (props: MountProps) => {
  window.location.search = buildMountSearch(props)
}
