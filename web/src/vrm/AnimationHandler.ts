import {
	VRMCore,
	VRMExpressionPresetName,
	VRMHumanBoneName,
} from "@pixiv/three-vrm";
import { VRMInstance } from "./VRMInstance";
import * as THREE from "three";
import { clampLookTarget, screenToWorld } from "./utils";
import { AFK1 } from "./animation/afk1";
import { AFK2 } from "./animation/afk2";

export type AnimationData = {
	fn: (handler: AnimationHandler, t: number) => void;
	init?: (handler: AnimationHandler) => number;
	duration: number;
};

class Position {
	public x: number = 0;
	public y: number = 0;
	public z: number = 0;
	public object: THREE.Object3D | null = null;
	constructor(public factor: number = 1) {}
	init(object: THREE.Object3D) {
		this.object = object;
		this.y = object.position.y;
		this.z = object.position.z;
		this.x = object.position.x;
	}
}

class Rotation {
	public x: number = 0;
	public y: number = 0;
	public z: number = 0;
	public object: THREE.Object3D | null = null;
	constructor(public factor: number = 1) {}
	init(object: THREE.Object3D) {
		this.object = object;
		this.y = object.rotation.y;
		this.z = object.rotation.z;
		this.x = object.rotation.x;
	}
}

const initNextAFK = 10;

class VRMBone {
	public bone: THREE.Object3D;
	constructor(
		public name: VRMHumanBoneName,
		public vrm: VRMInstance,
		public position: Position,
		public rotation: Rotation
	) {
		this.bone = vrm.instance!.humanoid.getNormalizedBoneNode(name)!;
		position.init(this.bone!);
		rotation.init(this.bone!);
	}
	update() {
		if (this.bone) {
			this.bone.position.x +=
				(this.position.x - this.bone.position.x) * this.position.factor;
			this.bone.position.y +=
				(this.position.y - this.bone.position.y) * this.position.factor;
			this.bone.position.z +=
				(this.position.z - this.bone.position.z) * this.position.factor;
			this.bone.rotation.x +=
				(this.rotation.x - this.bone.rotation.x) * this.rotation.factor;
			this.bone.rotation.y +=
				(this.rotation.y - this.bone.rotation.y) * this.rotation.factor;
			this.bone.rotation.z +=
				(this.rotation.z - this.bone.rotation.z) * this.rotation.factor;
		}
	}
}

class Expression {
	public value = 0;
	constructor(
		public name: VRMExpressionPresetName | string,
		public vrm: VRMInstance
	) {}
	update() {
		if (this.vrm.instance?.expressionManager) {
			this.vrm.instance.expressionManager.setValue(this.name, this.value);
		}
	}
}

