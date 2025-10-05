import { defineConfig, loadEnv } from "vite";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "SVR_");
	return {
		root: resolve(__dirname),
		publicDir: "public",
		envPrefix: "SVR_",
		envDir: process.cwd(),
		build: {
			rolldownOptions: {
				treeshake: true,
				output: {
					advancedChunks: {
						groups: [
							{
								name: (moduleId) => {
									if (moduleId.includes("socket.io"))
										return "sio";
								},
								maxSize: 1000 * 1024,
							},
							{
								name: (moduleId) => {
									if (moduleId.includes("@pixiv/three-vrm"))
										return "vrm";
								},
								maxSize: 1000 * 1024,
							},
							{
								name: (moduleId) => {
									if (moduleId.includes("/three/"))
										return "threejs";
								},
								maxSize: 1000 * 1024,
							},
							{
								name: (moduleId) => {
									if (moduleId.includes("node_modules"))
										return "pkgs";
								},
								maxSize: 1000 * 1024,
							},
							{
								name: "app",
								maxSize: 1000 * 1024,
							},
						],
					},
				},
			},
			chunkSizeWarningLimit: 2000,
		},
		server: {
			port: env?.SVR_PORT ? Number(env.SVR_PORT) + 1 : 20001,
			strictPort: true,
		},
	};
});
