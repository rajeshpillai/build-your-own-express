// Step 5 — a colon means "anything goes here".
//
// Exact string comparison got us three routes and then stopped. `/users/1` and
// `/users/2` are not two routes, they are one route with a hole in it, and until
// the router understands that, an application needs one registration per user.

export class Router {
  constructor() {
    // Deliberately a plain array of plain objects. You can print it, and printing
    // your own route table is the fastest way to understand any framework.
    this.routes = [];
  }

  add(method, path, handler) {
    this.routes.push({ method, path, handler });
  }

  // Split on the slash and compare token by token. A token beginning with a colon
  // matches whatever is in that position; anything else has to match exactly.
  //
  // The length check first is not an optimisation, it is the rule: /users/1/edit is
  // three tokens and /users/:id is two, so they are different routes no matter what
  // the tokens say. Without it, a shorter pattern would match a longer path.
  find(method, path) {
    const url = split(path);

    return this.routes.find((route) => {
      if (route.method !== method) return false;

      const pattern = split(route.path);
      if (pattern.length !== url.length) return false;

      return pattern.every(
        (token, i) => token.startsWith(':') || token === url[i],
      );
    });
  }
}

// filter(Boolean) drops the empty strings that a leading, trailing or doubled slash
// leaves behind, so '/users/' and '/users' tokenise identically. Which is what
// somebody typing a URL expects, and it costs one call to get right.
function split(path) {
  return path.split('/').filter(Boolean);
}
