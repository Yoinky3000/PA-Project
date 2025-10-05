import { createContext, useContext } from "react";
import { VRMInstance } from "./VRMInstance";
import Stats from "three/examples/jsm/libs/stats.module";

type VRMContextType = {
	statusMessage: string;
	showContainer: boolean;
	handleResetCamera: () => void;
	vrm: VRMInstance,
	stats: Stats
};

export const VRMContext = createContext<VRMContextType | null>(null);

export function useVRM() {
	const ctx = useContext(VRMContext);
	if (!ctx) throw new Error("useVRM must be used inside VRMProvider");
	return ctx;
}
