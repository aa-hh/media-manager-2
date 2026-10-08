# media-manager-2

Use Node.js 22.12 or newer.

```sh
npm ci
sh scripts/build.sh
sh scripts/test.sh
sh scripts/test.sh --full
npm start
```

Production runs the Hono server and serves the compiled React application.
Vite's preview server is not used in production.
`HOST` and `PORT` set the listening address and port; they default to
`127.0.0.1` and `3000`. `PORT=0` selects an available port.
The server prints its listening address when it starts.

Use `npm run dev` for the Vite development server.
Always build and test through `scripts/build.sh` and `scripts/test.sh`.
`sh scripts/test.sh --production` checks an existing build without rebuilding.
`sh scripts/test.sh --review-script` checks the review script.
Additional test-runner arguments can follow `--full` or `--production`.

shadcn/ui with Base UI and TanStack Table are configured for later features.
Product screens and styling are pending; the heading checks that React starts.
