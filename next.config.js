/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,

  experimental: {
    // Loaded at runtime on the server — webpack must not bundle these.
    serverComponentsExternalPackages: [
      "@prisma/client", ".prisma/client", "@prisma/adapter-pg", "pg",
      "pdf-lib", "@pdf-lib/fontkit", "pdfjs-dist",
    ],

    // Serverless functions only ship files the tracer can see.
    //
    // The schema sets engineType = "client", so queries run through Prisma's
    // WebAssembly compiler (query_compiler_bg.wasm). Because @prisma/client is
    // marked external above, webpack never touches it and the tracer cannot
    // follow the runtime require, so the .wasm is left out of the bundle and
    // every query fails with ENOENT. Include the generated client explicitly.
    //
    // The PO generator reads its fonts with fs.readFileSync, same problem.
    outputFileTracingIncludes: {
      "/**": [
        "./node_modules/.prisma/client/**",
        "./node_modules/@prisma/client/**",
      ],
      "/api/po/[id]": ["./public/fonts/**"],
    },

    // Documents are posted to server actions; the 1 MB default is too small for
    // a multi-page scanned packing slip or booking confirmation.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};
