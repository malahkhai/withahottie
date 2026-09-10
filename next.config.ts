import { stripeConfig } from "./lib/stripe/config";
import type { NextConfig } from "next";
import { getSupabaseConfig } from "./lib/supabase/config";
// Fail before bundling if a privileged key was assigned to a public variable.
getSupabaseConfig();
stripeConfig();
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default nextConfig;
