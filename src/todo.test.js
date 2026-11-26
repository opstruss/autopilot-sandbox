import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { addTodo, removeTodo, toggleTodo } from "./todo.js";
import { start } from "./server.js";

test("add trims title and rejects empty", () => {
  const todos = addTodo([], "  buy milk  ", "a");
  assert.deepEqual(todos, [{ id: "a", title: "buy milk", done: false }]);
  assert.throws(() => addTodo(todos, "  "), { code: "BAD_TITLE" });
});

test("toggle and remove", () => {
  const todos = addTodo([], "one", "a");
  assert.equal(toggleTodo(todos, "a")[0].done, true);
  assert.throws(() => toggleTodo(todos, "missing"), { code: "NOT_FOUND" });
  assert.deepEqual(removeTodo(todos, "a"), []);
  assert.throws(() => removeTodo(todos, "missing"), { code: "NOT_FOUND" });
});

test("http add, toggle, delete", async () => {
  const dir = await mkdtemp(join(tmpdir(), "todo-"));
  const app = await start({ file: join(dir, "todos.json") });
  try {
    const created = await fetch(`http://127.0.0.1:${app.port}/api/todos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "ship" }),
    });
    assert.equal(created.status, 201);
    const todo = await created.json();
    assert.equal(todo.title, "ship");
    assert.equal(todo.done, false);

    const toggled = await fetch(`http://127.0.0.1:${app.port}/api/todos/${todo.id}/toggle`, {
      method: "POST",
    });
    assert.equal(toggled.status, 200);
    assert.equal((await toggled.json()).find((item) => item.id === todo.id).done, true);

    const removed = await fetch(`http://127.0.0.1:${app.port}/api/todos/${todo.id}`, {
      method: "DELETE",
    });
    assert.equal(removed.status, 200);
    assert.deepEqual(await removed.json(), []);

    const page = await fetch(`http://127.0.0.1:${app.port}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Todo/);
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
