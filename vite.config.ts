import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "child_process";

// https://vitejs.dev/config/
const lastCommit = execSync("git log -1 --format=%cd").toString().trim();

export default defineConfig({
  plugins: [react()],
  define: {
    __LAST_COMMIT_DATE__: JSON.stringify(lastCommit),
  },
});
