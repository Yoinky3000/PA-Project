import { Socket } from "socket.io-client";
import { BaseMessage } from "./data";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import styles from "./UIPanel.module.css";
import { ConnectMenu } from "./Menu/Connect";
import { ProfileMenu } from "./Menu/Profile";
import { ChatMenu } from "./Menu/Chat";
import { useVRM } from "../../vrm/VRMDisplayContext";

export function UIPanel() {
	const clientRef = useRef<Socket | null>(null);
	const [menu, setMenu] = useState<
		"Connect" | "Connecting" | "Profile" | "Chat"
	>("Connect");
	const [displayLoading, setDisplayLoading] = useState(false);
	const [serverURL, setServerURL] = useState(`http://localhost:${import.meta.env.SVR_PORT ?? 20000}`);
	useEffect(() => {
		return () => {
			Disconnect();
		};
	}, []);
	const {vrm} = useVRM()
	function Disconnect() {
		if (clientRef.current) clientRef.current.disconnect();
		console.log("Running Disconnect");
		clientRef.current = null;
		setMenu("Connect");
		vrm.dispose()
	}
	function sendData(ev: string, data: BaseMessage) {
		if (!clientRef.current) throw Error("Client is not initialized");
		clientRef.current.emit(ev, data.model_dump());
	}

	return (
		<UIContext.Provider
			value={{
				clientRef,
				Disconnect,
				setMenu,
				sendData,
				serverURL,
				setServerURL,
				setDisplayLoading
			}}
		>
			<div className={styles.uiPanel}>
				<div className={styles.menuTitle}>
					<h1>
						{(menu == "Connect" || menu == "Connecting") &&
							"Connect"}
						{menu == "Profile" && "Profile Selector"}
						{menu == "Chat" && "Chat"}
					</h1>
				</div>
				<div className={styles.sBar} />
				<div className={styles.menuContent}>
					{(menu == "Connect" || menu == "Connecting") && (
						<ConnectMenu connecting={menu == "Connecting"} />
					)}
					{menu == "Profile" && <ProfileMenu />}
					{menu == "Chat" && <ChatMenu />}
				</div>
			</div>
			<div className={styles.loadingCover} style={{"opacity": displayLoading ? 1.0 : 0.0}} />
		</UIContext.Provider>
	);
}

type UIContextType = {
	clientRef: React.RefObject<Socket | null>;
	serverURL: string;
	setServerURL: React.Dispatch<React.SetStateAction<string>>;
	setMenu: React.Dispatch<
		React.SetStateAction<"Connect" | "Connecting" | "Profile" | "Chat">
	>;
	Disconnect: () => void;
	sendData: (ev: string, data: BaseMessage) => void;
	setDisplayLoading: React.Dispatch<React.SetStateAction<boolean>>;
};

export const UIContext = createContext<UIContextType | null>(null);

export function useUI() {
	const ctx = useContext(UIContext);
	if (!ctx) throw new Error("useUI must be used inside UIPanel");
	return ctx;
}
