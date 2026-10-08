# media-manager-2

Use Node.js 22.13 or newer. Node may print an experimental SQLite warning at
startup because its built-in SQLite module is still marked experimental.

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
`DB_PATH` sets the SQLite database location. It defaults to
`~/.local/share/media-manager-2/media-manager.sqlite`. The path must be
absolute, outside the application directory, and inside a directory owned by
the current user with no group or other access. A new directory uses mode
`0700`, and a new database file uses mode `0600`.

The server initializes the database before listening. If initialization fails,
it prints `Database initialization failed.` and exits unsuccessfully. Credential
values stay in the private database and are read or changed only by server
functions.

The server prints its listening address after database initialization succeeds.

Use `npm run dev` for the Vite development server.
Always build and test through `scripts/build.sh` and `scripts/test.sh`.
`sh scripts/test.sh --production` checks an existing build without rebuilding.
`sh scripts/test.sh --review-script` checks the review script.
Additional test-runner arguments can follow `--full` or `--production`.

shadcn/ui with Base UI and TanStack Table are configured for later features.
Product screens and styling are pending; the heading checks that React starts.
