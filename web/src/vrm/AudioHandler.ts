import { VRMExpressionPresetName } from "@pixiv/three-vrm";
import { VRMInstance } from "./VRMInstance";

type PhonemeShapes = {
	aa: number;
	ee: number;
	ih: number;
	oh: number;
	ou: number;
};

export class AudioHandler {
	public context: AudioContext | null = null;
	private source: MediaElementAudioSourceNode | null = null;
	public analyser: AnalyserNode | null = null;
	private timeDomainData: Uint8Array | null = null;
	private freqData: Uint8Array | null = null;
	private audio: HTMLAudioElement | null = null;

	private prevValues: PhonemeShapes = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };

	public playing = false;

	// A more realistic range for formants to prevent pitch influence
	private readonly phonemeFreqs = {
		aa: { f1: [500, 1000], f2: [1000, 1500] },
		ee: { f1: [200, 500], f2: [2200, 3000] },
		ih: { f1: [300, 600], f2: [1800, 2500] },
		oh: { f1: [400, 800], f2: [800, 1200] },
		ou: { f1: [200, 500], f2: [600, 1000] },
	};

	constructor(
		private vrm: VRMInstance,
		private config: {
			smoothFactor?: number;
			ampThreshold?: number;
			ampScale?: number;
			expressionMultiplier?: number;
		} = {}
	) {
		// defaults, removed unused centroidThresholds
		this.config = {
			smoothFactor: this.config.smoothFactor ?? 0.175,
			ampThreshold: this.config.ampThreshold ?? 0.085,
			ampScale: this.config.ampScale ?? 1,
			expressionMultiplier: this.config.expressionMultiplier ?? 2.0,
		};
	}
	private ensureAudioGraphSetup() {
		console.log("context create")
		this.context = new AudioContext();

		if (!this.analyser) {
			// Setup Analyser and buffers
			this.analyser = this.context.createAnalyser();
			this.analyser.fftSize = 2048;
			this.timeDomainData = new Uint8Array(this.analyser.fftSize);
			this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

			// Connect Gain -> Analyser -> Destination ONCE
			this.analyser.connect(this.context.destination);
		}
	}

	public async ensureContextRunning(): Promise<void> {
		this.ensureAudioGraphSetup();
		if (this.context?.state === "suspended") {
			try {
				await this.context!.resume();
			} catch (e) {
				console.error("Failed to resume AudioContext:", e);
				throw e;
			}
		}
	}
	async play(data: string | ArrayBuffer) {
		await this.stop();
		await this.ensureContextRunning()
		if (data instanceof ArrayBuffer) {
			console.log("Array Buffer received");
			data = URL.createObjectURL(new Blob([data]));
		}
		console.log("Playing", data);

		this.audio = new Audio(data);

		await new Promise((res, rej) => {
			this.audio!.oncanplaythrough = res;
			this.audio!.onerror = rej;
			this.audio!.load();
		});
		this.audio.crossOrigin = "*";

		this.source = this.context!.createMediaElementSource(this.audio);

		this.analyser = this.context!.createAnalyser();
		this.analyser.fftSize = 2048;

		this.timeDomainData = new Uint8Array(this.analyser.fftSize);
		this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

		this.source.connect(this.analyser);
		this.analyser.connect(this.context!.destination);

		await new Promise<void>((res, rej) => {
			this.audio!.onended = () => res();
			this.audio!.onplay = () => {
				if (this.context!.state === "suspended") this.context!.resume();
			};
			this.audio!.onerror = (e) => rej(e);
			this.audio!.currentTime = 0;
			this.audio!.play().catch(rej);
		});
		await this.stop();
	}

	private findHighestPeak(
		freqData: Uint8Array,
		startFreq: number,
		endFreq: number,
		sampleRate: number,
		fftSize: number
	): { freq: number; value: number } {
		const binWidth = sampleRate / fftSize;
		const startBin = Math.floor(startFreq / binWidth);
		const endBin = Math.floor(endFreq / binWidth);

		let maxVal = 0;
		let maxBin = -1;

		for (let i = startBin; i <= endBin; i++) {
			if (freqData[i]! > maxVal) {
				maxVal = freqData[i]!;
				maxBin = i;
			}
		}

		if (maxBin === -1) {
			return { freq: 0, value: 0 };
		}
		return {
			freq: maxBin * binWidth,
			value: maxVal,
		};
	}

	private peakAmplitude = 0;
	updateAnalyser() {
		const shapes: PhonemeShapes = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
		const { ampThreshold, ampScale, smoothFactor, expressionMultiplier } =
			this.config as Required<typeof this.config>;
		this.playing = !!this.audio && !this.audio.paused && !this.audio.ended;

		if (this.playing) {
			if (!this.analyser || !this.timeDomainData || !this.freqData)
				return;

			this.analyser.getByteTimeDomainData(this.timeDomainData);
			this.analyser.getByteFrequencyData(this.freqData);

			// RMS amplitude
			let sumSq = 0;
			for (let i = 0; i < this.timeDomainData.length; i++) {
				const v = (this.timeDomainData[i]! - 128) / 128;
				sumSq += v * v;
			}
			const rms = Math.sqrt(sumSq / this.timeDomainData.length);

			if (rms < 0.005) {
				for (const k of Object.keys(
					shapes
				) as (keyof PhonemeShapes)[]) {
					shapes[k] = 0;
				}
			} else {
				// Dynamic amplitude scaling
				this.peakAmplitude = Math.max(this.peakAmplitude * 0.95, rms); // Decay the peak over time
				const normalizedRms =
					this.peakAmplitude > 0 ? rms / this.peakAmplitude : 0;
				const mixedRms = 0.775 * rms + 0.225 * normalizedRms;

				// Check if sound is above amplitude threshold
				if (mixedRms > ampThreshold) {
					const level = Math.min(
						1,
						(mixedRms - ampThreshold) * ampScale
					);

					const sampleRate = this.context!.sampleRate;
					const fftSize = this.analyser.fftSize;

					const scores = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };

					const F1_WEIGHT = 0.6;
					const F2_WEIGHT = 0.4;
					const MIN_PEAK_VALUE = 40;

					for (const phoneme of Object.keys(
						this.phonemeFreqs
					) as (keyof typeof this.phonemeFreqs)[]) {
						const { f1, f2 } = this.phonemeFreqs[phoneme];
						const peak1 = this.findHighestPeak(
							this.freqData,
							f1[0]!,
							f1[1]!,
							sampleRate,
							fftSize
						);
						const peak2 = this.findHighestPeak(
							this.freqData,
							f2[0]!,
							f2[1]!,
							sampleRate,
							fftSize
						);

						if (
							peak1.value > MIN_PEAK_VALUE &&
							peak2.value > MIN_PEAK_VALUE
						) {
							scores[phoneme] =
								peak1.value * F1_WEIGHT +
								peak2.value * F2_WEIGHT;
						}
					}

					let bestMatch: keyof PhonemeShapes | null = null;
					let maxScore = 0;
					for (const phoneme of Object.keys(
						scores
					) as (keyof typeof scores)[]) {
						if (scores[phoneme] > maxScore) {
							maxScore = scores[phoneme];
							bestMatch = phoneme;
						}
					}

					if (bestMatch) {
						shapes[bestMatch] = level;
					}
				}
			}
		}

		for (const k of Object.keys(shapes) as (keyof PhonemeShapes)[]) {
			const target = shapes[k];
			const smooth =
				this.prevValues[k] +
				smoothFactor * (target - this.prevValues[k]);
			if (smooth < 0.0001 && target == 0) this.prevValues[k] = 0;
			else this.prevValues[k] = smooth;

			if (this.vrm.animation?.expressions[k]) {
				const amplifiedValue = smooth * expressionMultiplier;
				this.vrm.animation.expressions[k].value = amplifiedValue;
			}
		}

		if (
			Object.values(this.prevValues).every((v) => v < 0.01) &&
			this.vrm.animation?.expressions[VRMExpressionPresetName.Neutral]
		) {
			this.vrm.animation.expressions[
				VRMExpressionPresetName.Neutral
			]!.value = 1;
		} else if (
			this.vrm.animation?.expressions[VRMExpressionPresetName.Neutral]
		) {
			this.vrm.animation.expressions[
				VRMExpressionPresetName.Neutral
			]!.value = 0;
		}
	}

	async stop() {
		if (this.audio) {
			this.audio.pause();
			this.audio.src = "";
			this.audio = null;
		}
		if (this.context) {
			await this.context.close();
			this.context = null;
		}

		if (this.vrm.instance) {
			const em = this.vrm.instance.expressionManager;
			em?.setValue("aa", 0);
			em?.setValue("ih", 0);
			em?.setValue("ou", 0);
			em?.setValue("ee", 0);
			em?.setValue("oh", 0);
		}

		this.prevValues = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
	}
}
