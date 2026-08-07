// Step 26 — where a short code comes from.
//
// The obvious answer is a counter, and it is wrong in a way that is easy to miss:
// a counter makes every link guessable from every other one. Ask for the code
// after yours and you get somebody else's link. That is not a theoretical
// weakness, it is how people find other people's unlisted documents.
//
// So the codes are random. Three decisions follow from that, and each one is a
// real decision rather than a detail.

import { randomBytes } from 'node:crypto';

// 1. WHICH RANDOM. Math.random is a fast generator for simulations and games,
//    and it is predictable: watch enough output and you can compute the rest.
//    Anything a stranger should not be able to guess comes from node:crypto.
//
// 2. WHICH LETTERS. No 0 or O, no 1 or l or I. People read these off a screen,
//    say them down a phone, and type them from a printed page, and those pairs
//    are where they get it wrong. Fifty-six characters, all of them distinct at
//    a glance.
const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';

// 3. HOW LONG. Seven characters of this alphabet is about 1.7 trillion codes.
//    Short enough to read aloud, large enough that random collisions stay rare
//    until the store is enormous. It is a policy, not a law: raise it and the
//    codes get uglier, lower it and collisions arrive sooner.
const LENGTH = 7;

// Paths this application already answers on. A random code that came out as
// "api" would be unreachable, because the mounted router matches first and the
// link would simply never resolve. The generator has to know what the route
// table has already claimed — which is the kind of coupling that only shows up
// once the two exist together.
const RESERVED = new Set(['api', 'v2', 'echo', 'links', 'logs', 'whoami', 'assets']);

// randomBytes gives whole bytes, and 256 does not divide by 56. Taking the
// remainder anyway would make the first few letters of the alphabet very
// slightly more likely, so bytes that land in the uneven tail are thrown away.
// The bias is small, and so is the cost of not having it.
const LIMIT = 256 - (256 % ALPHABET.length);

export function generate(length = LENGTH) {
  let code = '';
  while (code.length < length) {
    for (const byte of randomBytes(length)) {
      if (byte >= LIMIT) continue;
      code += ALPHABET[byte % ALPHABET.length];
      if (code.length === length) break;
    }
  }
  return code;
}

export function isReserved(code) {
  return RESERVED.has(code.toLowerCase());
}

export { ALPHABET, LENGTH, RESERVED };
