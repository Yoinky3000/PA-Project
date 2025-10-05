import { VRMExpressionPresetName } from "@pixiv/three-vrm";
import { AnimationData, AnimationHandler } from "../AnimationHandler";
import * as THREE from "three";

/** Smooth ease-in-out curve */
function easeInOut(t: number) {
	return -(Math.cos(Math.PI * t) - 1) / 2;
}

// ===============================
// Animation State Variables
// ===============================

// Look timing (sweeps and pauses)
let lookLeft = 0.75;
let firstWait = 0;
let lookRight = 0.75;
let secondWait = 0;
let reset = 0.75;

// Head movement
let headRotate = 0.35;
let variation = new THREE.Vector3(0, 0, 0);

// Head offset (micro variation)
let headOffsetCurrent = { x: 0, y: 0 };
let headOffsetTarget = { x: 0, y: 0 };
let headOffsetStartTime = 0;
let headOffsetChance = 0.45;

// Blink offset
let blinkOffsetTarget = 0;
let blinkOffsetStartTime = 0;
let blinkOffsetCurrent = 0;
let blinkOffsetChance = 0.35;
let blinkOffsetReset = false;

// Constants for smoothing
const headEaseDuration = 1.5;
const blinkEaseDuration = 1;

// Change timers
let lastLookChange = 0;
let lastBlinkChange = 0;

