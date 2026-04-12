import { useEffect, useRef } from "react"
import useGlobalStore from "./store";
import FieldLoader from "./Field/Field";
import { attachKeyDownListeners } from "./Field/Scripts/Script/common";
import { getInitialField } from "./utils";
import MAP_NAMES from "./constants/maps";
import { useFrame, useThree } from "@react-three/fiber";
import { Scene } from "three";


useGlobalStore.setState({
  pendingFieldId: (getInitialField() ?? 'menu') as typeof MAP_NAMES[number], 
});

type EntrypointProps = {
  setWorldScene: (scene: Scene) => void;
}
const Entrypoint = ({ setWorldScene }: EntrypointProps) => {
  useEffect(() => {
    attachKeyDownListeners();
  }, []);

  const fadeSpring = useGlobalStore(state => state.fadeSpring);

  const currentStyleRef = useRef<number>(0);
  useFrame(() => {
    const isMapFadeEnabled = useGlobalStore.getState().isMapFadeEnabled;
    if (!isMapFadeEnabled) {
      return;
    }
    const currentStyle = fadeSpring.get();
    if (currentStyleRef.current === currentStyle) {
      return;
    }
    currentStyleRef.current = currentStyle;
    document.body.style.setProperty('--canvas-opacity', currentStyle.toString());
  })

  const scene = useThree(state => state.scene);
  useEffect(() => {
    setWorldScene(scene);
  }, [scene, setWorldScene])

  return (
    <>
      <FieldLoader />
    </>
  )
}

export default Entrypoint;