import styles from "./Minimap.module.css"
import { Html, Hud, OrthographicCamera } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { getPlayerEntity } from "../../Scripts/Script/Model/modelUtils"
import useGlobalStore from "../../../store"
import { useRef } from "react"

const Minimap = () => {
  const walkmeshController = useGlobalStore(state => state.walkmeshController);
  const mapRef = useRef<HTMLDivElement>(null);
  useFrame(({scene}) => {
    if (!walkmeshController) {
      return;
    }
    const player = getPlayerEntity(scene)
    if (!player) {
      return;
    }
    const uv = walkmeshController.getPlayerUV(player.userData.movementController.getPosition());
    mapRef.current?.style.setProperty('--u', Math.round(uv.u * 100).toString());
    mapRef.current?.style.setProperty('--v', Math.round(uv.v * 100).toString());
    mapRef.current?.style.setProperty('--r', `${player.userData.rotationController.getState().angle.currentValue}`);
  });
  return (
    <Hud
      renderPriority={10}
    >
      <Html fullscreen>
        <div className={styles.container}>
          <div className={styles.minimap} ref={mapRef}>
            <div className={styles.playerIndicator} />
            <div className={styles.directionIndicator} />
          </div>
        </div>
      </Html>
      <OrthographicCamera
        makeDefault
        position={[0, 0, 0]}
      />
      <ambientLight intensity={5} />
    </Hud>
  )
}

export default Minimap