export function addTodo(todos, title, id) {
  const text = String(title ?? "").trim();
  if (!text) {
    const err = new Error("title required");
    err.code = "BAD_TITLE";
    throw err;
  }
  return [...todos, { id, title: text, done: false }];
}

export function toggleTodo(todos, id) {
  let found = false;
  const next = todos.map((todo) => {
    if (todo.id !== id) return todo;
    found = true;
    return { ...todo, done: !todo.done };
  });
  if (!found) {
    const err = new Error("not found");
    err.code = "NOT_FOUND";
    throw err;
  }
  return next;
}

export function removeTodo(todos, id) {
  const next = todos.filter((todo) => todo.id !== id);
  if (next.length === todos.length) {
    const err = new Error("not found");
    err.code = "NOT_FOUND";
    throw err;
  }
  return next;
}
