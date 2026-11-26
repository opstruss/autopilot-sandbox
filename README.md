# autopilot-sandbox

Todo app used as the OpsTruss autopilot sandbox. Node 22, no dependencies.

```sh
node --test
node src/server.js   # http://127.0.0.1:8787
```

Todos are stored in `data/todos.json` (gitignored). `TODO_FILE` and `PORT` override the path and port.

GitHub Actions job `test` (workflow CI) is the required status check on `main`.
