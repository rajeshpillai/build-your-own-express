// Step 3 — a route table.
//
// The if/else chain from step 1 had two problems. The order of the branches was
// load-bearing, and adding a route meant editing the function that serves every
// request. A table fixes both: registering is data, matching is a lookup.

export class Router {
  constructor() {
    // Deliberately a plain array of plain objects. You can print it, and printing
    // your own route table is the fastest way to understand any framework.
    this.routes = [];
  }

  add(method, path, handler) {
    this.routes.push({ method, path, handler });
  }

  // Exact string comparison, and nothing more. `/users/1` does not match
  // `/users/:id` yet — there is no such thing as `:id` until step 5.
  find(method, path) {
    return this.routes.find(
      (route) => route.method === method && route.path === path,
    );
  }
}
