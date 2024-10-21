import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import swc from "unplugin-swc"


export default defineConfig({
    plugins:[ 
    // Vite plugin
     swc.vite(),
     // Rollup plugin
     swc.rollup(),
   ],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    build: {
        target: 'ESNext'
    }
});
