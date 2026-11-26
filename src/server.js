import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addTodo, removeTodo, toggleTodo } from "./todo.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = join(root, "public", "index.html");

export function createApp(file) {
  let chain = Promise.resolve();

  function update(fn) {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => {},
      () => {},
    );
    return run;
  }

  async function readTodos() {
    try {
      const data = JSON.parse(await readFile(file, "utf8"));
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (err.code === "ENOENT") return [];
      throw err;
    }
  }

  async function writeTodos(todos) {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(todos, null, 2) + "\n");
    return todos;
  }

  return function handle(req, res) {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      readFile(page)
        .then((body) => send(res, 200, body, "text/html; charset=utf-8"))
        .catch((err) => fail(res, err));
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/todos") {
      readTodos()
        .then((todos) => send(res, 200, JSON.stringify(todos), "application/json"))
        .catch((err) => fail(res, err));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/todos") {
      readBody(req)
        .then((body) =>
          update(async () => {
            const todos = addTodo(await readTodos(), body.title, randomUUID());
            return writeTodos(todos);
          }),
        )
        .then((todos) => send(res, 201, JSON.stringify(todos.at(-1)), "application/json"))
        .catch((err) => fail(res, err));
      return;
    }
    const toggle = url.pathname.match(/^\/api\/todos\/([^/]+)\/toggle$/);
    if (req.method === "POST" && toggle) {
      update(async () => writeTodos(toggleTodo(await readTodos(), decodeURIComponent(toggle[1]))))
        .then((todos) => send(res, 200, JSON.stringify(todos), "application/json"))
        .catch((err) => fail(res, err));
      return;
    }
    const one = url.pathname.match(/^\/api\/todos\/([^/]+)$/);
    if (req.method === "DELETE" && one) {
      update(async () => writeTodos(removeTodo(await readTodos(), decodeURIComponent(one[1]))))
        .then((todos) => send(res, 200, JSON.stringify(todos), "application/json"))
        .catch((err) => fail(res, err));
      return;
    }
    send(res, 404, JSON.stringify({ error: "not found" }), "application/json");
  };
}

export function start({ file, port = 0, host = "127.0.0.1" } = {}) {
  const server = createServer(createApp(file));
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const address = server.address();
      resolve({
        server,
        port: address.port,
        close: () => new Promise((done, failClose) => server.close((err) => (err ? failClose(err) : done()))),
      });
    });
  });
}

function send(res, status, body, type) {
  res.writeHead(status, { "content-type": type });
  res.end(body);
}

function fail(res, err) {
  const status = err.code === "BAD_TITLE" ? 400 : err.code === "NOT_FOUND" ? 404 : 500;
  send(res, status, JSON.stringify({ error: err.message }), "application/json");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1e5) {
        reject(Object.assign(new Error("body too large"), { code: "BAD_TITLE" }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error("invalid json"), { code: "BAD_TITLE" }));
      }
    });
    req.on("error", reject);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.env.TODO_FILE || join(root, "data", "todos.json");
  const port = Number(process.env.PORT || 8787);
  start({ file, port }).then(({ port: bound }) => {
    console.log(`http://127.0.0.1:${bound}`);
  });
}