export class AnimationHandler {
	breathSin = 0;
	nextBlinkTime = 0;
	blinkDuration = 0.15;
	blinkProgress = 1;
	doubleBlink = false;
	doubleBlinkChance = 0;
	smoothedLookAt = new THREE.Vector3();
	lookTarget!: {
        target: THREE.Vector3;
        clamped: boolean;
    };
	headSmoothFactor = 0.04;
	afk = true;
	afkAnimations: { data: AnimationData; chance: number }[] = [
		{ data: AFK1, chance: 3 / 4 },
		{ data: AFK2, chance: 1 / 4 },
	];
	currentAnimation: AnimationData | null = null;
	aniStartTime = 0;
	nextAFKTime = initNextAFK;
	expressions: { [key: VRMExpressionPresetName | string]: Expression } = {};
	baseAnimation(t: number) {
		this.headSmoothFactor = this.lookTarget.clamped ? 0.03 : 0.045;
		this.head.rotation.factor = this.headSmoothFactor;
		this.hips.rotation.factor = this.headSmoothFactor;
		this.spine.rotation.factor = this.headSmoothFactor;
		this.leftUpperLeg.rotation.factor = this.headSmoothFactor;
		this.rightUpperLeg.rotation.factor = this.headSmoothFactor;

		// head
		const headSwingY = Math.sin(t * 0.5) * 0.025;
		const headBreath = this.breathSin * 0.025;
		const headWorldPos = this.head.bone.getWorldPosition(
			new THREE.Vector3()
		);
		const dir = this.lookTarget.target
			.clone()
			.sub(headWorldPos)
			.normalize();

		const targetX = -dir.y * 0.2 + headBreath; // pitch
		const targetY = dir.x * 0.3; // yaw component based on mouse
		const targetZ = -dir.x * 0.2; // roll

		this.head.rotation.x = targetX - this.breathSin * 0.05;
		this.head.rotation.y = targetY + headSwingY;
		this.head.rotation.z = targetZ;

		// shoulders
		const shoulderRot = (this.breathSin - 0.5) * -0.065;

		this.leftShoulder.rotation.x = this.breathSin * -0.035;
		this.rightShoulder.rotation.x = this.breathSin * -0.035;
		this.leftShoulder.rotation.y = 0;
		this.rightShoulder.rotation.y = 0;
		this.leftShoulder.rotation.z = shoulderRot;
		this.rightShoulder.rotation.z = -shoulderRot;

		// arms
		this.leftLowerArm.rotation.x = 0.3;
		this.leftLowerArm.rotation.y = -0.3 - this.breathSin * 0.02;
		this.leftLowerArm.rotation.z = 0;

		this.leftUpperArm.rotation.x = 0;
		this.leftUpperArm.rotation.y = 0.4 - this.breathSin * 0.02;
		if (this.leftShoulder)
			this.leftUpperArm.rotation.z = -1.2 - this.leftShoulder.rotation.z;
		else this.leftUpperArm.rotation.z = -1.2;

		this.rightLowerArm.rotation.x = 0.3;
		this.rightLowerArm.rotation.y = 0.3 + this.breathSin * 0.02;
		this.rightLowerArm.rotation.z = 0;

		this.rightUpperArm.rotation.x = 0;
		this.rightUpperArm.rotation.y = -(0.4 - this.breathSin * 0.02);
		if (this.rightShoulder)
			this.rightUpperArm.rotation.z = 1.2 - this.rightShoulder.rotation.z;
		else this.rightUpperArm.rotation.z = 1.2;

		// spine
		this.spine.rotation.x = this.breathSin * 0.01;
		this.spine.rotation.y = targetY * 0.5;
		this.spine.rotation.z = 0;

		// hips
		this.hips.rotation.x = -0.025 + this.breathSin * 0.01;
		this.hips.rotation.y = targetY * 0.3;
		this.hips.position.z = this.breathSin * 0.005;
		this.hips.position.y = this.vrm.hipY.current - this.breathSin * 0.001;

		// upperLeg
		this.leftUpperLeg.rotation.y =
			(targetY * -5 - this.leftUpperLeg.rotation.y) *
			this.headSmoothFactor;
		this.rightUpperLeg.rotation.y =
			(targetY * -5 - this.rightUpperLeg.rotation.y) *
			this.headSmoothFactor;
		this.leftUpperLeg.rotation.x = -0.075 - this.breathSin * 0.016;
		this.rightUpperLeg.rotation.x = -0.075 - this.breathSin * 0.016;

		// lowerLeg
		this.leftLowerLeg.rotation.x = 0.15 + this.breathSin * 0.023;
		this.rightLowerLeg.rotation.x = 0.15 + this.breathSin * 0.023;

		// foot
		this.leftFoot.rotation.x = -0.05 - this.breathSin * 0.016;
		this.rightFoot.rotation.x = -0.05 - this.breathSin * 0.016;
	}
	animate(deltaT: number) {
		this.expressions[VRMExpressionPresetName.Neutral]!.value = 1;
		this.getLookTarget();
		this.blink(deltaT);
		this.breathSin = Math.sin(this.vrm.t.current * 1.5);
		this.setNaturalHandPose(this.vrm.instance!, this.vrm.t.current);
		this.baseAnimation(this.vrm.t.current);
		this.handleAFK(this.vrm.t.current);
		this.playAnimation(this.vrm.t.current);
		this.vrm.audio?.updateAnalyser();
		this.update();
		this.lookAt();
	}
	private handleAFK(t: number) {
		if (this.afk) {
			if (this.currentAnimation) {
				// Run active AFK animation
				const elapsed = t - this.aniStartTime;

				// Check if finished
				if (elapsed > this.currentAnimation.duration) {
					this.currentAnimation = null;
					this.nextAFKTime = t + 30 + Math.random() * 10; // schedule next after 30s
				}
			} else {
				// Idle until it's time to play another AFK animation
				if (t > this.nextAFKTime) {
					function pickWeighted<T extends { chance: number }>(
						list: T[]
					): T {
						const total = list.reduce(
							(sum, item) => sum + item.chance,
							0
						);
						let r = Math.random() * total;
						for (const item of list) {
							if (r < item.chance) return item;
							r -= item.chance;
						}
						return list[list.length - 1]!; // fallback
					}
					const pick = pickWeighted(this.afkAnimations);
					if (pick.data.init)
						pick.data.duration = pick.data.init(this);
					this.startAnimation(pick.data);
				}
			}
		} else {
			this.nextAFKTime = t + initNextAFK;
			this.currentAnimation = null;
		}
	}
	startAnimation(data: AnimationData) {
		this.currentAnimation = data;
		this.aniStartTime = this.vrm.t.current;
	}
	playAnimation(t: number) {
		if (this.currentAnimation) {
			// Run active AFK animation
			const elapsed = t - this.aniStartTime;
			this.currentAnimation.fn(this, elapsed);
		}
	}
	getLookTarget() {
		this.lookTarget = clampLookTarget(
			screenToWorld(this.vrm.mouse.current, this.vrm.camera.current!),
			this.head.bone,
            this.hips.bone,
			!!this.currentAnimation
		);
	}
	lookAt() {
		let eyesSmoothFactor = this.lookTarget.clamped ? 0.0075 : 0.15;
		if (this.vrm.instance && this.vrm.instance.lookAt) {
			if (this.smoothedLookAt.lengthSq() === 0) {
				this.smoothedLookAt.copy(this.lookTarget.target);
			}
			this.smoothedLookAt.lerp(this.lookTarget.target, eyesSmoothFactor);
			this.vrm.instance.lookAt.lookAt(this.smoothedLookAt);
		}
	}
	blink(deltaT: number) {
		if (this.vrm.instance && this.vrm.instance.expressionManager) {
			if (this.vrm.t.current > this.nextBlinkTime) {
				this.setNextBlink(this.vrm.t.current);
			}

			if (this.blinkProgress < 1) {
				this.blinkProgress += deltaT / this.blinkDuration;
				let blinkValue = 0;

				if (this.blinkProgress < 0.5) {
					blinkValue = this.blinkProgress * 2;
				} else if (this.blinkProgress < 1) {
					blinkValue = (1 - this.blinkProgress) * 2;
				}

				// this.vrm.instance.expressionManager.setValue(
				// 	VRMExpressionPresetName.Blink,
				// 	blinkValue
				// );
				this.expressions[VRMExpressionPresetName.Blink]!.value =
					blinkValue;
			} else {
				if (this.doubleBlink) {
					this.blinkProgress = 0;
					this.doubleBlink = false;
				} else
					this.expressions[VRMExpressionPresetName.Blink]!.value = 0;
			}
		}
	}
	setNaturalHandPose(vrm: VRMCore, t: number) {
		const humanoid = vrm.humanoid;
		if (!humanoid) return;

		const leftHand = this.leftHand;
		const rightHand = this.rightHand;

		// Fingers per hand
		const fingers = [
			["ThumbMetacarpal", "ThumbProximal", "ThumbDistal"],
			["IndexProximal", "IndexIntermediate", "IndexDistal"],
			["MiddleProximal", "MiddleIntermediate", "MiddleDistal"],
			["RingProximal", "RingIntermediate", "RingDistal"],
			["LittleProximal", "LittleIntermediate", "LittleDistal"],
		];

		const fingerSwing = Math.sin(t * 2.0) * 0.02;

		function applyHandPose(
			side: "left" | "right",
			handNode?: THREE.Object3D
		) {
			if (!handNode) return;

			handNode.rotation.x = -0.125; // rotate along arm
			handNode.rotation.z = side === "left" ? -0.15 : 0.15; // palms slightly inward

			fingers.forEach((chain, i) => {
				chain.forEach((bone, j) => {
					const node = humanoid.getNormalizedBoneNode(
						(side + bone) as any
					);
					if (node) {
						// base curl angles: index straighter, pinky more curled
						const baseCurl = 0.2 + i * 0.1; // index ~0.2, pinky ~0.6 rad
						const extra = j * 0.025; // more curl for distal bones
						const oscillation = fingerSwing * (0.5 + i * 0.1);

						if (!bone.startsWith("Thumb"))
							node.rotation.z =
								(side == "left" ? -1 : 1) *
								(baseCurl + extra + oscillation);
						else
							node.rotation.y =
								(side == "left" ? 1 : -1) *
								(baseCurl + extra + oscillation);
						if (bone == "ThumbMetacarpal") node.rotation.x = 0.7;
					}
				});
			});
		}
		if (leftHand && rightHand) {
			applyHandPose("left", leftHand.bone);
			applyHandPose("right", rightHand.bone);
		}
	}
	setNextBlink(t: number) {
		function getRandomBlinkDelay() {
			return 3 + Math.random() * 4; // blink every 3–7 seconds
		}
		this.doubleBlink = Math.random() < this.doubleBlinkChance;
		if (this.doubleBlink) this.doubleBlinkChance = 0;
		else this.doubleBlinkChance += 0.05 * Math.random();
		this.nextBlinkTime =
			t + getRandomBlinkDelay() + (this.doubleBlink ? 1 : 0);
		this.blinkProgress = 0;
	}
	private update() {
		this.spine.update();
		this.chest.update();
		this.hips.update();
		this.head.update();
		this.leftShoulder.update();
		this.rightShoulder.update();
		this.leftLowerArm.update();
		this.rightLowerArm.update();
		this.leftUpperArm.update();
		this.rightUpperArm.update();
		this.leftUpperLeg.update();
		this.rightUpperLeg.update();
		this.leftLowerLeg.update();
		this.rightLowerLeg.update();
		this.leftFoot.update();
		this.rightFoot.update();
		for (const k of Object.keys(this.expressions)) {
			this.expressions[k]!.update();
		}
	}
	spine: VRMBone;
	chest: VRMBone;
	hips: VRMBone;
	head: VRMBone;
	leftShoulder: VRMBone;
	rightShoulder: VRMBone;
	leftUpperArm: VRMBone;
	rightUpperArm: VRMBone;
	leftLowerArm: VRMBone;
	rightLowerArm: VRMBone;
	leftHand: VRMBone;
	rightHand: VRMBone;
	leftUpperLeg: VRMBone;
	rightUpperLeg: VRMBone;
	leftLowerLeg: VRMBone;
	rightLowerLeg: VRMBone;
	leftFoot: VRMBone;
	rightFoot: VRMBone;
	constructor(public vrm: VRMInstance) {
		this.nextAFKTime = vrm.t.current + initNextAFK;
		this.spine = new VRMBone(
			"spine",
			this.vrm,
			new Position(),
			new Rotation(0.045)
		);
		this.chest = new VRMBone(
			"chest",
			this.vrm,
			new Position(),
			new Rotation()
		);
		this.hips = new VRMBone(
			"hips",
			this.vrm,
			new Position(),
			new Rotation(0.045)
		);
		this.head = new VRMBone(
			"head",
			this.vrm,
			new Position(),
			new Rotation(0.045)
		);
		this.leftShoulder = new VRMBone(
			"leftShoulder",
			this.vrm,
			new Position(),
			new Rotation(0.1)
		);
		this.rightShoulder = new VRMBone(
			"rightShoulder",
			this.vrm,
			new Position(),
			new Rotation(0.1)
		);
		this.leftUpperArm = new VRMBone(
			"leftUpperArm",
			this.vrm,
			new Position(),
			new Rotation(0.1)
		);
		this.rightUpperArm = new VRMBone(
			"rightUpperArm",
			this.vrm,
			new Position(),
			new Rotation(0.1)
		);
		this.leftLowerArm = new VRMBone(
			"leftLowerArm",
			this.vrm,
			new Position(),
			new Rotation(0.1)
		);
		this.rightLowerArm = new VRMBone(
			"rightLowerArm",
			this.vrm,
			new Position(),
			new Rotation(0.1)
		);
		this.leftHand = new VRMBone(
			"leftHand",
			this.vrm,
			new Position(),
			new Rotation()
		);
		this.rightHand = new VRMBone(
			"rightHand",
			this.vrm,
			new Position(),
			new Rotation()
		);
		this.leftUpperLeg = new VRMBone(
			"leftUpperLeg",
			this.vrm,
			new Position(),
			new Rotation()
		);
		this.rightUpperLeg = new VRMBone(
			"rightUpperLeg",
			this.vrm,
			new Position(),
			new Rotation()
		);
		this.leftLowerLeg = new VRMBone(
			"leftLowerLeg",
			this.vrm,
			new Position(),
			new Rotation()
		);
		this.rightLowerLeg = new VRMBone(
			"rightLowerLeg",
			this.vrm,
			new Position(),
			new Rotation()
		);
		this.leftFoot = new VRMBone(
			"leftFoot",
			this.vrm,
			new Position(),
			new Rotation()
		);
		this.rightFoot = new VRMBone(
			"rightFoot",
			this.vrm,
			new Position(),
			new Rotation()
		);
		this.getLookTarget();
		for (const k of Object.values(VRMExpressionPresetName)) {
			this.expressions[k] = new Expression(k, this.vrm);
		}
	}
}
