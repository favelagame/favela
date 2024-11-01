import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import swc from "unplugin-swc";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
    plugins: [
        swc.vite({ minify: true }),
        swc.rollup({ minify: true }),
        visualizer({
            emitFile: true,
            filename: "stats.html",
        }),
    ],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
});
