import { useUI } from "../UIPanel";
import { io } from "socket.io-client";
import { ClientDataMessage } from "../data";
import styles from "./Connect.module.css"

export function ConnectMenu({ connecting }: { connecting: boolean }) {
	const {
		Disconnect,
		setMenu,
		clientRef,
		sendData,
		serverURL,
		setServerURL,
	} = useUI();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!connecting && serverURL.trim()) {
			Connect(serverURL.trim());
		}
	};

	function Connect(serverURL: string) {
		if (clientRef.current) throw Error("Client is initialized already");
		clientRef.current = io(serverURL, {
			path: "/pa-server/socket.io",
			autoConnect: false,
		});
		const client = clientRef.current;
		console.log("Running Connect");
		setMenu("Connecting");
		client.on("connect", async () => {
			console.log("Connected");
			try {
				const promise = new Promise<{ continueChat: string } | null>(
					(res, rej) => {
						client.once("success", (data) => {
							client.removeAllListeners("err");
							client.removeAllListeners("replaceClientConfirm");
							res(data);
						});
						client.once("err", (data) => {
							client.removeAllListeners("success");
							client.removeAllListeners("replaceProfileConfirm");
							rej(data);
						});
						client.once("replaceClientConfirm", async () => {
							console.log("Client already existed");
							const replace = prompt(
								"Client already existed, Replace(Y/n)?"
							);
							if (replace == "Y" || replace == "") {
								sendData(
									"init",
									new ClientDataMessage({
										platform: "PC",
										confirm: true,
									})
								);
							} else {
								rej("Error: Client No Replace");
							}
						});
					}
				);
				sendData("init", new ClientDataMessage({ platform: "PC" }));
				await promise;
				setMenu("Profile");
			} catch (err) {
				console.log(err);
				client.disconnect();
			}
		});

		client.on("disconnect", (reason) => {
			console.log("Disconnected:", reason);
			Disconnect();
		});

		client.connect();
	}

	return (
		<div className={styles.connectMenu}>
			{connecting ? (
				<div className={styles.connecting}>
					<p>🔗 Connecting...</p>
					<button type="button" onClick={Disconnect} className={styles.connectButton}>
						Disconnect
					</button>
				</div>
			) : (
				<form onSubmit={handleSubmit} className={styles.connectForm}>
					<label htmlFor="sURL">Server URL</label>
					<input
						type="text"
						id="sURL"
						placeholder="Enter server URL..."
						value={serverURL}
						onChange={(e) => setServerURL(e.target.value)}
					/>
					<button type="submit" className={styles.connectButton}>Connect</button>
				</form>
			)}
		</div>
	);
}
