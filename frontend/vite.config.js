import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const rootDomain = env.VITE_ROOT_DOMAIN || env.SAAS_ROOT_DOMAIN || "";
  const allowedHosts = ["localhost", "127.0.0.1"];

  if (rootDomain) {
    allowedHosts.push(rootDomain, `.${rootDomain}`);
  }

  return {
    plugins: [react()],
    server: {
      allowedHosts,
      watch: {
        usePolling: true,
        interval: 300,
      },
    },
  };
});
