import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import ssrPlugin from "vite-ssr-components/plugin";

export default defineConfig({
  ssr: {
    external: ["react", "react-dom"],
  },
  plugins: [cloudflare(), ssrPlugin(), tailwindcss()],
});
