// Step 6 — the matched values, handed to the handler.
//
// Step 5 could tell that /users/1 matched /users/:id. It threw away the one piece
// of information the handler actually wants: that `id` was "1". Matching and
// extracting are the same walk over the same tokens, so they happen together.

export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, path, handler) {
    this.routes.push({ method, path, handler });
  }

  // Returns { route, params } rather than just the route. A caller that only wanted
  // to know whether something matched can ignore the second half; a caller that
  // needs the values does not have to walk the tokens a second time to get them.
  find(method, path) {
    const url = split(path);

    for (const route of this.routes) {
      if (route.method !== method) continue;

      const pattern = split(route.path);
      if (pattern.length !== url.length) continue;

      const params = {};
      let matched = true;

      for (let i = 0; i < pattern.length; i++) {
        const token = pattern[i];
        if (token.startsWith(':')) {
          // slice(1) drops the colon. The name is whatever follows it, so
          // `/users/:userId` produces params.userId and not params[':userId'].
          params[token.slice(1)] = decodeURIComponent(url[i]);
        } else if (token !== url[i]) {
          matched = false;
          break;
        }
      }

      if (matched) return { route, params };
    }

    return undefined;
  }
}

function split(path) {
  return path.split('/').filter(Boolean);
}
