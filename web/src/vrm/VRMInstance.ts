import { VRMCore, VRMUtils } from "@pixiv/three-vrm";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { VRMAnimationLoaderPlugin } from "@pixiv/three-vrm-animation";
import { AnimationHandler } from "./AnimationHandler";
import { AudioHandler } from "./AudioHandler";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";

export class VRMInstance {
	public instance: VRMCore | null = null;
	public animationFrameId = 0;
	public lastMoveTime: number = Date.now();
	public animation: AnimationHandler | null = null;
	public audio: AudioHandler | null = null;

	constructor(
		public renderer: React.RefObject<THREE.WebGLRenderer>,
		public composer: React.RefObject<EffectComposer | null>,
		public scene: React.RefObject<THREE.Scene>,
		public mixer: React.RefObject<THREE.AnimationMixer | null>,
		public camera: React.RefObject<THREE.PerspectiveCamera | null>,
		public control: React.RefObject<OrbitControls | null>,
		public mouse: React.RefObject<{
			x: number;
			y: number;
		}>,
		public t: React.RefObject<number>,
		public animated: React.RefObject<number>,
		public hipY: React.RefObject<number>,
		public camY: React.RefObject<number>,
		public setStatusMessage: (status: string) => unknown,
		public showContainer: boolean,
		public setShowContainer: (show: boolean) => unknown
	) {
		this.audio = new AudioHandler(this, { ampScale: 1 });
	}
	async loadVRM(data: string | ArrayBuffer) {
		this.setStatusMessage("Loading...");
		this.setShowContainer(false);

		this.dispose();

		const manager = new THREE.LoadingManager();
		manager.onProgress = (_url, itemsLoaded, itemsTotal) => {
			const progress = Math.floor((itemsLoaded / itemsTotal) * 100);
			this.setStatusMessage(`Loading: ${progress}%`);
		};
		manager.onLoad = () =>
			this.setStatusMessage("Model loaded successfully!");
		manager.onError = () => this.setStatusMessage("Error loading model!");

		const loader = new GLTFLoader(manager);
		loader.register((parser) => new VRMLoaderPlugin(parser));
		loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
		try {
			const gltf =
				typeof data === "string"
					? await loader.loadAsync(data)
					: await loader.parseAsync(data, "");
			const vrm = gltf.userData.vrm as VRMCore | null;
			if (vrm) {
				if (this.audio) this.audio.stop();
				this.instance = vrm;
				this.animation = new AnimationHandler(this);
				const hips = vrm.humanoid?.getNormalizedBoneNode("hips");
				this.hipY.current = hips!.position.y;
				this.camY.current = this.hipY.current + 0.255;

				if (this.camera.current && this.control.current) {
					this.camera.current.position.set(
						0.15,
						this.camY.current,
						1.75
					);
					this.control.current.target.set(0.15, this.camY.current, 0);
				}

				VRMUtils.removeUnnecessaryVertices(gltf.scene);
				VRMUtils.combineSkeletons(gltf.scene);
				VRMUtils.combineMorphs(vrm);
				VRMUtils.rotateVRM0(vrm);

				if (gltf.animations && gltf.animations[0]) {
					this.mixer.current = new THREE.AnimationMixer(vrm.scene);
					const action = this.mixer.current.clipAction(
						gltf.animations[0]
					);
					action.play();
				} else {
					console.log(
						"No embedded animations found in the VRM model."
					);
					this.mixer.current = null;
				}

				vrm.scene.traverse((object) => {
					if (object instanceof THREE.Mesh) {
						object.castShadow = true;
						object.receiveShadow = true;
					}
				});

				this.mouse.current.x = window.innerWidth / 2;
				this.mouse.current.y = window.innerHeight / 2;
				this.scene.current.add(vrm.scene);
				this.animation.setNextBlink(this.t.current);
			} else {
				console.error("VRM not found in GLTF user data.");
				this.setStatusMessage("Error: VRM not found in GLTF Data.");
			}
		} catch (err) {
			console.error("An error happened during VRM loading:", err);
			this.setStatusMessage("Error loading VRM data!");
		}
	}
	dispose() {
		if (this.instance) {
			this.scene.current.remove(this.instance.scene);
			try {
				VRMUtils.deepDispose?.(this.instance.scene);
			} catch (e) {
				this.instance.scene.traverse((obj: any) => {
					if (obj.isMesh) {
						obj.geometry?.dispose?.();
						if (obj.material) {
							if (Array.isArray(obj.material)) {
								obj.material.forEach((m: any) => m.dispose?.());
							} else {
								obj.material.dispose?.();
							}
						}
					}
				});
			}
			this.mixer.current?.stopAllAction();
			this.mixer.current = null;
			this.instance = null;
		}
		this.animated.current = 0;
	}
	animate(deltaTime: number) {
		const now = Date.now();
		if (now - this.lastMoveTime > 5000) {
			if (this.mouse.current.x != window.innerWidth / 2)
				this.mouse.current.x = window.innerWidth / 2;
			if (this.mouse.current.y != window.innerHeight / 2)
				this.mouse.current.y = window.innerHeight / 2;
			if (this.animation) this.animation.afk = true;
		}

		if (this.camera.current && this.animation) {
			if (this.instance) {
				this.animation.animate(deltaTime);
				this.instance.update(deltaTime);
				this.mixer.current?.update(deltaTime);
			}

			this.control.current?.update();
			if (this.composer.current) this.composer.current.render();
			else
				this.renderer.current.render(
					this.scene.current,
					this.camera.current!
				);

			if (!this.showContainer && this.animated.current > 100) {
				this.setShowContainer(true);
			} else {
				this.animated.current++;
			}
		}
	}
}
