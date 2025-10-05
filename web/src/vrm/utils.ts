import * as THREE from "three";

export function screenToWorld(
	mouse: { x: number; y: number },
	camera: THREE.Camera
) {
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

export function clampLookTarget(
	target: THREE.Vector3,
	head: THREE.Object3D,
	hips: THREE.Object3D,
    afkAnimating: boolean,
	maxYaw: number = THREE.MathUtils.degToRad(50), // in radians
	maxPitch: number = THREE.MathUtils.degToRad(20),
	minPitch: number = THREE.MathUtils.degToRad(-40)
) {
    const headPos = head.getWorldPosition(new THREE.Vector3());

	// Quaternions
	const headQuat = head.getWorldQuaternion(new THREE.Quaternion());
	const hipsQuat = hips.getWorldQuaternion(new THREE.Quaternion());

	// Reference for clamping = hips (or world forward if AFK)
	const referenceQuat = afkAnimating
		? new THREE.Quaternion()
		: hipsQuat;

	// Direction head → target
	const dir = target.clone().sub(headPos).normalize();

	// Transform dir into hips-local space (so clamp is hips-relative)
	const localDir = dir.clone().applyQuaternion(referenceQuat.clone().invert());

	const yaw = Math.atan2(localDir.x, localDir.z);
	const pitch = Math.asin(localDir.y);

	if (Math.abs(yaw) > maxYaw || pitch > maxPitch || pitch < minPitch) {
		// Outside limits → clamp forward but using headQuat for *final look direction*
		const headForward = new THREE.Vector3(0, -0.25, 1).applyQuaternion(headQuat);
		return {
			target: headPos.clone().add(headForward.multiplyScalar(10)),
			clamped: true,
		};
	}

	return { target, clamped: false };
}
