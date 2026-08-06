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

export function run(layers, req, res) {
  return new Promise((resolve, reject) => {
    let index = 0;

    const next = (error) => {
      // An error skips the rest of the chain. Step 20 gives it somewhere to go;
      // for now it comes out of the promise and the caller answers 500.
      if (error) {
        reject(error);
        return;
      }

      const layer = layers[index];
      index += 1;

      // The end of the list is the only way this resolves normally. A middleware
      // that answers the request and never calls next leaves this promise pending
      // forever, and that is not a leak to fix — it is short-circuiting. The rest
      // of the chain genuinely must not run.
      if (!layer) {
        resolve();
        return;
      }

      try {
        const result = layer(req, res, next);

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

    next();
  });
}
