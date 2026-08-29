/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,

  experimental: {
    // Loaded at runtime on the server — webpack must not bundle these.
    //
    // nodemailer is here for the same reason as the rest: it resolves its
    // transports and auth plugins with dynamic requires that webpack can't
    // follow, so bundling it either fails the build or produces a module that
    // throws on first use.
    serverComponentsExternalPackages: [
      "@prisma/client", ".prisma/client", "@prisma/adapter-pg", "pg",
      "pdf-lib", "@pdf-lib/fontkit", "pdfjs-dist",
      "nodemailer", "exceljs",
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
      // The PO route reads the fonts, the logo and the approval stamp off disk
      // at request time.
      "/api/po/[id]": ["./public/fonts/**", "./public/logo-mark-blue-512.png", "./public/stamp-approved.png"],
      // The Purchase page hosts the "email this PO" server action, which
      // renders the very same PDF to attach it — so that function needs the
      // same files. Easy to miss: the action isn't a route, it's bundled into
      // whichever page imports it.
      "/purchase": ["./public/fonts/**", "./public/logo-mark-blue-512.png", "./public/stamp-approved.png"],
      // The shipment export does the same for its letterhead — the PDF needs
      // the fonts, both formats need the logo.
      "/api/export/bookings": ["./public/fonts/**", "./public/logo-mark-blue-512.png"],
    },

    // Documents are posted to server actions; the 1 MB default is too small for
    // a multi-page scanned packing slip or booking confirmation.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};
