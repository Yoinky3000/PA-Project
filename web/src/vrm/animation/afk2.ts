import { VRMExpressionPresetName } from "@pixiv/three-vrm";
import { AnimationData, AnimationHandler } from "../AnimationHandler";
import * as THREE from "three";

function easeInOut(t: number) {
	return -(Math.cos(Math.PI * t) - 1) / 2;
}
const raise = 1;
const firstHold = 2.0;
const rotate = 0.8;
const secondHold = 2.0;
const reset = 1.5;

let blinkOffset = 0;

export const AFK2: AnimationData = {
	init: () => {
		blinkOffset = 0;
		return raise + firstHold + rotate + secondHold + reset;
	},
	fn: (handler: AnimationHandler, t: number) => {
		// bones
		const shoulder = handler.leftShoulder.rotation;
		const upper = handler.leftUpperArm.rotation;
		const lower = handler.leftLowerArm.rotation;
		const head = handler.head.rotation;

		if (t < raise) {
			const p = easeInOut(t / raise);
			shoulder.x += -Math.PI * 0.05 * p;

			upper.y += Math.PI * 0.1 * p;

			lower.x += Math.PI * 0.55 * p;
			lower.y += -Math.PI * 0.6 * p;
			lower.z += Math.PI * 0.5 * p;
			blinkOffset = p * 0.15;
		} else if (t < raise + firstHold) {
			shoulder.x += -Math.PI * 0.05;

			upper.y += Math.PI * 0.1;

			lower.x += Math.PI * 0.55;
			lower.y += -Math.PI * 0.6;
			lower.z += Math.PI * 0.5;
		} else if (t < raise + firstHold + rotate) {
			const p = easeInOut((t - (raise + firstHold)) / rotate);
			shoulder.x += -Math.PI * 0.05;

			upper.y += Math.PI * 0.1 + Math.PI * -0.2 * p;

			lower.x += Math.PI * 0.55;
			lower.y += -Math.PI * 0.6 + Math.PI * 0.375 * p;
			lower.z += Math.PI * 0.5;
		} else if (t < raise + firstHold + rotate + secondHold) {
			shoulder.x += -Math.PI * 0.05;

			upper.y += Math.PI * -0.1;

			lower.x += Math.PI * 0.55;
			lower.y += -Math.PI * 0.225;
			lower.z += Math.PI * 0.5;
		} else if (t < raise + firstHold + rotate + secondHold + reset) {
			const p = easeInOut(
				(t - (raise + firstHold + rotate + secondHold)) / reset
			);
			shoulder.x += -Math.PI * 0.05 + Math.PI * 0.05 * p;

			upper.y += Math.PI * -0.1 + Math.PI * 0.1 * p;

			lower.x += Math.PI * 0.55 - Math.PI * 0.55 * p;
			lower.y += -Math.PI * 0.225 + Math.PI * 0.225 * p;
			lower.z += Math.PI * 0.5 - Math.PI * 0.5 * p;
			blinkOffset = 0.15 - p * 0.15;
		}

		if (t < raise) {
			const p = easeInOut(t / raise);

			head.x += Math.PI * 0.09 * p;
			head.y += Math.PI * 0.09 * p;
		} else if (t < raise + firstHold) {
			head.x += Math.PI * 0.09;
			head.y += Math.PI * 0.09;
		} else if (t < raise + firstHold + rotate) {
			const p = easeInOut((t - (raise + firstHold)) / rotate);
			head.x += Math.PI * 0.09;
			head.y += Math.PI * 0.09 + Math.PI * -0.02 * p;
		} else if (t < raise + firstHold + rotate + secondHold + reset / 3) {
			head.x += Math.PI * 0.09;
			head.y += Math.PI * 0.07;
		} else if (t < raise + firstHold + rotate + secondHold + reset) {
			const p = easeInOut(
				(t - (raise + firstHold + rotate + secondHold + reset / 3)) /
					((reset / 3) * 2)
			);
			head.x += Math.PI * 0.09 - Math.PI * 0.09 * p;
			head.y += Math.PI * 0.07 - Math.PI * 0.07 * p;
		}

		// === Look target ===
		if (
			raise / 2 < t &&
			t < raise + firstHold + rotate + secondHold + reset / 5
		) {
			const handPos = handler.leftHand?.bone.getWorldPosition(
				new THREE.Vector3()
			);
			if (handPos) {
				handler.lookTarget = { target: handPos, clamped: false };
			}
		}
		if (
			handler.vrm.animation &&
			handler.vrm.animation.expressions[VRMExpressionPresetName.Blink] &&
			handler.vrm.animation.expressions[VRMExpressionPresetName.Blink]!
				.value <= blinkOffset
		) {
			handler.vrm.animation.expressions[
				VRMExpressionPresetName.Blink
			]!.value = blinkOffset;
		}
	},
	duration: 8,
};
