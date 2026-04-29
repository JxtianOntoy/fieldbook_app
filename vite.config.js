import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/fieldbook_app/",   // 🔥 THIS FIXES GITHUB PAGES
  plugins: [react()],
});