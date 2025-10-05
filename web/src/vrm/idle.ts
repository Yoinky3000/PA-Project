import { VRMCore, VRMExpressionPresetName } from "@pixiv/three-vrm";
import * as THREE from "three";

// convert screen mouse pos → 3D point in front of camera
function screenToWorld(mouse: { x: number; y: number }, camera: THREE.Camera) {
	// normalized device coordinates (-1 to 1)
	const ndc = new THREE.Vector3(
		(mouse.x / window.innerWidth) * 2 - 1,
		-(mouse.y / window.innerHeight) * 2 + 1,
		0.5 // depth between near/far clip
	);

	// unproject into world space
	ndc.unproject(camera);

	// point 1 units in front of camera
	const dir = ndc.sub(camera.position).normalize();
	return camera.position.clone().add(dir);
}

let nextBlinkTime = 0;
let blinkDuration = 0.2; // seconds the blink is closed
let blinkProgress = 1;
let doubleBlink = false;
const smoothedTarget = new THREE.Vector3();

function getRandomBlinkDelay() {
	return 3 + Math.random() * 4; // blink every 3–7 seconds
}
export function setNextBlink(t: number) {
			doubleBlink = Math.random() < 0.1;
			nextBlinkTime = t + getRandomBlinkDelay() + (doubleBlink ? 1 : 0);
			blinkProgress = 0;
}

export function idleUpdate(
	vrm: VRMCore,
	camera: THREE.Camera,
	mouse: { x: number; y: number },
	t: number,
	delta: number,
	hipY: number
) {
	const spine = vrm.humanoid?.getNormalizedBoneNode("spine");
	const chest = vrm.humanoid?.getNormalizedBoneNode("chest");
	const hips = vrm.humanoid?.getNormalizedBoneNode("hips");
	const head = vrm.humanoid?.getNormalizedBoneNode("head");
	const leftShoulder = vrm.humanoid?.getNormalizedBoneNode("leftShoulder");
	const rightShoulder = vrm.humanoid?.getNormalizedBoneNode("rightShoulder");
	const leftLowerArm = vrm.humanoid?.getNormalizedBoneNode("leftLowerArm");
	const rightLowerArm = vrm.humanoid?.getNormalizedBoneNode("rightLowerArm");
	const leftUpperArm = vrm.humanoid?.getNormalizedBoneNode("leftUpperArm");
	const rightUpperArm = vrm.humanoid?.getNormalizedBoneNode("rightUpperArm");
	const leftUpperLeg = vrm.humanoid?.getNormalizedBoneNode("leftUpperLeg");
	const rightUpperLeg = vrm.humanoid?.getNormalizedBoneNode("rightUpperLeg");
	const leftLowerLeg = vrm.humanoid?.getNormalizedBoneNode("leftLowerLeg");
	const rightLowerLeg = vrm.humanoid?.getNormalizedBoneNode("rightLowerLeg");
	const leftFoot = vrm.humanoid?.getNormalizedBoneNode("leftFoot");
	const rightFoot = vrm.humanoid?.getNormalizedBoneNode("rightFoot");
	const { target, clamped } = clampLookTarget(
		screenToWorld(mouse, camera),
		head!,
		THREE.MathUtils.degToRad(40),
		THREE.MathUtils.degToRad(20),
		THREE.MathUtils.degToRad(-40)
	);
	let eyesSmoothFactor = clamped ? 0.05 : 0.15;
	let headSmoothFactor = clamped ? 0.04 : 0.045;
	if (vrm.lookAt) {
		if (smoothedTarget.lengthSq() === 0) {
			smoothedTarget.copy(target);
		}
		smoothedTarget.lerp(target, eyesSmoothFactor);
		vrm.lookAt.lookAt(smoothedTarget);
	}
	const breathSin = Math.sin(t * 1.5);
	if (head) {
		const swingY = Math.sin(t * 0.5) * 0.025;
		const headBreath = breathSin * 0.025;

		const headWorldPos = head.getWorldPosition(new THREE.Vector3());
		const dir = target.clone().sub(headWorldPos).normalize();

		const targetX = -dir.y * 0.2 + headBreath; // pitch
		const targetY = dir.x * 0.3; // yaw component based on mouse
		const targetZ = -dir.x * 0.2; // roll

		head.rotation.x +=
			(targetX - breathSin * 0.05 - head.rotation.x) * headSmoothFactor;
		head.rotation.y +=
			(targetY + swingY - head.rotation.y) * headSmoothFactor;
		head.rotation.z += (targetZ - head.rotation.z) * headSmoothFactor;

		if (spine) {
			spine.rotation.x = breathSin * 0.01;
			spine.rotation.y +=
				(targetY * 0.5 - spine.rotation.y) * headSmoothFactor;
		}

		if (hips) {
			hips.rotation.x = -0.025 + breathSin * 0.01;
			hips.rotation.y +=
				(targetY * 0.3 - hips.rotation.y) * headSmoothFactor;
			hips.position.z = breathSin * 0.005;
			hips.position.y = hipY - breathSin * 0.001;
		}
		if (leftUpperLeg && rightUpperLeg) {
			leftUpperLeg.rotation.y =
				(targetY * -5 - leftUpperLeg.rotation.y) * headSmoothFactor;
			rightUpperLeg.rotation.y =
				(targetY * -5 - rightUpperLeg.rotation.y) * headSmoothFactor;
		}
	}
	if (leftShoulder && rightShoulder) {
		const shoulderRot = (breathSin-0.5) * -0.065; // radians, ~3°

		leftShoulder.rotation.z +=
			(shoulderRot - leftShoulder.rotation.z) * 0.1;
		rightShoulder.rotation.z +=
			(-shoulderRot - rightShoulder.rotation.z) * 0.1;

		// Optionally add slight forward roll
		leftShoulder.rotation.x +=
			(breathSin * -0.035 - leftShoulder.rotation.x) * 0.1;
		rightShoulder.rotation.x +=
			(breathSin * -0.035 - rightShoulder.rotation.x) * 0.1;
	}
	if (leftLowerArm && rightLowerArm && leftUpperArm && rightUpperArm) {
		leftLowerArm.rotation.x = 0.3;
		leftLowerArm.rotation.y = -0.3 - breathSin * 0.02;
		leftUpperArm.rotation.y = 0.4 - breathSin * 0.02;
		if (leftShoulder) leftUpperArm.rotation.z = -1.2 - leftShoulder.rotation.z;
		else leftUpperArm.rotation.z = -1.2;
		rightLowerArm.rotation.x = 0.3;
		rightLowerArm.rotation.y = 0.3 + breathSin * 0.02;
		rightUpperArm.rotation.y = -(0.4 - breathSin * 0.02);
		if (rightShoulder) rightUpperArm.rotation.z = 1.2 - rightShoulder.rotation.z;
		else rightUpperArm.rotation.z = 1.2;
		setNaturalHandPose(vrm, t);
	}
	if (vrm.expressionManager) {
		if (t > nextBlinkTime) {
			setNextBlink(t)
		}

		if (blinkProgress < 1) {
			blinkProgress += delta / blinkDuration;
			let blinkValue = 0;

			if (blinkProgress < 0.5) {
				blinkValue = blinkProgress * 2;
			} else if (blinkProgress < 1) {
				blinkValue = (1 - blinkProgress) * 2;
			}

			vrm.expressionManager.setValue(
				VRMExpressionPresetName.Blink,
				blinkValue
			);
		} else {
			if (doubleBlink) {blinkProgress = 0; doubleBlink = false;}
			else vrm.expressionManager.setValue(VRMExpressionPresetName.Blink, 0);
		}
	}
	if (leftUpperLeg && rightUpperLeg) {
		leftUpperLeg.rotation.x = -0.075 - breathSin * 0.016;
		rightUpperLeg.rotation.x = -0.075 - breathSin * 0.016;
	}
	if (leftLowerLeg && rightLowerLeg) {
		leftLowerLeg.rotation.x = 0.15 + breathSin * 0.023;
		rightLowerLeg.rotation.x = 0.15 + breathSin * 0.023;
	}
	if (leftFoot && rightFoot) {
		leftFoot.rotation.x = -0.05 - breathSin * 0.016;
		rightFoot.rotation.x = -0.05 - breathSin * 0.016;
	}
}

