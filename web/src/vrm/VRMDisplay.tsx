import React, { useEffect, useState, useRef, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { VRMUtils } from "@pixiv/three-vrm";
import { VRMContext } from "./VRMDisplayContext";
import { VRMInstance } from "./VRMInstance";
import {
	EffectComposer,
	Pass,
} from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { SSAARenderPass } from "three/examples/jsm/postprocessing/SSAARenderPass";
import { TAARenderPass } from "three/examples/jsm/postprocessing/TAARenderPass";
import { FXAAPass } from "three/examples/jsm/postprocessing/FXAAPass";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass";
import Stats from "three/examples/jsm/libs/stats.module";

export default function VRMDisplay({
	children,
}: {
	children?: React.ReactNode;
}) {
	const mountRef = useRef<HTMLDivElement>(null);
	const [showContainer, setShowContainer] = useState(false);
	const [statusMessage, setStatusMessage] = useState(
		"Please choose a VRM file to view."
	);

	const rendererRef = useRef(
		new THREE.WebGLRenderer({
			precision: "highp",
			antialias: true,
			powerPreference: "high-performance"
		})
	);
	const composerPassRef = useRef<Pass | null>(null);
	const composerRef = useRef<EffectComposer | null>(null);
	const mixerRef = useRef<THREE.AnimationMixer | null>(null);
	const sceneRef = useRef(new THREE.Scene());
	const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
	const controlsRef = useRef<OrbitControls | null>(null);
	const clockRef = useRef(new THREE.Clock());
	const mouseRef = useRef({
		x: window.innerWidth / 2,
		y: window.innerHeight / 2,
	});
	const hipYRef = useRef(0);
	const camYRef = useRef(0);
	const animatedRef = useRef(0);
	const tRef = useRef(0);
	const vrmRef = useRef(
		new VRMInstance(
			rendererRef,
			composerRef,
			sceneRef,
			mixerRef,
			cameraRef,
			controlsRef,
			mouseRef,
			tRef,
			animatedRef,
			hipYRef,
			camYRef,
			setStatusMessage,
			showContainer,
			setShowContainer
		)
	);
	const statsRef = useRef(new Stats());

	const handleResetCamera = useCallback(() => {
		if (cameraRef.current && controlsRef.current) {
			cameraRef.current.position.set(0, camYRef.current, 1.75);
			controlsRef.current.target.set(0, camYRef.current, 0);
		}
	}, []);

	useEffect(() => {
		const mountNode = mountRef.current;
		if (!mountNode) return;
		console.log("VRM Display setup");

		// -- Basic Scene Setup (runs once) --
		sceneRef.current.background = new THREE.Color(0xa0cee8);
		cameraRef.current = new THREE.PerspectiveCamera(
			35,
			window.innerWidth / window.innerHeight,
			0.1,
			1000
		);
		cameraRef.current.position.set(0, camYRef.current, 1.75);

		rendererRef.current.setPixelRatio(window.devicePixelRatio * 1.5);
		rendererRef.current.setSize(
			window.innerWidth,
			window.innerHeight,
			false
		);
		rendererRef.current.shadowMap.enabled = true;
		mountNode.appendChild(rendererRef.current.domElement);

		composerRef.current = new EffectComposer(rendererRef.current);

		// const ssaaRenderPass = new SSAARenderPass(
		// 	sceneRef.current,
		// 	cameraRef.current
		// );
		// ssaaRenderPass.sampleLevel = 2;
		// ssaaRenderPass.unbiased = true;
		// composerPassRef.current = ssaaRenderPass;

		// const taaRenderPass = new TAARenderPass(
		// 	sceneRef.current,
		// 	cameraRef.current
		// );
		// taaRenderPass.sampleLevel = 1;
		// composerPassRef.current = taaRenderPass;

		const fxaaPass = new FXAAPass();
				const renderPass = new RenderPass( sceneRef.current, cameraRef.current );
		composerRef.current.addPass(renderPass);
		composerPassRef.current = fxaaPass;

		if (composerPassRef.current) {
			composerPassRef.current.setSize(
				window.innerWidth,
				window.innerHeight
			);
			composerRef.current.addPass(composerPassRef.current);
		}
		const outputPass = new OutputPass();
		composerRef.current.addPass(outputPass);

		composerRef.current.setSize(window.innerWidth, window.innerHeight);

		const ambientLight = new THREE.AmbientLight(0xffffff, 1.7);
		sceneRef.current.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 1.15);
		directionalLight.position.set(10, 2.125, 0);
		directionalLight.target.position.set(0, 1, 0);
		directionalLight.castShadow = true;
		sceneRef.current.add(directionalLight);

		controlsRef.current = new OrbitControls(
			cameraRef.current,
			rendererRef.current.domElement
		);
		controlsRef.current.target.set(0, camYRef.current, 0);
		controlsRef.current.enableZoom = false;
		controlsRef.current.enablePan = false;
		controlsRef.current.enableRotate = false;
		controlsRef.current.update();

		// -- Animation Loop --
		let animationFrameId: number;
		const animate = () => {
			const deltaTime = clockRef.current.getDelta();
			tRef.current += deltaTime;
			animationFrameId = requestAnimationFrame(animate);
			vrmRef.current?.animate(deltaTime);
			statsRef.current?.end();
		};
		animate();

		// -- Event Listeners --
		const handleResize = () => {
			if (cameraRef.current) {
				cameraRef.current.aspect =
					window.innerWidth / window.innerHeight;
				cameraRef.current.updateProjectionMatrix();
			}
			rendererRef.current.setSize(window.innerWidth, window.innerHeight);
			composerRef.current?.setSize(window.innerWidth, window.innerHeight);
			composerPassRef.current?.setSize(
				window.innerWidth,
				window.innerHeight
			);
		};

		const handleMouseMove = (event: MouseEvent) => {
			mouseRef.current.x = event.clientX;
			mouseRef.current.y = event.clientY;
			vrmRef.current.lastMoveTime = Date.now();
			if (vrmRef.current.animation) vrmRef.current.animation.afk = false;
		};

		window.addEventListener("resize", handleResize);
		window.addEventListener("mousemove", handleMouseMove);

		// -- Cleanup on unmount --
		return () => {
			cancelAnimationFrame(animationFrameId);
			window.removeEventListener("resize", handleResize);
			window.removeEventListener("mousemove", handleMouseMove);
			if (mountNode) {
				mountNode.removeChild(rendererRef.current.domElement);
			}
			if (vrmRef.current && vrmRef.current.instance) {
				VRMUtils.deepDispose(vrmRef.current.instance.scene);
			}
			sceneRef.current.remove(ambientLight);
			sceneRef.current.remove(directionalLight);
			ambientLight.dispose?.();
			directionalLight.dispose?.();
			rendererRef.current.dispose();
			composerRef.current?.dispose();
			composerPassRef.current?.dispose();
		};
	}, []);
	return (
		<VRMContext.Provider
			value={{
				statusMessage,
				showContainer,
				handleResetCamera,
				vrm: vrmRef.current,
				stats: statsRef.current,
			}}
		>
			<div
				ref={mountRef}
				id="container"
				style={{ display: showContainer ? "unset" : "none" }}
			/>
			{children}
		</VRMContext.Provider>
	);
}
