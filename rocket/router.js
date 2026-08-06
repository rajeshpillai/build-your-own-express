// Step 8 — when two routes match, one of them has to win.
//
// /users/me matches both `/users/me` and `/users/:id`, and the application means
// different things by them. Something must decide, and the something is worth
// choosing deliberately rather than inheriting from the order of a for loop.

export class Router {
  constructor() {
    this.routes = [];
  }

  // Step 19 — a route is a list of layers, not a single handler. One entry is the
  // common case and it is the same code path, which is why nothing that registered
  // a lone handler in earlier steps had to change.
  add(method, path, handlers) {
    this.routes.push({ method, path, handlers });
  }

  // Returns { route, params } rather than just the route. A caller that only wanted
  // to know whether something matched can ignore the second half; a caller that
  // needs the values does not have to walk the tokens a second time to get them.
  // FIRST REGISTERED WINS, and that is a decision rather than an accident.
  //
  // The alternative is to score routes and prefer the most specific — fewest
  // colons, longest literal prefix — which sounds better until you have two routes
  // of equal score and are back to needing a tiebreak. Registration order is a rule
  // an author can see in their own file, and it is what Express does.
  //
  // The cost is real: put /users/:id above /users/me and /users/me is unreachable,
  // with nothing to warn you. That is the trade, and it is why the order of a route
  // file is part of its meaning rather than a matter of taste.
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
