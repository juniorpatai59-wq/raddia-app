import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// ⚠️ IMPORTANT : "base" doit correspondre au nom exact de votre dépôt GitHub.
// Exemple : si votre dépôt s'appelle "raddia-app" et que l'URL est
// https://VOTRE-PSEUDO.github.io/raddia-app/  →  base: "/raddia-app/"
// Si vous renommez le dépôt, changez cette ligne en conséquence.
export default defineConfig({
  base: "/raddia-app/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "RADDIA — Gestionnaire",
        short_name: "RADDIA",
        description: "Pilotage temps réel des bornes de charge RADDIA",
        theme_color: "#07070f",
        background_color: "#07070f",
        display: "standalone",
        start_url: "/raddia-app/",
        scope: "/raddia-app/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
