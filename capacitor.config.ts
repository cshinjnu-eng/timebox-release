import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.timebox.app",
  appName: "TimeBox",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#0B0D14",
    },
  },
};

export default config;
