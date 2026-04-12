import useGlobalStore from "../../../store";
import { Scene } from "three";
import createScriptController from "./ScriptController/ScriptController";
import { getPartyMemberModelComponent } from "./Model/modelUtils";
import { ScriptMethod } from "../types";
import { MEMORY } from "./handlers";

export const dummiedCommand = () => { }

export const unusedCommand = () => { }

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const remoteExecute = async (scriptLabel: number, priority = 10, isGuaranteed = false) => new Promise<void>((resolve) => {
  const key = Math.random().toString(36).substring(7);

  const handler = ({ detail }: { detail: { key: string }}) => {
    if (detail.key !== key) {
      return;
    }
    document.removeEventListener('scriptFinished', handler);
    resolve();
  }

  document.addEventListener('scriptFinished', handler);

  document.dispatchEvent(new CustomEvent('executeScript', {
    detail: {
      key,
      scriptLabel,
      priority,
      isGuaranteed,
    } as ExecuteScriptEventDetail
  }));
});

export const remoteExecutePartyMember = async (scene: Scene, partyMemberIndex: number, scriptLabel: number, priority = 10, isGuaranteed = false) => {
  const actor = getPartyMemberModelComponent(scene, partyMemberIndex);
  if (!actor) {
    console.warn(`Party member index ${partyMemberIndex} not found`);
    return;
  }
  
  const scriptController = actor.userData.scriptController as ReturnType<typeof createScriptController>;

  if (!scriptController) {
    console.warn(`Script controller not found for party member ${partyMemberIndex}`);
    return;
  }
  console.log(`Executing script ${scriptLabel} on party member ${partyMemberIndex} ${partyMemberIndex}`);
  await scriptController.triggerMethodByIndex(scriptLabel, priority, isGuaranteed);
  console.log(`Finished script ${scriptLabel} on party member ${partyMemberIndex} ${partyMemberIndex}`);
}

export const openMessage = (id: string, text: string[], placement: MessagePlacement, isCloseable = true, askOptions?: AskOptions | undefined) => new Promise<number>((resolve) => {
  const { currentMessages } = useGlobalStore.getState();

  document.addEventListener('messageClosed', ({ detail }) => {
    if (detail.id !== id) {
      return;
    }

    resolve(detail.selectedOption);
  });
  useGlobalStore.setState({
    currentMessages: [
      ...currentMessages,
      {
        id,
        text,
        placement,
        isCloseable,
        askOptions,
      }
    ]
  });
})

export const closeMessage = (id: string, selectedOptionIndex?: number) => {
  useGlobalStore.setState(state => {
    const currentMessages = state.currentMessages.filter(message => message.id !== id);
    return {
      ...state,
      currentMessages
    };
  });

  document.dispatchEvent(new CustomEvent('messageClosed', {
    detail: {
      id,
      selectedOption: selectedOptionIndex,
    }
  }));
}

export const enableMessageToClose = (id: string) => {
  useGlobalStore.setState(state => {
    const currentMessages = state.currentMessages.map(message => {
      if (message.id === id) {
        return {
          ...message,
          isCloseable: true
        };
      }
      return message;
    });
    return {
      ...state,
      currentMessages
    };
  });
}


export const convert256ToRadians = (value: number) => (value % 256 / 256) * 2 * Math.PI;

export const isValidActionableMethod = (method?: ScriptMethod) => {
  if (!method) {
    return false;
  }
  return method.opcodes.filter(opcode => !opcode.name.startsWith('LABEL') && opcode.name !== 'LBL' && opcode.name !== 'RET' && opcode.name !== 'HALT').length > 0;
}
