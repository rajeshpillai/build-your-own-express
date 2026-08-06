// Step 18 — the chain that gives next its meaning.
//
// Step 17 ran the stack with a for loop and handed every middleware a next that
// did nothing. Order worked, mutation worked, and control did not: a middleware
// could not decline to continue. The fix is not a bigger loop. It is to stop
// driving the list from the outside and let each link pull the next one.
//
// Three pieces, and none of them is more than a line:
//
//   one index    where the chain has got to
//   one closure  so every layer shares that index rather than a copy of it
//   recursion    next() calls the next layer, which may call next() again
//
// The list is walked exactly as far as somebody asks for it to be.

// Step 20 — arity is the signal. A layer declaring four parameters is an error
// handler; anything else is ordinary. Express chose this and it is worth matching,
// but it is a genuinely sharp convention: `(req, res, next, unused)` becomes an
// error handler by accident, and a default parameter or a rest argument changes
// Function.length and stops one being recognised. A named flag would be safer and
// would not be Express.
export function isErrorHandler(layer) {
  return layer.length === 4;
}

export function run(layers, req, res, initialError) {
  return new Promise((resolve, reject) => {
    let index = 0;

    const next = (error) => {
      // Skip past every layer of the wrong kind. In normal flow that means error
      // handlers are stepped over; once something has failed, only they are run.
      let layer = layers[index];
      index += 1;

      while (layer && isErrorHandler(layer) !== Boolean(error)) {
        layer = layers[index];
        index += 1;
      }

      // An error nobody handled comes out of the promise, and the caller answers
      // 500. An error handler that finishes without answering is the same case.
      if (error && !layer) {
        reject(error);
        return;
      }

      // The end of the list is the only way this resolves normally. A middleware
      // that answers the request and never calls next leaves this promise pending
      // forever, and that is not a leak to fix — it is short-circuiting. The rest
      // of the chain genuinely must not run.
      if (!layer) {
        resolve();
        return;
      }

      try {
        // The error itself is the extra argument, and it goes first. That is why
        // the signature reads (err, req, res, next) rather than having the error
        // appended — it is the thing the handler is about.
        const result = error
          ? layer(error, req, res, next)
          : layer(req, res, next);

        // An async middleware returns a promise nobody would otherwise wait on,
        // so a rejection inside it would be an unhandled rejection rather than a
        // 500. Routing it back through next is what makes `async` safe to write.
        if (result && typeof result.then === 'function') {
          result.catch(next);
        }
      } catch (thrown) {
        // A synchronous throw is the same failure as an async one and deserves
        // the same path. Without this it would escape into Node's uncaught
        // handler and take the process with it.
        next(thrown);
      }
    };

    // Starting with an error is how a failure enters the error handlers: the
    // same walk, seeded so the first layer it looks for is a four-argument one.
    next(initialError);
  });
}