// ===============================
// Animation Definition
// ===============================
export const AFK1: AnimationData = {
	init: () => {
		// Reset timers & state on start
		lastLookChange = 0;
		lastBlinkChange = 0;

		// Randomize timing and head sweep each loop
		firstWait = 2 + Math.random() * 3;
		secondWait = 2 + Math.random() * 3;
		headRotate = 0.15 + Math.random() * 0.2;

		// Reset offsets
		headOffsetTarget = { x: 0, y: 0 };
		headOffsetCurrent = { x: 0, y: 0 };
		headOffsetChance = 0.45;

		// Reset blink
		blinkOffsetTarget = 0;
		blinkOffsetCurrent = 0;
		blinkOffsetChance = 0.35;
		blinkOffsetReset = false;

		// Reset look variation
		variation = new THREE.Vector3(0, 0, 0);

		// Return duration of a full cycle
		return lookLeft + firstWait + lookRight + secondWait + reset;
	},

	fn: (handler: AnimationHandler, t: number) => {
		// ===============================
		// 1. Base Head Sweep (Yaw & Pitch)
		// ===============================
		let headYaw = 0;
		let headPitch = 0;

		if (t < lookLeft) {
			// Sweep left
			const p = easeInOut(t / lookLeft);
			headYaw = -headRotate * p;
		} else if (t < lookLeft + firstWait) {
			// Hold left
			headYaw = -headRotate;
		} else if (t < lookLeft + firstWait + lookRight) {
			// Sweep right
			const p = easeInOut((t - (lookLeft + firstWait)) / lookRight);
			headYaw = -headRotate + p * (headRotate * 2);
			headPitch = 0.05 * (p <= 0.5 ? p : 1 - p);
		} else if (t < lookLeft + firstWait + lookRight + secondWait) {
			// Hold right
			headYaw = headRotate;
		} else if (t < lookLeft + firstWait + lookRight + secondWait + reset) {
			// Reset to center
			const p = easeInOut(
				(t - (lookLeft + firstWait + lookRight + secondWait)) / reset
			);
			headYaw = headRotate - p * headRotate;
		}

		// Apply head yaw/pitch
		handler.head.rotation.y += headYaw;
		handler.head.rotation.x += headPitch;

		// Small body sway following head
		handler.spine.rotation.y += headYaw * 0.25;
		handler.hips.rotation.y += headYaw * 0.25 * 0.25;

		// ===============================
		// 2. Micro Head Offsets (Idle Drift)
		// ===============================
		const headT = Math.min(1, (t - headOffsetStartTime) / headEaseDuration);
		const headEaseFactor = easeInOut(headT);

		// Smoothly interpolate offset
		headOffsetCurrent.x +=
			(headOffsetTarget.x - headOffsetCurrent.x) * headEaseFactor;
		headOffsetCurrent.y +=
			(headOffsetTarget.y - headOffsetCurrent.y) * headEaseFactor;

		// Apply offset
		handler.head.rotation.x += headOffsetCurrent.x;
		handler.head.rotation.y += headOffsetCurrent.y;

		// ===============================
		// 3. Blinking Offset
		// ===============================
		const blinkT = Math.min(
			1,
			(t - blinkOffsetStartTime) / blinkEaseDuration
		);
		const blinkEaseFactor = easeInOut(blinkT);

		blinkOffsetCurrent +=
			(blinkOffsetTarget - blinkOffsetCurrent) * blinkEaseFactor;

		// Apply blink only if it's stronger than base animation
		if (
			handler.vrm.animation &&
			handler.vrm.animation.expressions[VRMExpressionPresetName.Blink] &&
			handler.vrm.animation.expressions[VRMExpressionPresetName.Blink]!
				.value <= blinkOffsetCurrent
		) {
			handler.vrm.animation.expressions[
				VRMExpressionPresetName.Blink
			]!.value = blinkOffsetCurrent;
		}

		// ===============================
		// 4. Look Target Variation
		// ===============================
		let look: THREE.Vector3;
		if (t < lookLeft + firstWait) {
			look = new THREE.Vector3(-0.3, -0.25, 1); // look left
		} else {
			look = new THREE.Vector3(0.3, -0.25, 1); // look right
		}

		// While holding, introduce random idle variations
		if (t < lookLeft + firstWait + lookRight + secondWait + reset / 2) {
			const headWorldPos = handler.head.bone.getWorldPosition(
				new THREE.Vector3()
			);
			const headQuat = handler.head.bone.getWorldQuaternion(
				new THREE.Quaternion()
			);

			// Candidate variations for idle drift
			const variations = [
				new THREE.Vector3(0, 0, 0), // forward
				new THREE.Vector3(-0.25, 0, 0), // right
				new THREE.Vector3(0.25, 0, 0), // left
				new THREE.Vector3(0, 0.15, 0), // up
				new THREE.Vector3(0, -0.15, 0), // down
				new THREE.Vector3(-0.25, 0.15, 0), // up-right
				new THREE.Vector3(0.25, 0.15, 0), // up-left
				new THREE.Vector3(-0.25, -0.15, 0), // down-right
				new THREE.Vector3(0.25, -0.15, 0), // down-left
			];

			// Decide whether to trigger new variation / blink
			if (
				(lookLeft + 0.15 < t && t < lookLeft + firstWait - 0.5) ||
				(lookLeft + firstWait + lookRight + 0.15 < t &&
					t < lookLeft + firstWait + lookRight + secondWait - 0.5)
			) {
				// Random head micro offset
				if (t > lastLookChange) {
					lastLookChange = t + 1 + Math.random();
					variation =
						variations[
							Math.floor(Math.random() * variations.length)
						]!;
					if (Math.random() < headOffsetChance) {
						headOffsetTarget = {
							x: variation.y * -0.125,
							y: variation.x * 0.125,
						};
						headOffsetStartTime = t;
						headOffsetChance = 0.45;
					} else {
						headOffsetChance +=
							(1 - headOffsetChance) * Math.random();
					}
				}

				// Random blink
				if (t > lastBlinkChange) {
					lastBlinkChange = t + 0.5 + Math.random();
					if (Math.random() < blinkOffsetChance) {
						blinkOffsetTarget = Math.random() * 0.1;
						blinkOffsetStartTime = t;
						blinkOffsetChance = 0.35;
					} else {
						blinkOffsetChance +=
							(1 - blinkOffsetChance) * Math.random();
					}
				}
			}

			// Reset blink + head if sweeping
			if (
				(lookLeft + firstWait + 0.2 < t &&
					t < lookLeft + firstWait + lookRight - 0.2) ||
				lookLeft + firstWait + lookRight + secondWait + 0.2 < t
			) {
			headOffsetTarget.x *= 0.9;
			headOffsetTarget.y *= 0.9;
				blinkOffsetTarget *= 0.9;
				if (!blinkOffsetReset) {
					blinkOffsetStartTime = t;
					blinkOffsetReset = true;
				}
			}

			// Apply variation to look vector
			look.add(variation);
			const final = look.applyQuaternion(headQuat).normalize();
			const finalPos = headWorldPos.clone().add(final.multiplyScalar(3));

			handler.lookTarget = {
				target: finalPos,
				clamped: false,
			};
		}
	},

	// Default cycle duration
	duration: 6,
};
