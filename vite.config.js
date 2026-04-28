import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/fieldbook_app/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "FieldBook Offline",
        short_name: "FieldBook",
        description: "Offline field data collection app",
        theme_color: "#047857",
        background_color: "#f8fafc",
        display: "standalone",
        orientation: "portrait",
        start_url: "/fieldbook_app/",
        scope: "/fieldbook_app/",
        icons: [
          {
            src: "/fieldbook_app/icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/fieldbook_app/icon-512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"]
      }
    })
  ]
});