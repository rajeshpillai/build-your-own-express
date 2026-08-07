# rocket — build your own Express

A web framework written from `http.createServer` up, one runnable step at a time, then ported to
uWebSockets.js and measured against Express on one machine.

Companion code for the course *Build Your Own Express* on Udemy.

**The framework has no dependencies.** Node 20 or newer, ESM throughout. Nothing under `rocket/`
imports anything you have to install.

Two steps install packages *beside* it, on purpose: step 25.1 runs Handlebars and EJS on the view
seam, and step 28.1 runs real Express middleware. Both are the point of those steps — a seam
nobody else's code fits through is not a seam. Their `verify.sh` installs what it needs.

---

## The history is the course

This repository does not hold a copy of the framework per step. It holds one framework, and
its commit history *is* the syllabus. Every lecture is exactly one commit, tagged.

```bash
git log --oneline          # read the syllabus
git checkout step-07       # the framework as it stood at lecture 7
node app.js                # …and it runs
git diff step-06 step-07   # exactly what that lecture added
```

Every tagged step runs on its own. If a step does not start and answer a request, that is a bug —
please open an issue.

```bash
git checkout step-01
node server.js
curl localhost:3000/
```

## Where it goes

| Section | Steps | |
|---|---|---|
| 1 | 01–03 | A server that answers, and a route table |
| 2 | 04–08 | Verbs, dynamic segments, query strings, precedence |
| 3 | 09–13 | The response object — `send`, `json`, `status`, `redirect` |
| 4 | 14–16 | Request bodies, and a size limit |
| 5 | 17–21 | Middleware and the `next()` chain |
| 6 | 22–25 | Static files, sub-routers, mounting, view engines |
| 7 | 26–28 | A todo application built on the finished framework |
| 8 | 29–37 | Profiling, fixing, and the port to uWebSockets.js |

## What this is for

Understanding what Express does on your behalf. Every mechanism here exists in a real framework,
usually with more care taken over the edge cases. Read it, break it, then go and use Express —
the point is that you will know what it is doing.

## Licence

[MIT](LICENSE). Use it, change it, ship it.
