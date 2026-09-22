/** @type {import("next").NextConfig} */
const isDev = process.env.NODE_ENV === "development";

const nextConfig = {
  reactStrictMode: true,
  // O servidor de desenvolvimento usa um diretorio proprio para que um
  // "npm run build" executado em paralelo nunca sobrescreva os chunks que o
  // "next dev" ja carregou em memoria. Producao (build/start) continua em .next.
  distDir: isDev ? ".next-dev" : ".next",
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
