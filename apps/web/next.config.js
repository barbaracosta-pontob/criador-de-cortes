/** @type {import('next').NextConfig} */
// Suprime o detector de lockfile do Next.js que falha em monorepos npm workspaces
process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = "1";

const path = require("path");

// Carrega o .env da raiz do monorepo (dois níveis acima de apps/web).
require("dotenv").config({ path: path.resolve(__dirname, "../../.env"), override: false });

const nextConfig = {
  transpilePackages: ["@pontob/cut-schema"],

  // Aulas de até 40min podem passar de 1GB. Sem isso, o upload é cortado.
  experimental: {
    serverActions: { bodySizeLimit: "4gb" },
  },

  webpack(config) {
    // Garante que @pontob/cut-schema resolve para o pacote do monorepo,
    // mesmo importado de fora de apps/web (ex: services/analysis).
    config.resolve.alias = {
      ...config.resolve.alias,
      "@pontob/cut-schema": path.resolve(__dirname, "../../packages/schema/cuts.ts"),
    };
    return config;
  },
};

module.exports = nextConfig;
