import { useEffect, useRef } from "react";
import { useVRM } from "../../vrm/VRMDisplayContext";
import styles from "./DevPanel.module.css";

export function DevPanel() {
	const { statusMessage, handleResetCamera, vrm, stats } = useVRM();
	const statsRef = useRef<HTMLDivElement | null>(null);

	const handleAudioUpload = async (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		const file = event.target.files?.[0];
		if (file && vrm) {
			const url = URL.createObjectURL(file);
			if (vrm?.audio) {
				await vrm.audio.ensureContextRunning();
				await vrm.audio?.play(url);
			}
		}
	};

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			const url = URL.createObjectURL(file);
			if (vrm) vrm.loadVRM(url);
		}
	};

	useEffect(() => {
		if (stats && statsRef.current) {
			statsRef.current.innerHTML = "";
			stats.showPanel(0);
			stats.dom.style.position = "unset";
			statsRef.current.appendChild(stats.dom);
		}
	}, [stats]);

	return (
		<div className={styles.devPanel}>
			<div className={styles.fileInputContainer}>
				<label htmlFor="vrm-file-input">Choose VRM File</label>
				<input
					type="file"
					id="vrm-file-input"
					accept=".vrm, .glb, .gltf"
					onChange={handleFileChange}
				/>
				<p id="status-message">{statusMessage}</p>
			</div>

			<div className={styles.fileInputContainer}>
				<label htmlFor="audio-file-input">Upload MP3</label>
				<input
					type="file"
					id="audio-file-input"
					accept=".mp3,.wav"
					onChange={handleAudioUpload}
				/>
			</div>
			<div className={styles.resetCamera} onClick={handleResetCamera}>
				<p>Reset Camera</p>
			</div>
			<div className="info-panel">
				<p>Use mouse to rotate and zoom.</p>
				<p>Use right mouse button to pan.</p>
				<div ref={statsRef} />
			</div>
		</div>
	);
}
