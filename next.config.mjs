/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/_next/static/css/0a0c1b725908b0cc.css",
          destination: "/api/stale-asset/css",
        },
        {
          source: "/_next/static/chunks/491-8a03098410fbe4ee.js",
          destination: "/api/stale-asset/js",
        },
        {
          source: "/_next/static/chunks/771-378f4f41b6215297.js",
          destination: "/api/stale-asset/js",
        },
        {
          source: "/_next/static/chunks/app/page-4b522155cfb1cfc8.js",
          destination: "/api/stale-asset/js",
        },
        {
          source: "/_next/static/chunks/app/page-a1a7fe6f39db28e4.js",
          destination: "/api/stale-asset/js",
        },
      ],
    };
  },
};

export default nextConfig;
