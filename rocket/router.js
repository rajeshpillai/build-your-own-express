import { run } from './chain.js';

// Step 8 — when two routes match, one of them has to win.
//
// /users/me matches both `/users/me` and `/users/:id`, and the application means
// different things by them. Something must decide, and the something is worth
// choosing deliberately rather than inheriting from the order of a for loop.

// Step 23 — the verbs live here now, not on the application.
//
// An application had app.get because the application owned the only table. A
// router that can be created on its own needs the same methods for the same
// reason, and the application's are now a thin pass-through to one of these.
export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export class Router {
  constructor() {
    this.routes = [];

    // Generated in the constructor rather than on the prototype, because each one
    // closes over this router. A prototype method would work and would depend on
    // `this` at every call site, which is one more thing to get wrong.
    for (const method of METHODS) {
      this[method.toLowerCase()] = (path, ...handlers) => {
        this.add(method, path, handlers);
        return this;
      };
    }
  }

  // Step 23 — a router is now shaped like a layer: (req, res, next).
  //
  // That one decision is what makes mounting possible. Anything with this shape
  // can be handed to app.use, so a router stops being a private detail of the
  // application and becomes something you build separately and plug in.
  //
  // Calling next() when nothing matches is what makes it composable: two routers
  // can be tried in turn, and the second sees what the first declined.
  async handle(req, res, next) {
    const match = this.find(req.method, req.path);
    if (!match) return next();

    req.params = match.params;

    try {
      await run(match.route.handlers, req, res);
    } catch (error) {
      return next(error);
    }

    // Every layer called next and none of them answered, so the route declined.
    // The request carries on rather than hanging.
    if (!res.writableEnded) next();
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
