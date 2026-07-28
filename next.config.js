/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,

  experimental: {
    // Loaded at runtime on the server — webpack must not bundle these.
    serverComponentsExternalPackages: [
      "@prisma/client", ".prisma/client", "@prisma/adapter-pg", "pg",
      "pdf-lib", "@pdf-lib/fontkit", "pdfjs-dist",
    ],

    // Serverless functions only ship files the tracer can see. The PO generator
    // reads these fonts with fs.readFileSync, so include them explicitly.
    outputFileTracingIncludes: {
      "/api/po/[id]": ["./public/fonts/**"],
    },

    // Documents are posted to server actions; the 1 MB default is too small for
    // a multi-page scanned packing slip or booking confirmation.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};
