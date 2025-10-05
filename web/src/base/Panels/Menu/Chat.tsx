import { useRef, useState } from "react";
import styles from "./Chat.module.css";
import { useVRM } from "../../../vrm/VRMDisplayContext";
import { VRMInstance } from "../../../vrm/VRMInstance";
import { useUI } from "../UIPanel";
import { AddChatMessage } from "../data";

export function ChatMenu() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [playing, setPlaying] = useState(false);
	const { vrm } = useVRM();
	const { clientRef, setMenu, sendData } = useUI();
	const player = useRef(new StreamPlayer(messages, setMessages));

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {

		console.log(vrm.audio?.context)
		e.preventDefault();
		if (playing) return;
		setPlaying(true);

		if (!clientRef.current) {
			vrm.dispose();
			setMenu("Connect");
			throw Error("Client is not initialized");
		}
		const client = clientRef.current;

		const formData = new FormData(e.currentTarget);
		const msg = formData.get("msg")?.toString() || "";
		if (!msg.trim()) {
			setPlaying(false);
			return;
		}
		e.currentTarget.reset();

		console.log(`Send Message:`, msg);
		player.current.newMsg("USER");
		player.current.processStream(msg);
		await player.current.play();
		try {
			const promise = new Promise<void>((res, rej) => {
				client.once("success", () => {
					const interval = setInterval(() => {
						if (!player.current.handling) {
							clearInterval(interval);
							client.removeAllListeners("err");
							client.removeAllListeners("streamStart");
							client.removeAllListeners("streamDelta");
							client.removeAllListeners("streamEnd");
							res();
						}
					}, 1000);
				});
				client.once("err", (data) => {
					const interval = setInterval(() => {
						if (!player.current.handling) {
							clearInterval(interval);
							client.removeAllListeners("success");
							client.removeAllListeners("streamStart");
							client.removeAllListeners("streamDelta");
							client.removeAllListeners("streamEnd");
							rej(data);
						}
					}, 1000);
				});
				client.on("streamStart", () => {
					console.log("New PA Message Stream");
					player.current.newMsg("PA");
					function showErr(err: string) {
						console.log(`\n${err}`);
					}
					client.on(
						"streamDelta",
						async (delta: { txt: string; audio: ArrayBuffer }) => {
							console.log("Delta received", delta);
							player.current.processStream(
								delta.txt,
								delta.audio
							);
							if (!player.current.handling)
								await player.current.play(vrm);
						}
					);
					client.once("streamEnd", async () => {
						console.log("PA Message Stream End");
						client.removeAllListeners("streamDelta");
						client.removeAllListeners("err");
					});
					client.removeAllListeners("err");
					client.once("err", showErr);
				});
			});
			sendData(
				"addChat",
				new AddChatMessage({
					msg: { content: msg, role: "user", name: "me" },
				})
			);
			await promise;
		} catch (err) {
			console.log(err);
			return;
		} finally {
			setPlaying(false);
		}
	};

	const handleCloseProfile = (
		e: React.MouseEvent<HTMLButtonElement, MouseEvent>
	) => {
		e.preventDefault();
		if (playing) return;

		if (!clientRef.current) {
			vrm.dispose();
			setMenu("Connect");
			throw Error("Client is not initialized");
		}
		const client = clientRef.current;

		client.removeAllListeners("err");
		client.removeAllListeners("streamStart");
		client.removeAllListeners("streamDelta");
		client.removeAllListeners("streamEnd");
		client.emit("unload");
		vrm.dispose();
		setMenu("Profile");
	};

	return (
		<div className={styles.chatMenu}>
			<div className={styles.messages}>
				{messages.map((m, i) => (
					<div
						key={i}
						className={`${styles.message} ${
							m.author == "USER" ? styles.fromUSER : styles.fromPA
						}`}
					>
						{m.content}
					</div>
				))}
			</div>
			<div className={styles.sBar} />
			<form className={styles.messageForm} onSubmit={handleSubmit}>
				<label htmlFor="msg">Your message:</label>
				<textarea
					id="msg"
					name="msg"
					placeholder="Enter message..."
					className={styles.textarea}
					rows={3}
				/>
				<button
					type="submit"
					className={`${styles.sendButton} ${
						playing ? styles.sbDisabled : ""
					}`}
				>
					Send
				</button>
				<button
					onClick={handleCloseProfile}
					className={`${styles.closeProfileButton} ${
						playing ? styles.cpbDisabled : ""
					}`}
				>
					Close Profile
				</button>
			</form>
		</div>
	);
}

type Message = {
	content: string;
	id: number;
	author: "PA" | "USER";
};

type MessageQueue = {
	txt: string;
	audio: ArrayBuffer | undefined;
	id: number;
};

class StreamPlayer {
	currentID = 0;
	currentAuthor: "PA" | "USER" = "PA";
	queue: MessageQueue[] = [];
	handling = false;
	constructor(
		public messages: Message[],
		private setMessages: React.Dispatch<React.SetStateAction<Message[]>>
	) {
	}
	newMsg(author: "PA" | "USER") {
		this.currentID++;
		this.currentAuthor = author;
	}
	processStream(txt: string, audio?: ArrayBuffer) {
		this.queue.push({ txt, audio, id: Number(String(this.currentID)) });
	}
	async play(vrm?: VRMInstance) {
		if (this.handling) return;
		console.log("start flushing delta");
		this.handling = true;
		while (this.queue.length != 0) {
			const data = this.queue.shift();
			if (!data) break;

			console.log("Playing", data);

			this.setMessages((prev) => {
				if (prev.length > 0 && prev[0]!.id === data.id) {
					const updated = [...prev];
					// @ts-ignore
					updated[0] = {
						...updated[0],
						content: updated[0]!.content + data.txt,
					};
					return updated;
				} else {
					return [
						{
							id: data.id,
							content: data.txt,
							author: this.currentAuthor,
						} as Message,
						...prev,
					];
				}
			});
			if (data.audio && vrm) {
				try {
					await vrm.audio?.play(data.audio);
				} catch (err) {
					console.error("Failed to play audio:", err);
				}
			}
			console.log("Finished playing");
		}
		console.log("finish streaming");
		this.handling = false;
	}
}
