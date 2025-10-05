import VRMDisplay from "../vrm/VRMDisplay";
import { DevPanel } from "./Panels/DevPanel";
import { UIPanel } from "./Panels/UIPanel";

export default function App() {
	const devMode = true
	return (
		<>
			<VRMDisplay>
				{devMode && <DevPanel /> }
				<UIPanel />
			</VRMDisplay>
		</>
	);
}