function setNaturalHandPose(vrm: VRMCore, t: number) {
	const humanoid = vrm.humanoid;
	if (!humanoid) return;

	const leftHand = humanoid.getNormalizedBoneNode("leftHand");
	const rightHand = humanoid.getNormalizedBoneNode("rightHand");

	// Fingers per hand
	const fingers = [
		["ThumbMetacarpal", "ThumbProximal", "ThumbDistal"],
		["IndexProximal", "IndexIntermediate", "IndexDistal"],
		["MiddleProximal", "MiddleIntermediate", "MiddleDistal"],
		["RingProximal", "RingIntermediate", "RingDistal"],
		["LittleProximal", "LittleIntermediate", "LittleDistal"],
	];

	const fingerSwing = Math.sin(t * 2.0) * 0.02;

	function applyHandPose(side: "left" | "right", handNode?: THREE.Object3D) {
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
		applyHandPose("left", leftHand);
		applyHandPose("right", rightHand);
	}
}

function clampLookTarget(
	target: THREE.Vector3,
	head: THREE.Object3D,
	maxYaw: number, // in radians
	maxPitch: number, // in radians
	minPitch: number // in radians
) {
	// Head forward in world space
	const headForward = new THREE.Vector3(0, 0, 1).applyQuaternion(
		head.getWorldQuaternion(new THREE.Quaternion())
	);
	const headPos = head.getWorldPosition(new THREE.Vector3());

	// Direction to target
	const dir = target.clone().sub(headPos).normalize();

	// Convert direction into head's local space
	const localDir = dir
		.clone()
		.applyQuaternion(
			head.getWorldQuaternion(new THREE.Quaternion()).invert()
		);

	const yaw = Math.atan2(localDir.x, localDir.z); // left-right
	const pitch = Math.asin(localDir.y); // up-down

	if (Math.abs(yaw) > maxYaw || pitch > maxPitch || pitch < minPitch) {
		// Outside limits → force look straight ahead
		return {
			target: headPos.clone().add(headForward.multiplyScalar(10)),
			clamped: true,
		};
	}
	return { target, clamped: false };
}
