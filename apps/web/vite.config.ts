import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": "/src",
		},
	},
	server: {
		proxy: {
			"/api": "http://127.0.0.1:3001",
			"/mcp": "http://127.0.0.1:3001",
			"/ws": { target: "ws://127.0.0.1:3001", ws: true },
		},
	},
});
