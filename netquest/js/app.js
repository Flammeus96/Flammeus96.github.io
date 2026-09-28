/* NetQuest — application shell: screens, progress, ticket rendering. */
(function () {
  "use strict";
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, attrs = {}, ...children) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) e.setAttribute(k, v);
    }
    for (const c of children.flat()) if (c !== null && c !== undefined) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  };
  const esc = Challenges.esc;
  const { pick, shuffle, randInt } = IP;

  // ---------- progress ----------
  const KEY = "netquest.v1";
  const fresh = () => ({ xp: 0, shifts: {}, badges: [], stats: { answered: 0, correct: 0, topics: {} }, bestStreak: 0, streak: 0 });
  let P;
  try { P = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { P = fresh(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* private mode */ } };
  const rankFor = (xp) => { let r = DATA.RANKS[0]; for (const x of DATA.RANKS) if (xp >= x.xp) r = x; return r; };
  const nextRank = (xp) => DATA.RANKS.find((r) => r.xp > xp);
  function award(xp) { P.xp += xp; save(); renderRank(); }
  function record(topic, correct) {
    P.stats.answered++; if (correct) P.stats.correct++;
    const t = P.stats.topics[topic] || (P.stats.topics[topic] = { a: 0, c: 0 });
    t.a++; if (correct) t.c++;
    P.streak = correct ? P.streak + 1 : 0;
    if (P.streak > P.bestStreak) P.bestStreak = P.streak;
    if (P.streak === 10) giveBadge("Hot Streak (10 in a row)");
    if (P.streak === 25) giveBadge("Unstoppable (25 in a row)");
    const subnetOk = (P.stats.topics.subnet || {}).c || 0;
    if (subnetOk >= 25) giveBadge("Subnet Master");
    save();
  }
  function giveBadge(name) { if (!P.badges.includes(name)) { P.badges.push(name); save(); toast("🏅 Badge earned: " + name); } }
  function toast(msg) { const t = el("div", { class: "toast" }, msg); document.body.append(t); setTimeout(() => t.remove(), 3200); }
  function renderRank() {
    const r = rankFor(P.xp), n = nextRank(P.xp);
    $("#rank").innerHTML = `<b>${esc(r.title)}</b>${P.xp.toLocaleString()} XP${n ? ` · ${(n.xp - P.xp).toLocaleString()} to ${esc(n.title)}` : " · max rank"}<div class="xpbar"><i style="width:${n ? Math.round(((P.xp - r.xp) / (n.xp - r.xp)) * 100) : 100}%"></i></div>`;
  }

  // ---------- routing ----------
  const main = $("#screen");
  let current = "home";
  function go(screen, arg) {
    current = screen;
    document.querySelectorAll("nav.tabs button").forEach((b) => b.classList.toggle("active", b.dataset.screen === screen));
    main.innerHTML = "";
    window.scrollTo({ top: 0 });
    ({ home, campaign, shift: playShift, practice, lab, reference }[screen])(arg);
  }
  document.querySelectorAll("nav.tabs button").forEach((b) => b.addEventListener("click", () => go(b.dataset.screen)));
  $("#logo").addEventListener("click", () => go("home"));

  // ---------- home ----------
  function home() {
    const done = DATA.SHIFTS.filter((s) => P.shifts[s.id] && P.shifts[s.id].done).length;
    const next = DATA.SHIFTS.find((s) => !(P.shifts[s.id] && P.shifts[s.id].done)) || DATA.SHIFTS[DATA.SHIFTS.length - 1];
    const acc = P.stats.answered ? Math.round((P.stats.correct / P.stats.answered) * 100) : 0;
    main.append(
      el("h1", {}, "NetQuest"),
      el("p", { class: "lead" }, "Help-desk tickets that teach IP configuration, subnetting, ports, the OSI model, cabling, wireless, hardware and the command-line troubleshooting you'll use every day. Built for Network+ and A+ learners who want to be comfortable on the job, not just pass the exam."),
      el("div", { class: "grid" },
        el("div", { class: "card clickable", onclick: () => go("shift", next.id) }, el("h3", {}, done ? "Continue the campaign" : "Start the campaign"), el("div", { class: "meta" }, `Shift ${DATA.SHIFTS.indexOf(next) + 1}: ${next.title}`), el("div", { class: "progress", style: "margin-top:10px" }, el("i", { style: `width:${Math.round((done / DATA.SHIFTS.length) * 100)}%` })), el("div", { class: "meta", style: "margin-top:4px" }, `${done} of ${DATA.SHIFTS.length} shifts complete`)),
        el("div", { class: "card clickable", onclick: () => go("practice") }, el("h3", {}, "Practice"), el("div", { class: "meta" }, "Pick any topics and drill endlessly with adaptive difficulty.")),
        el("div", { class: "card clickable", onclick: () => go("lab") }, el("h3", {}, "Terminal lab"), el("div", { class: "meta" }, "A broken PC, a command prompt, and one fault to find.")),
        el("div", { class: "card clickable", onclick: () => go("reference") }, el("h3", {}, "Reference"), el("div", { class: "meta" }, "Cheat sheets: subnet table, ports, OSI, cables, commands.")),
      ),
      el("h2", {}, "Your stats"),
      el("div", { class: "grid" },
        el("div", { class: "card" }, el("div", { class: "summary-big" }, P.xp.toLocaleString()), el("div", { class: "meta" }, "XP · " + rankFor(P.xp).title)),
        el("div", { class: "card" }, el("div", { class: "summary-big" }, acc + "%"), el("div", { class: "meta" }, `accuracy over ${P.stats.answered} tickets`)),
        el("div", { class: "card" }, el("div", { class: "summary-big" }, P.bestStreak), el("div", { class: "meta" }, "best streak")),
      ),
      el("h2", {}, "Badges"),
      el("div", { class: "row" }, ...DATA.SHIFTS.map((s) => el("span", { class: "badge" + (P.badges.includes(s.badge) ? "" : " dim"), title: s.title }, "🏅 " + s.badge)), ...["Hot Streak (10 in a row)", "Unstoppable (25 in a row)", "Subnet Master"].map((b) => el("span", { class: "badge" + (P.badges.includes(b) ? "" : " dim") }, "⭐ " + b))),
      topicStats(),
      el("div", { class: "footer" }, el("button", { class: "btn ghost small", onclick: () => { if (confirm("Reset all progress?")) { P = fresh(); save(); renderRank(); go("home"); } } }, "Reset progress"), " · Progress is saved in this browser only."),
    );
  }
  function topicStats() {
    const rows = Object.entries(P.stats.topics).filter(([, v]) => v.a >= 3).sort((a, b) => a[1].c / a[1].a - b[1].c / b[1].a);
    if (!rows.length) return el("div");
    return el("div", {}, el("h2", {}, "Weakest topics"), el("p", { class: "lead" }, "Sorted by accuracy — practise these."), el("div", { class: "grid" }, ...rows.slice(0, 6).map(([t, v]) => el("div", { class: "card clickable", onclick: () => go("practice", t) }, el("h3", {}, DATA.TOPICS[t] ? DATA.TOPICS[t].label : t), el("div", { class: "progress" }, el("i", { style: `width:${Math.round((v.c / v.a) * 100)}%` })), el("div", { class: "meta" }, `${v.c}/${v.a} correct`)))));
  }

  // ---------- campaign ----------
  function campaign() {
    main.append(el("h1", {}, "Campaign"), el("p", { class: "lead" }, "Fifteen shifts. Each is a batch of tickets on one theme. Score 70% or better to clear a shift and unlock the next."));
    let unlocked = true;
    for (const [i, s] of DATA.SHIFTS.entries()) {
      const st = P.shifts[s.id] || {};
      const locked = !unlocked;
      const card = el("div", { class: "card shift" + (locked ? " locked" : "") },
        el("div", { class: "num" }, String(i + 1).padStart(2, "0")),
        el("div", { style: "flex:1" },
          el("div", { class: "row" }, el("h3", { style: "margin:0" }, s.title), el("span", { class: "spacer" }), st.done ? el("span", { class: "pill ok" }, `✓ best ${st.best}%`) : locked ? el("span", { class: "pill locked" }, "🔒 locked") : st.best !== undefined ? el("span", { class: "pill" }, `best ${st.best}%`) : el("span", { class: "pill" }, "new")),
          el("p", { class: "meta", style: "margin:6px 0" }, s.blurb),
          el("div", { class: "row" }, el("span", { class: "pill" }, `${s.tickets.reduce((a, t) => a + t[1], 0)} tickets`), el("span", { class: "pill" }, "🏅 " + s.badge), el("span", { class: "spacer" }), locked ? null : el("button", { class: "btn small", onclick: () => go("shift", s.id) }, st.done ? "Replay" : "Start shift")),
        ));
      main.append(card);
      if (!st.done) unlocked = false;
    }
  }

  // ---------- ticket sequence runner (shared by shift & practice) ----------
  function runSequence(opts) {
    // opts: {title, tasks: () => task|null (null = end), total?, onEnd(results)}
    const results = [];
    let n = 0;
    const wrap = el("div");
    main.append(wrap);
    function next() {
      wrap.innerHTML = "";
      const task = opts.tasks(n);
      if (!task) return opts.onEnd(results);
      n++;
      const head = el("div", { class: "row", style: "margin-bottom:10px" }, el("h1", { style: "margin:0;font-size:20px" }, opts.title), el("span", { class: "spacer" }), opts.total ? el("span", { class: "pill" }, `Ticket ${n} of ${opts.total}`) : el("span", { class: "pill" }, `Ticket ${n}`), el("span", { class: "pill streak" }, `🔥 ${P.streak}`), opts.endable ? el("button", { class: "btn ghost small", onclick: () => opts.onEnd(results) }, "End session") : null);
      wrap.append(head);
      if (opts.total) wrap.append(el("div", { class: "progress", style: "margin-bottom:14px" }, el("i", { style: `width:${Math.round(((n - 1) / opts.total) * 100)}%` })));
      renderTicket(wrap, task, (res) => { results.push(res); if (opts.onResult) opts.onResult(res); }, next);
    }
    next();
  }

  function shiftSummary(shift, results) {
    const correct = results.filter((r) => r.correct).length;
    const pct = Math.round((correct / results.length) * 100);
    const xp = results.reduce((a, r) => a + r.xp, 0);
    const st = P.shifts[shift.id] || (P.shifts[shift.id] = {});
    st.best = Math.max(st.best || 0, pct);
    const passed = pct >= 70;
    if (passed) { if (!st.done) { st.done = true; award(60 * (DATA.SHIFTS.indexOf(shift) + 1) / 3 | 0); } giveBadge(shift.badge); }
    save();
    main.innerHTML = "";
    const idx = DATA.SHIFTS.indexOf(shift);
    const nextShift = DATA.SHIFTS[idx + 1];
    main.append(
      el("h1", {}, passed ? "Shift complete" : "Shift not cleared"),
      el("p", { class: "lead" }, passed ? `You cleared "${shift.title}". ${nextShift ? "The next shift is unlocked." : "That was the final shift. You're ready."}` : `You need 70% to clear a shift. Read the explanations and try again — every ticket is freshly generated.`),
      el("div", { class: "grid" }, el("div", { class: "card" }, el("div", { class: "summary-big" }, pct + "%"), el("div", { class: "meta" }, `${correct} of ${results.length} tickets correct`)), el("div", { class: "card" }, el("div", { class: "summary-big" }, "+" + xp), el("div", { class: "meta" }, "XP from tickets" + (passed && st.done ? " (plus shift bonus)" : "")))),
      el("div", { class: "actions" }, el("button", { class: "btn", onclick: () => go("shift", shift.id) }, "Replay shift"), nextShift && passed ? el("button", { class: "btn", onclick: () => go("shift", nextShift.id) }, "Next shift →") : null, el("button", { class: "btn secondary", onclick: () => go("campaign") }, "Back to campaign")),
      el("h2", {}, "Review"),
      ...results.map((r, i) => el("div", { class: "card", style: "margin-bottom:8px" }, el("div", { class: "row" }, el("span", { class: "pill " + (r.correct ? "ok" : "") }, r.correct ? "✓" : "✗"), el("b", {}, `${i + 1}. ${r.title}`), el("span", { class: "spacer" }), el("span", { class: "meta" }, `+${r.xp} XP`)), el("div", { class: "meta", html: r.summary }))),
    );
  }

  function playShift(id) {
    const shift = DATA.SHIFTS.find((s) => s.id === id);
    const specs = [];
    for (const [topic, n, diff] of shift.tickets) for (let i = 0; i < n; i++) specs.push([topic, diff]);
    // keep topic order mostly but interleave a little for variety
    const order = specs.slice(0, 1).concat(shuffle(specs.slice(1)));
    runSequence({ title: `Shift ${DATA.SHIFTS.indexOf(shift) + 1}: ${shift.title}`, total: order.length, tasks: (i) => (i < order.length ? Challenges.generate(order[i][0], order[i][1]) : null), onEnd: (results) => shiftSummary(shift, results) });
  }

  // ---------- practice ----------
  function practice(preselect) {
    const chosen = new Set(preselect ? [preselect] : []);
    let diff = "adaptive";
    main.append(el("h1", {}, "Practice"), el("p", { class: "lead" }, "Choose topics and a difficulty. Adaptive mode steps up after two correct in a row and back down after a miss."));
    const groups = {};
    for (const [k, t] of Object.entries(DATA.TOPICS)) (groups[t.group] = groups[t.group] || []).push([k, t]);
    const boxes = el("div");
    for (const [g, list] of Object.entries(groups)) {
      boxes.append(el("h3", {}, g), el("div", { class: "topics" }, ...list.map(([k, t]) => {
        const lab = el("label", { class: chosen.has(k) ? "on" : "" });
        const cb = el("input", { type: "checkbox" }); cb.checked = chosen.has(k);
        cb.addEventListener("change", () => { cb.checked ? chosen.add(k) : chosen.delete(k); lab.classList.toggle("on", cb.checked); });
        lab.append(cb, t.label); return lab;
      })));
    }
    const seg = el("div", { class: "seg" }, ...[["adaptive", "Adaptive"], ["1", "★ Easy"], ["2", "★★ Medium"], ["3", "★★★ Hard"]].map(([v, l]) => el("button", { class: v === diff ? "on" : "", onclick: (e) => { diff = v; seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.target)); } }, l)));
    main.append(boxes, el("h3", {}, "Difficulty"), seg, el("div", { class: "actions" },
      el("button", { class: "btn", onclick: () => start() }, "Start practice"),
      el("button", { class: "btn secondary", onclick: () => { Object.keys(DATA.TOPICS).forEach((k) => chosen.add(k)); boxes.querySelectorAll("input").forEach((c) => { c.checked = true; c.parentElement.classList.add("on"); }); } }, "Select all"),
    ));
    function start() {
      if (!chosen.size) { toast("Pick at least one topic."); return; }
      const topics = [...chosen];
      let level = diff === "adaptive" ? 1 : +diff, run = 0;
      main.innerHTML = "";
      runSequence({ title: "Practice", endable: true, tasks: () => Challenges.generate(pick(topics), level), onResult: (r) => { if (diff === "adaptive") { if (r.correct) { run++; if (run >= 2 && level < 3) { level++; run = 0; toast("Difficulty up: " + "★".repeat(level)); } } else { run = 0; if (level > 1) level--; } } },
        onEnd: (results) => { main.innerHTML = ""; const c = results.filter((r) => r.correct).length; main.append(el("h1", {}, "Session over"), el("div", { class: "grid" }, el("div", { class: "card" }, el("div", { class: "summary-big" }, `${c}/${results.length}`), el("div", { class: "meta" }, "correct")), el("div", { class: "card" }, el("div", { class: "summary-big" }, "+" + results.reduce((a, r) => a + r.xp, 0)), el("div", { class: "meta" }, "XP"))), el("div", { class: "actions" }, el("button", { class: "btn", onclick: () => go("practice") }, "Practise again"), el("button", { class: "btn secondary", onclick: () => go("home") }, "Home"))); } });
    }
  }

  // ---------- lab ----------
  function lab() {
    main.append(el("h1", {}, "Terminal lab"), el("p", { class: "lead" }, "Each scenario is a user's PC with one thing wrong. Use ipconfig, ping, tracert, nslookup, arp and friends to find it, then submit your diagnosis. Fewer commands = bonus XP."));
    let diff = 1;
    const seg = el("div", { class: "seg" }, ...[[1, "★ Common faults"], [2, "★★ All faults"]].map(([v, l]) => el("button", { class: v === diff ? "on" : "", onclick: (e) => { diff = v; seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.target)); } }, l)));
    main.append(seg, el("div", { class: "actions" }, el("button", { class: "btn", onclick: () => { main.innerHTML = ""; runSequence({ title: "Terminal lab", endable: true, tasks: () => Challenges.generate("terminal", diff), onEnd: () => go("lab") }); } }, "Open a ticket")));
  }

  // ---------- ticket renderer ----------
  function renderTicket(wrap, task, onResult, onNext) {
    const num = randInt(10000, 99999);
    const ticket = el("div", { class: "ticket" });
    const head = el("div", { class: "ticket-head" }, el("span", {}, `Ticket #${num}`), el("b", {}, task.title), el("span", { class: "pill diff" }, "★".repeat(task.diff)), el("span", { class: "pill" }, `${task.xp} XP`), el("span", { class: "spacer" }), el("span", { class: "pill" }, DATA.TOPICS[task.topic] ? DATA.TOPICS[task.topic].label : task.topic));
    const body = el("div", { class: "ticket-body" });
    if (task.prompt) body.append(el("div", { class: "prompt", html: task.prompt }));
    ticket.append(head, body);
    wrap.append(ticket);
    let usedHint = false, done = false;
    const ctrl = RENDER[task.kind](body, task);
    const actions = el("div", { class: "actions" });
    const submit = el("button", { class: "btn", onclick: () => finish() }, "Submit");
    const hintBtn = el("button", { class: "btn ghost", onclick: () => { usedHint = true; hintBtn.disabled = true; body.append(el("div", { class: "hintbox" }, "💡 " + task.hint)); } }, "Hint (−30% XP)");
    actions.append(submit, hintBtn);
    if (ctrl.extraActions) ctrl.extraActions.forEach((a) => actions.append(a));
    body.append(actions);
    const keyHandler = (e) => { if (e.key === "Enter" && !done && !(e.target && e.target.classList.contains("term-input")) && ctrl.ready()) { e.preventDefault(); finish(); } };
    body.addEventListener("keydown", keyHandler);
    if (ctrl.focus) ctrl.focus();

    function finish() {
      if (done) return;
      if (!ctrl.ready()) { toast(ctrl.notReady || "Answer every part first."); return; }
      done = true;
      submit.disabled = true; hintBtn.disabled = true;
      const res = ctrl.check();
      let xp = res.correct ? task.xp : 0;
      if (res.bonus) xp = Math.round(xp * res.bonus);
      if (usedHint) xp = Math.round(xp * 0.7);
      record(task.topic, res.correct);
      award(xp);
      const fb = el("div", { class: "feedback " + (res.correct ? "ok" : "bad") }, el("span", { class: "xp" }, `+${xp} XP`), el("h3", {}, res.correct ? pick(["Correct!", "Nice work.", "Ticket closed.", "That's it."]) : "Not quite."), el("div", { html: (res.detail || "") + (task.explain || "") }));
      body.append(fb);
      const nextBtn = el("button", { class: "btn", onclick: () => onNext() }, "Next ticket →");
      body.append(el("div", { class: "actions" }, nextBtn));
      nextBtn.focus();
      onResult({ correct: res.correct, xp, title: task.title, summary: res.summary || (task.prompt || "").replace(/<[^>]+>/g, " ").slice(0, 140) });
    }
  }

  const RENDER = {
    mcq(body, task) {
      const idx = shuffle(task.choices.map((_, i) => i));
      let sel = -1;
      const list = el("div", { class: "choices" });
      const btns = idx.map((ci, i) => el("button", { class: "choice", onclick: () => { sel = ci; btns.forEach((b, j) => b.classList.toggle("selected", idx[j] === ci)); } }, el("span", { class: "key" }, String(i + 1)), el("span", { html: task.choices[ci] })));
      btns.forEach((b) => list.append(b));
      body.append(list);
      const keys = (e) => { if (!document.contains(list)) { document.removeEventListener("keydown", keys); return; } const n = +e.key; if (n >= 1 && n <= btns.length && !e.target.matches("input,select")) btns[n - 1].click(); };
      document.addEventListener("keydown", keys);
      return { ready: () => sel >= 0, notReady: "Pick an answer.", check() { document.removeEventListener("keydown", keys); btns.forEach((b, j) => { if (idx[j] === task.answer) b.classList.add("correct"); else if (idx[j] === sel) b.classList.add("wrong"); b.disabled = true; }); return { correct: sel === task.answer }; } };
    },
    input(body, task) {
      const grid = el("div", { class: "fields" });
      const inputs = task.fields.map((f) => { const inp = el("input", { type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false", placeholder: f.placeholder || "" }); const wrap = el("div", { class: "field" }, el("label", {}, f.label), inp); grid.append(wrap); return { f, inp, wrap }; });
      body.append(grid);
      return { ready: () => inputs.every((x) => x.inp.value.trim() !== ""), notReady: "Fill in every field.", focus: () => inputs[0].inp.focus(), check() { let all = true; for (const x of inputs) { const ok = Challenges.fieldCorrect(x.f, x.inp.value); x.wrap.classList.add(ok ? "ok" : "bad"); x.inp.disabled = true; if (!ok) { all = false; x.wrap.append(el("div", { class: "ans bad" }, "Expected: " + x.f.answer)); } } return { correct: all }; } };
    },
    match(body, task) {
      const left = shuffle(task.pairs.map((p, i) => ({ i, t: p.l }))), right = shuffle(task.pairs.map((p, i) => ({ i, t: p.r })));
      const pairs = new Map(); // leftIdx -> rightIdx
      let selL = null;
      const L = left.map((x) => el("div", { class: "mitem", onclick: () => { if (pairs.has(x.i)) { pairs.delete(x.i); } selL = x.i; paint(); } }, el("span", { class: "tag" }), el("span", {}, x.t)));
      const R = right.map((x) => el("div", { class: "mitem", onclick: () => { if (selL === null) { toast("Pick an item on the left first."); return; } for (const [l, r] of pairs) if (r === x.i) pairs.delete(l); pairs.set(selL, x.i); selL = null; paint(); } }, el("span", { class: "tag" }), el("span", {}, x.t)));
      function paint() {
        L.forEach((e, k) => { const li = left[k].i; e.classList.toggle("sel", selL === li); e.classList.toggle("paired", pairs.has(li)); e.firstChild.textContent = pairs.has(li) ? String([...pairs.keys()].indexOf(li) + 1) : ""; });
        R.forEach((e, k) => { const ri = right[k].i; const entry = [...pairs.entries()].find(([, r]) => r === ri); e.classList.toggle("paired", !!entry); e.firstChild.textContent = entry ? String([...pairs.keys()].indexOf(entry[0]) + 1) : ""; });
      }
      body.append(el("p", { class: "meta" }, "Tap an item on the left, then its match on the right."), el("div", { class: "match" }, el("div", { class: "col" }, ...L), el("div", { class: "col" }, ...R)));
      return { ready: () => pairs.size === task.pairs.length, notReady: "Match every item.", check() { let all = true; L.forEach((e, k) => { const li = left[k].i; const ok = pairs.get(li) === li; e.classList.add(ok ? "ok" : "bad"); if (!ok) all = false; }); R.forEach((e, k) => { const ri = right[k].i; const ok = pairs.get(ri) === ri; e.classList.add(ok ? "ok" : "bad"); }); return { correct: all }; } };
    },
    bucket(body, task) {
      const rows = el("div", { class: "bucket-rows" });
      const state = task.items.map(() => null);
      task.items.forEach((it, i) => {
        let ctl;
        if (task.buckets.length <= 3) { ctl = el("div", { class: "seg" }, ...task.buckets.map((b) => el("button", { onclick: (e) => { state[i] = b; ctl.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === e.target)); } }, b))); }
        else { ctl = el("select", { onchange: (e) => { state[i] = e.target.value || null; } }, el("option", { value: "" }, "Choose…"), ...task.buckets.map((b) => el("option", { value: b }, b))); ctl.className = "term-input"; ctl.style.width = "auto"; }
        rows.append(el("div", { class: "bucket-row" }, el("span", {}, it.text), ctl));
      });
      body.append(rows);
      return { ready: () => state.every(Boolean), notReady: "Assign every item.", check() { let all = true; task.items.forEach((it, i) => { const ok = state[i] === it.bucket; rows.children[i].classList.add(ok ? "ok" : "bad"); if (!ok) { all = false; rows.children[i].append(el("div", { class: "ans bad", style: "grid-column:1/-1;font-size:12px;color:var(--bad)" }, "→ " + it.bucket)); } rows.children[i].querySelectorAll("button,select").forEach((b) => (b.disabled = true)); }); return { correct: all }; } };
    },
    order(body, task) {
      const pool = shuffle(task.items.map((t, i) => ({ t, i })));
      const placed = [];
      const poolEl = el("div", { class: "pool" }), slotsEl = el("div", { class: "slots" });
      const swatch = (t) => (task.colors && task.colors[t] ? el("span", { class: "swatch", style: `background:${task.colors[t]}` }) : null);
      function paint() {
        poolEl.innerHTML = ""; slotsEl.innerHTML = "";
        for (const p of pool) if (!placed.includes(p)) poolEl.append(el("div", { class: "oitem", onclick: () => { placed.push(p); paint(); } }, swatch(p.t), el("span", {}, p.t)));
        task.items.forEach((_, k) => { const p = placed[k]; slotsEl.append(p ? el("div", { class: "oitem placed", onclick: () => { placed.splice(k, 1); paint(); } }, el("span", { class: "n" }, k + 1 + "."), swatch(p.t), el("span", {}, p.t)) : el("div", { class: "slot-empty" }, `${k + 1}.`)); });
      }
      paint();
      body.append(el("div", { class: "order" }, el("div", {}, el("p", { class: "meta", style: "margin:0 0 6px" }, "Available"), poolEl), el("div", {}, el("p", { class: "meta", style: "margin:0 0 6px" }, "Your order"), slotsEl)));
      return { ready: () => placed.length === task.items.length, notReady: "Place every step.", check() { let all = true; placed.forEach((p, k) => { const ok = p.i === k; slotsEl.children[k].classList.add(ok ? "ok" : "bad"); slotsEl.children[k].onclick = null; if (!ok) all = false; }); return { correct: all }; } };
    },
    ipfix(body, task) {
      const sc = task.scenario, lan = sc.lan;
      const form = Object.assign({}, sc.cfg);
      body.append(el("div", { class: "complaint" }, `Ticket from ${sc.user}: “${sc.symptoms.join(" ")}”`));
      const doc = el("div", { class: "doc" }, el("h4", {}, "Network documentation"), el("dl", {},
        el("dt", {}, "Subnet"), el("dd", {}, lan.cidr), el("dt", {}, "Subnet mask"), el("dd", {}, lan.mask), el("dt", {}, "Router / gateway"), el("dd", {}, IP.toStr(lan.gw)),
        el("dt", {}, "DNS (DC01)"), el("dd", {}, IP.toStr(lan.dns)), el("dt", {}, "DHCP scope"), el("dd", {}, `${IP.toStr(lan.scopeStart)} – ${IP.toStr(lan.scopeEnd)}`),
        el("dt", {}, "File server"), el("dd", {}, IP.toStr(lan.fileserver)), el("dt", {}, "Printer"), el("dd", {}, IP.toStr(lan.printer)),
        el("dt", {}, "This PC"), el("dd", {}, sc.requireStatic ? "Static address required (outside the DHCP scope)" : "DHCP allowed")));
      const fields = {};
      const mk = (key, label) => { const inp = el("input", { type: "text", autocomplete: "off", spellcheck: "false", value: form[key] || "", oninput: (e) => (form[key] = e.target.value.trim()) }); fields[key] = inp; return el("div", { class: "field" }, el("label", {}, label), inp); };
      const radios = el("div", { class: "radio" });
      const setMode = (m) => { form.mode = m; Object.values(fields).forEach((i) => (i.disabled = m === "dhcp")); radios.querySelectorAll("input").forEach((r) => (r.checked = r.value === m)); if (m === "dhcp") { lease(); } };
      for (const [v, l] of [["dhcp", "Obtain automatically (DHCP)"], ["static", "Use the following address"]]) radios.append(el("label", {}, el("input", { type: "radio", name: "mode" + task.xp + Math.random(), value: v, onchange: () => setMode(v) }), " " + l));
      function lease() { form.ip = IP.toStr((lan.scopeStart + randInt(0, 20)) >>> 0); form.mask = lan.mask; form.gw = IP.toStr(lan.gw); form.dns = IP.toStr(lan.dns); for (const k of ["ip", "mask", "gw", "dns"]) fields[k].value = form[k]; toast("DHCP lease obtained."); }
      const adapter = el("div", { class: "adapter" }, el("h4", {}, "Ethernet0 — IPv4 properties"), radios, mk("ip", "IP address"), mk("mask", "Subnet mask"), mk("gw", "Default gateway"), mk("dns", "Preferred DNS server"));
      body.append(el("div", { class: "ipfix" }, doc, adapter));
      radios.querySelectorAll("input").forEach((r) => (r.checked = r.value === form.mode));
      Object.values(fields).forEach((i) => (i.disabled = form.mode === "dhcp"));
      if (form.mode === "dhcp") { /* current failed lease shows APIPA; user may renew */ }
      const checks = el("div", { class: "checks" });
      const diag = new Set();
      for (const [k, l] of Object.entries(sc.faultLabels)) checks.append(el("label", {}, el("input", { type: "checkbox", onchange: (e) => (e.target.checked ? diag.add(k) : diag.delete(k)) }), l));
      body.append(el("h3", {}, "What was wrong? (tick every fault you found)"), checks);
      const tests = el("div", { class: "tests" });
      body.append(tests);
      function runTests() {
        const r = evalIpfix(sc, form);
        tests.innerHTML = "";
        tests.append(el("h3", {}, "Test results"), ...r.map((t) => el("div", { class: "test" }, el("span", { class: "st " + (t.pass ? "pass" : "fail") }, t.pass ? "PASS" : "FAIL"), el("span", {}, t.name), el("span", { class: "spacer" }), el("span", { style: "color:var(--muted)" }, t.detail || ""))));
        return r;
      }
      const renewBtn = el("button", { class: "btn secondary", onclick: () => { if (form.mode !== "dhcp") { toast("Switch to DHCP first."); return; } lease(); } }, "Renew DHCP lease");
      const testBtn = el("button", { class: "btn secondary", onclick: runTests }, "Apply & run tests");
      return { extraActions: [testBtn, renewBtn], ready: () => diag.size > 0, notReady: "Tick at least one fault before submitting.", check() {
        const r = runTests();
        const testsOk = r.every((t) => t.pass);
        const diagOk = diag.size === sc.faults.length && sc.faults.every((f) => diag.has(f));
        Object.values(fields).forEach((i) => (i.disabled = true)); checks.querySelectorAll("input").forEach((i) => (i.disabled = true)); radios.querySelectorAll("input").forEach((i) => (i.disabled = true)); testBtn.disabled = renewBtn.disabled = true;
        const origin = sc.original;
        const explain = `<p><b>Fault${sc.faults.length > 1 ? "s" : ""}:</b> ${sc.faults.map((f) => sc.faultLabels[f]).join("; ")}.</p>` +
          `<p>The workstation had IP ${code(origin.ip || "(none)")}, mask ${code(origin.mask || "(none)")}, gateway ${code(origin.gw || "(none)")}, DNS ${code(origin.dns || "(none)")}. ` +
          `The documented subnet ${code(lan.cidr)} runs from ${code(IP.toStr(IP.firstHost(lan.base, lan.p)))} to ${code(IP.toStr(IP.lastHost(lan.base, lan.p)))} with mask ${code(lan.mask)}; the gateway must be ${code(IP.toStr(lan.gw))} and DNS ${code(IP.toStr(lan.dns))}.</p>` +
          `<p>${sc.faults.map((f) => FAULT_WHY[f]).join(" ")}</p>` + (testsOk ? "" : `<p>Your final config still failed ${r.filter((t) => !t.pass).length} test(s) — see above.</p>`) + (diagOk ? "" : `<p>Your diagnosis did not match the actual fault list.</p>`);
        return { correct: testsOk && diagOk, detail: explain, summary: sc.faults.map((f) => sc.faultLabels[f]).join("; ") };
      } };
    },
    terminal(body, task) {
      const sc = task.scenario, st = sc.state, lan = st.lan;
      const term = el("div", { class: "terminal", role: "log", "aria-live": "polite" });
      const print = (txt, cls) => { const n = el("div", { class: cls || "" }); n.textContent = txt; term.append(n); term.scrollTop = term.scrollHeight; };
      print(`Microsoft Windows [Version 10.0.19045]\n(c) Microsoft Corporation. All rights reserved.\n\nRemote shell to ${st.host}. Type help for available commands.\n`);
      const input = el("input", { class: "term-input", type: "text", autocomplete: "off", spellcheck: "false", placeholder: "ipconfig /all" });
      const history = []; let hi = 0;
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { const line = input.value; input.value = ""; if (!line.trim()) return; history.push(line); hi = history.length; print(`C:\\Users\\${st.host.toLowerCase()}> ${line}`, "cmd"); const out = NetSim.exec(st, line); if (out === "\u0000CLS") term.innerHTML = ""; else print(out + "\n"); e.stopPropagation(); }
        else if (e.key === "ArrowUp") { if (hi > 0) { hi--; input.value = history[hi]; } e.preventDefault(); }
        else if (e.key === "ArrowDown") { if (hi < history.length - 1) { hi++; input.value = history[hi]; } else { hi = history.length; input.value = ""; } e.preventDefault(); }
      });
      const doc = el("div", { class: "doc" }, el("h4", {}, "Network documentation"), el("dl", {},
        el("dt", {}, "Subnet"), el("dd", {}, lan.cidr), el("dt", {}, "Mask"), el("dd", {}, lan.mask), el("dt", {}, "Gateway"), el("dd", {}, IP.toStr(lan.gw) + " (rtr-core)"),
        el("dt", {}, "DNS / DHCP"), el("dd", {}, IP.toStr(lan.dns) + " (dc01)"), el("dt", {}, "File server"), el("dd", {}, IP.toStr(lan.fileserver) + " (files01)"), el("dt", {}, "Printer"), el("dd", {}, IP.toStr(lan.printer) + " (prn-2f)"),
        el("dt", {}, "DHCP scope"), el("dd", {}, `${IP.toStr(lan.scopeStart)} – ${IP.toStr(lan.scopeEnd)}`), el("dt", {}, "This PC"), el("dd", {}, st.dhcp ? "DHCP client" : "Static assignment"), el("dt", {}, "Domain"), el("dd", {}, "corp.local")),
        el("p", { class: "meta", style: "margin:8px 0 0" }, "Useful names: files01, prn-2f, dc01, rtr-core, www.example.com, 8.8.8.8"));
      body.append(el("div", { class: "lab" }, el("div", {}, term, el("div", { class: "termline" }, el("span", { class: "ps" }, `C:\\>`), input)), doc));
      const cause = el("select", { class: "term-input" }, el("option", { value: "" }, "Select the root cause…"), ...sc.causes.map((c) => el("option", { value: c }, c)));
      const fix = el("select", { class: "term-input" }, el("option", { value: "" }, "Select the recommended fix…"), ...sc.fixes.map((c) => el("option", { value: c }, c)));
      body.append(el("div", { class: "diag" }, el("h3", {}, "Diagnosis"), el("div", { class: "fields" }, el("div", { class: "field" }, el("label", {}, "Root cause"), cause), el("div", { class: "field" }, el("label", {}, "Recommended fix"), fix))));
      return { focus: () => input.focus(), ready: () => !!cause.value, notReady: "Select a root cause.", check() {
        const causeOk = cause.value === sc.answerCause, fixOk = fix.value === sc.answerFix;
        cause.disabled = fix.disabled = input.disabled = true;
        cause.parentElement.classList.add(causeOk ? "ok" : "bad"); fix.parentElement.classList.add(fixOk ? "ok" : "bad");
        let bonus = 1; const notes = [];
        if (causeOk && fixOk) { bonus += 0.5; notes.push("Fix correct: +50%."); }
        if (causeOk && st.cmds <= 6) { bonus += 0.2; notes.push(`Efficient: only ${st.cmds} command(s), +20%.`); }
        return { correct: causeOk, bonus, detail: (notes.length ? `<p>${notes.join(" ")}</p>` : "") + sc.explain, summary: sc.answerCause };
      } };
    },
  };
  const code = (s) => `<code>${esc(s)}</code>`;
  const FAULT_WHY = {
    mask: "A wrong mask changes which addresses the PC thinks are local. Hosts it believes are on-link get ARPed directly; if the gateway falls outside the PC's idea of the subnet, everything remote fails.",
    gateway: "With the gateway pointing at an address that isn't the router, local traffic still works (it never needs the router) but anything off-subnet is sent to a host that doesn't exist.",
    ip: "An address outside the subnet means no other host on the LAN considers this PC local, and the gateway won't accept its traffic either — total isolation without an APIPA clue.",
    dns: "IP connectivity is fine, so pings to addresses succeed, but with the wrong resolver every hostname lookup fails (or, with a public DNS, only internal names fail).",
    apipa: "169.254.x.x means the DHCP request got no answer. Renewing the lease once the network is repaired (or after the DHCP server is back) restores the correct config.",
    duplicate: "Two devices claiming one IP fight over the ARP entry, so traffic flips between them. Static addresses must be unique and documented — pick a free one outside the DHCP scope.",
  };
  function evalIpfix(sc, form) {
    const lan = sc.lan, out = [];
    const ip = IP.normV4(form.ip), mask = IP.normV4(form.mask), gw = IP.normV4(form.gw), dns = IP.normV4(form.dns);
    const pcP = mask ? IP.prefixFromMask(mask) : -1;
    const push = (name, pass, detail) => out.push({ name, pass, detail });
    if (sc.requireStatic) push("Static assignment per documentation", form.mode === "static", form.mode === "static" ? "" : "DHCP is not allowed for this PC");
    push("Valid IP address and mask", !!ip && pcP >= 0, !ip ? "IP is not valid" : pcP < 0 ? "mask is not contiguous" : "");
    const ipInt = ip ? IP.toInt(ip) : 0;
    const inSubnet = !!ip && IP.network(ipInt, lan.p) === lan.base && ipInt !== lan.base && ipInt !== IP.broadcast(lan.base, lan.p);
    push(`IP inside ${lan.cidr} (host range)`, inSubnet, inSubnet ? "" : ip ? `${ip} is not a usable host in ${lan.cidr}` : "");
    push("Subnet mask matches documentation", mask === lan.mask, mask === lan.mask ? "" : `expected ${lan.mask}`);
    const taken = [lan.gw, lan.dns, lan.fileserver, lan.printer];
    const conflict = ip && (taken.includes(ipInt) || (form.mode === "static" && ipInt >= lan.scopeStart && ipInt <= lan.scopeEnd));
    push("No address conflict", !conflict, conflict ? (taken.includes(ipInt) ? `${ip} is already used by another device` : `${ip} is inside the DHCP scope`) : "");
    const gwLocal = !!gw && pcP >= 0 && inSubnet && IP.network(IP.toInt(gw), pcP) === IP.network(ipInt, pcP);
    const gwOk = gwLocal && IP.toInt(gw) === lan.gw && mask === lan.mask && !conflict;
    push(`ping ${IP.toStr(lan.gw)} (gateway)`, gwOk, gwOk ? "Reply from " + IP.toStr(lan.gw) : !gw ? "no gateway configured" : !gwLocal ? "gateway is not on the PC's subnet — transmit failed" : IP.toInt(gw) !== lan.gw ? "configured gateway does not answer (Destination host unreachable)" : "Request timed out");
    push("ping 8.8.8.8 (internet)", gwOk, gwOk ? "Reply from 8.8.8.8" : "Request timed out");
    const dnsOk = !!dns && IP.toInt(dns) === lan.dns && inSubnet && pcP >= 0 && IP.network(IP.toInt(dns), pcP) === IP.network(ipInt, pcP) && !conflict;
    push("nslookup files01.corp.local (internal name)", dnsOk, dnsOk ? IP.toStr(lan.fileserver) : dns === "8.8.8.8" || dns === "1.1.1.1" ? "public DNS can't resolve internal names" : "DNS request timed out");
    push("nslookup www.example.com (external name)", dnsOk && gwOk, dnsOk && gwOk ? "93.184.216.34" : "DNS request timed out");
    return out;
  }

  // ---------- reference ----------
  function reference() {
    main.append(el("h1", {}, "Reference"), el("p", { class: "lead" }, "The cheat sheets you'd tape to your monitor."));
    const tabs = el("div", { class: "reftabs" }), panel = el("div", { class: "card" });
    const sections = {
      "Subnetting": () => `<h3>Method</h3><ol><li>Find the octet where the mask is not 255 or 0 (the interesting octet).</li><li>Block size = 256 − mask octet.</li><li>Subnets start at multiples of the block size. The address falls in one of them: that's the network. Broadcast = next start − 1.</li><li>Usable hosts = 2<sup>host bits</sup> − 2.</li></ol><table class="ref"><tr><th>Prefix</th><th>Mask</th><th>Block</th><th>Usable</th><th>Subnets</th></tr>${DATA.SUBNET_TABLE.map((r) => `<tr><td>${r.prefix}</td><td><code>${r.mask}</code></td><td>${r.block}</td><td>${r.usable.toLocaleString()}</td><td>${r.subnets}</td></tr>`).join("")}</table><p class="meta">Mask octet values: 128 192 224 240 248 252 254 255 (1–8 bits).</p>`,
      "Addresses": () => `<table class="ref"><tr><th>Range</th><th>Meaning</th></tr><tr><td><code>10.0.0.0/8</code>, <code>172.16.0.0/12</code>, <code>192.168.0.0/16</code></td><td>Private (RFC 1918) — needs NAT to reach the internet</td></tr><tr><td><code>169.254.0.0/16</code></td><td>APIPA / link-local — DHCP failed</td></tr><tr><td><code>127.0.0.0/8</code></td><td>Loopback (127.0.0.1)</td></tr><tr><td><code>224.0.0.0/4</code></td><td>Multicast (224–239)</td></tr><tr><td><code>100.64.0.0/10</code></td><td>Carrier-grade NAT shared space</td></tr><tr><td><code>0.0.0.0/0</code></td><td>Default route ("any")</td></tr><tr><td><code>255.255.255.255</code></td><td>Limited broadcast</td></tr></table><h3>Classes (historic)</h3><p>A 1–126 (/8) · B 128–191 (/16) · C 192–223 (/24) · D 224–239 multicast · E 240–255 experimental.</p><h3>IPv6</h3><table class="ref"><tr><td><code>2000::/3</code></td><td>Global unicast (public)</td></tr><tr><td><code>fe80::/10</code></td><td>Link-local (every interface has one)</td></tr><tr><td><code>fc00::/7</code> (fd00::)</td><td>Unique local (private)</td></tr><tr><td><code>ff00::/8</code></td><td>Multicast (ff02::1 all nodes, ff02::2 all routers)</td></tr><tr><td><code>::1</code> / <code>::</code></td><td>Loopback / unspecified</td></tr></table><p>128 bits, 8 hex groups. Drop leading zeros; collapse one longest run of zero groups to <code>::</code>. Standard LAN = /64. SLAAC builds addresses from router advertisements; NDP replaces ARP; no broadcast.</p>`,
      "Ports": () => `<table class="ref"><tr><th>Port</th><th>Service</th><th>Proto</th><th>Notes</th></tr>${DATA.PORTS.map((p) => `<tr><td><code>${p.port}</code></td><td>${esc(p.name)}</td><td>${p.proto}</td><td>${esc(p.desc)}</td></tr>`).join("")}</table>`,
      "OSI model": () => `<table class="ref"><tr><th>#</th><th>Layer</th><th>PDU</th><th>Examples</th></tr>${DATA.OSI.map((l) => `<tr><td>${l.n}</td><td>${l.name}</td><td>${l.pdu}</td><td>${l.items.join(", ")}</td></tr>`).join("")}</table><p>Mnemonics: <b>P</b>lease <b>D</b>o <b>N</b>ot <b>T</b>hrow <b>S</b>ausage <b>P</b>izza <b>A</b>way (1→7). TCP/IP model: Link (1–2), Internet (3), Transport (4), Application (5–7).</p>`,
      "Cabling": () => `<table class="ref"><tr><th>Cable</th><th>Speed</th><th>Distance</th><th>Notes</th></tr>${DATA.CABLES.map((c) => `<tr><td>${c.name}</td><td>${c.speed}</td><td>${c.dist}</td><td>${c.notes}</td></tr>`).join("")}</table><h3>T568B (most common)</h3><p>${DATA.T568B.map((w, i) => `<span class="wire" style="background:${DATA.WIRE_COLORS[w]}"></span>${i + 1} ${w}`).join(" &nbsp; ")}</p><h3>T568A</h3><p>${DATA.T568A.map((w, i) => `<span class="wire" style="background:${DATA.WIRE_COLORS[w]}"></span>${i + 1} ${w}`).join(" &nbsp; ")}</p><p>Same standard both ends = straight-through. A on one end, B on the other = crossover. Plenum-rated cable for air spaces. PoE: 802.3af 15.4 W, 802.3at 30 W, 802.3bt 60/100 W.</p><h3>Connectors</h3><table class="ref">${DATA.CONNECTORS.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.use)}</td></tr>`).join("")}</table>`,
      "Wireless": () => `<table class="ref"><tr><th>Standard</th><th>Name</th><th>Band</th><th>Max speed</th></tr>${DATA.WIFI.map((w) => `<tr><td>${w.std}</td><td>${w.gen}</td><td>${w.band}</td><td>${w.speed}</td></tr>`).join("")}</table><p>2.4 GHz non-overlapping channels: 1, 6, 11. 5 GHz has many more channels (36, 40, 44, 48…). Higher frequency = faster but shorter range.</p><table class="ref">${DATA.WIFI_SECURITY.map((s) => `<tr><td>${s.name}</td><td>${s.note}</td></tr>`).join("")}</table><p>RSSI: −30 dBm excellent, −67 dBm good, below −80 dBm unreliable.</p>`,
      "DHCP / DNS / NAT": () => `<h3>DHCP (UDP 67/68)</h3><p><b>D</b>iscover → <b>O</b>ffer → <b>R</b>equest → <b>A</b>cknowledge. Scope = range handed out; reservation = MAC always gets the same IP; exclusion = addresses the scope skips; lease = how long the address is valid. Routers don't forward broadcasts, so remote subnets need a DHCP relay (IP helper). No lease → APIPA 169.254.x.x.</p><h3>DNS (UDP/TCP 53)</h3><table class="ref">${DATA.DNS_RECORDS.map((r) => `<tr><td><code>${r.type}</code></td><td>${esc(r.desc)}</td></tr>`).join("")}</table><p>Lookup order: local cache → hosts file → recursive resolver → root → TLD → authoritative. Fix stale entries with <code>ipconfig /flushdns</code>.</p><h3>NAT</h3><p>PAT / NAT overload: many private IPs share one public IP by rewriting source ports. Port forwarding (DNAT): an inbound public port is sent to an internal host.</p>`,
      "Commands": () => `<table class="ref"><tr><th>Command</th><th>OS</th><th>Purpose</th></tr>${DATA.COMMANDS.map((c) => `<tr><td><code>${esc(c.cmd)}</code></td><td>${c.os}</td><td>${esc(c.desc)}</td></tr>`).join("")}</table>`,
      "Troubleshooting": () => `<ol>${DATA.TROUBLESHOOTING_STEPS.map((s) => `<li>${esc(s)}</li>`).join("")}</ol><h3>Connectivity ladder</h3><p>Work outward: <code>ping 127.0.0.1</code> (stack) → <code>ping &lt;own IP&gt;</code> (NIC) → <code>ping &lt;gateway&gt;</code> (LAN) → <code>ping 8.8.8.8</code> (routing/WAN) → <code>ping www.example.com</code> (DNS). The first step that fails tells you the layer.</p><h3>Symptom → likely cause</h3><table class="ref"><tr><td>169.254.x.x address</td><td>DHCP not reachable (cable, VLAN, DHCP server, relay)</td></tr><tr><td>"Media disconnected"</td><td>Layer 1: cable, NIC, switch port</td></tr><tr><td>IP pings work, names fail</td><td>DNS setting or DNS server</td></tr><tr><td>LAN works, internet fails</td><td>Gateway, mask or WAN/ISP</td></tr><tr><td>Some LAN hosts fail, others work</td><td>Wrong subnet mask or VLAN</td></tr><tr><td>Intermittent, "IP conflict"</td><td>Duplicate static IP</td></tr><tr><td>Slow, CRC errors</td><td>Bad cable, duplex mismatch, too long</td></tr></table>`,
      "Devices & routing": () => `<table class="ref"><tr><td>Hub</td><td>L1 repeater, one collision domain (obsolete)</td></tr><tr><td>Switch</td><td>L2, forwards by MAC, each port its own collision domain; VLANs split broadcast domains</td></tr><tr><td>Router</td><td>L3, forwards by IP between networks, separates broadcast domains</td></tr><tr><td>Layer 3 switch</td><td>Switch that also routes between VLANs</td></tr><tr><td>Firewall</td><td>Filters by rules; stateful / next-gen (app aware); IDS alerts, IPS blocks inline</td></tr><tr><td>Access point</td><td>Bridges Wi-Fi to the wired LAN; many APs with one SSID = ESS</td></tr><tr><td>Load balancer / proxy</td><td>Spread requests across servers / intermediary for caching and filtering</td></tr></table><h3>Switching</h3><p>802.1Q trunks carry tagged VLANs; access ports untagged. STP/RSTP blocks loops. LACP bundles links. Port security limits MACs; BPDU guard stops rogue switches; DHCP snooping stops rogue DHCP; DAI stops ARP spoofing.</p><h3>Routing</h3><p>Static vs dynamic. RIP: distance vector, hop count, max 15. OSPF: link state, cost, areas. EIGRP: hybrid (Cisco). BGP: path vector, between autonomous systems / ISPs. Longest prefix match wins; then administrative distance (connected 0, static 1, EIGRP 90, OSPF 110, RIP 120).</p>`,
    };
    let active = Object.keys(sections)[0];
    function show() { tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.textContent === active)); panel.innerHTML = sections[active](); }
    for (const k of Object.keys(sections)) tabs.append(el("button", { onclick: () => { active = k; show(); } }, k));
    main.append(tabs, panel);
    show();
  }

  // ---------- boot ----------
  renderRank();
  go("home");
})();
