import { useEffect, useState } from "react";
import { useUI } from "../UIPanel";
import { LoadProfileMessage } from "../data";
import { useVRM } from "../../../vrm/VRMDisplayContext";
import styles from "./Profile.module.css";

type Profile = { name: string; vrm: boolean };

export function ProfileMenu() {
	const { vrm } = useVRM();
	const { clientRef, setMenu, sendData, setDisplayLoading, Disconnect } = useUI();
	const [profiles, setProfiles] = useState<Profile[]>([]);
	const [loading, setLoading] = useState(true);
	const [fetching, setFetching] = useState(false);

	useEffect(() => {
		if (!clientRef.current) {
			vrm.dispose();
			setMenu("Connect");
			throw Error("Client is not initialized");
		}
		try {
			const client = clientRef.current;
			client.once("profilesData", (data: Profile[]) => {
				console.log(`Profiles received:`, data);
				setProfiles(data);
				setLoading(false);
			});
			console.log("Fetching profiles");
			client.emit("listProfiles");
		} catch (err) {
			console.error("Failed to fetch profiles:", err);
			setLoading(false);
			setProfiles([]);
		}
	}, []);

	const handleSelect = async (profile: Profile) => {
		if (!clientRef.current) {
			vrm.dispose();
			setMenu("Connect");
			throw Error("Client is not initialized");
		}

		setFetching(true);
		setDisplayLoading(true);
		console.log("Selected profile:", profile);
		try {
			const client = clientRef.current;
			const promise = new Promise<void>((res, rej) => {
				client.once("success", () => {
					client.removeAllListeners("err");
					client.removeAllListeners("profileVRM");
					if (profile.vrm) {
						client.once("profileVRM", async (data: ArrayBuffer) => {
							console.log("VRM data", data);
							try {
								await vrm.loadVRM(data);
								res();
							} catch (err) {
								vrm.dispose();
								rej(err);
							}
						});
						client.emit("getVRM", profile.name);
					} else res();
				});
				client.once("err", (data) => {
					client.removeAllListeners("success");
					client.removeAllListeners("profileVRM");
					rej(data);
				});
			});
			sendData(
				"loadProfile",
				new LoadProfileMessage({ profile: profile.name })
			);
			await promise;
			setMenu("Chat");
		} catch (err) {
			console.log(err);
			return;
		} finally {
			setFetching(false);
			setDisplayLoading(false);
		}
	};

	const handleDisconnect = (
		e: React.MouseEvent<HTMLButtonElement, MouseEvent>
	) => {
		e.preventDefault();

		if (!clientRef.current) {
			vrm.dispose();
			setMenu("Connect");
			throw Error("Client is not initialized");
		}

		clientRef.current.disconnect()
	};

	if (loading) return <p className={styles.status}>Loading profiles...</p>;
	if (!profiles.length)
		return <p className={styles.status}>No profiles available</p>;

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<h2 className={styles.title}>Available Profiles</h2>
			</div>
			<ul className={styles.profileList}>
				{profiles.map((profile, i) => (
					<li key={i} className={styles.profileItem}>
						<span className={styles.profileName}>
							{i} - {profile.name}
						</span>
						<button
							className={`${styles.selectButton} ${
								fetching ? styles.sbDisabled : ""
							}`}
							onClick={async () => {
								if (!fetching) await handleSelect(profile);
							}}
						>
							Select
						</button>
					</li>
				))}
			</ul>
			<div className={styles.dbContainer}>
				<button
					onClick={handleDisconnect}
					className={styles.disconnectButton}
				>
					Disconnect
				</button></div>
		</div>
	);
}
