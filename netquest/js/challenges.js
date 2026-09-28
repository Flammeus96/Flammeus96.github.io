/* NetQuest — challenge generators.
   Every generator returns a "task":
   { topic, diff, kind, title, prompt(html), hint, explain(html), ...kind-specific }
   kinds: mcq {choices, answer} | input {fields:[{key,label,answer,norm,placeholder}]}
          match {pairs:[{l,r}]} | bucket {buckets:[], items:[{text,bucket}]}
          order {items:[], colors?} | ipfix {scenario} | terminal (built by NetSim) */
(function (global) {
  "use strict";
  const { randInt, pick, shuffle, sample } = IP;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const code = (s) => `<code>${esc(s)}</code>`;

  // ---------- explanation helpers ----------
  function binTable(rows) {
    return `<table class="bin"><tbody>${rows.map(([l, v]) => `<tr><th>${esc(l)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>`;
  }
  function subnetExplain(ip, p) {
    const net = IP.network(ip, p), bc = IP.broadcast(ip, p);
    const rows = binTable([
      ["Address", IP.toBin(ip)],
      ["Mask /" + p, IP.toBin(IP.maskInt(p))],
      ["Network", IP.toBin(net)],
      ["Broadcast", IP.toBin(bc)],
    ]);
    let method;
    if (p % 8 === 0) {
      method = `The prefix ends on an octet boundary, so copy the first ${p / 8} octet(s) and set the rest to 0 for the network and 255 for the broadcast.`;
    } else {
      const oi = Math.floor(p / 8), bits = p % 8, block = Math.pow(2, 8 - bits);
      const octets = IP.toStr(ip).split(".").map(Number);
      const start = Math.floor(octets[oi] / block) * block;
      method = `The "interesting" octet is octet ${oi + 1} (mask value ${256 - block}). Block size = 256 − ${256 - block} = <b>${block}</b>. ` +
        `${octets[oi]} falls in the block starting at ${start} (multiples of ${block}: ${Array.from({ length: Math.min(6, 256 / block) }, (_, i) => i * block).join(", ")}…), ` +
        `so the network octet is ${start} and the broadcast octet is ${start + block - 1}.`;
    }
    const usable = IP.usableHosts(p);
    return `<p>${method}</p>${rows}<p>Network ${code(IP.toStr(net) + "/" + p)} · Broadcast ${code(IP.toStr(bc))} · Usable hosts ${code(IP.toStr(IP.firstHost(ip, p)))} – ${code(IP.toStr(IP.lastHost(ip, p)))} (${usable.toLocaleString()} hosts: 2<sup>${32 - p}</sup> − 2).</p>`;
  }

  // Used question tracking so a session doesn't repeat MCQs quickly.
  const usedMcq = new Set();
  function bankMcq(topic, diff) {
    let pool = QUESTIONS.filter((q) => q.topic === topic && q.diff <= diff && !usedMcq.has(q));
    if (!pool.length) pool = QUESTIONS.filter((q) => q.topic === topic && !usedMcq.has(q));
    if (!pool.length) { QUESTIONS.filter((q) => q.topic === topic).forEach((q) => usedMcq.delete(q)); pool = QUESTIONS.filter((q) => q.topic === topic); }
    // prefer exact difficulty
    const exact = pool.filter((q) => q.diff === diff);
    const q = pick(exact.length ? exact : pool);
    usedMcq.add(q);
    return { topic, diff: q.diff, kind: "mcq", title: DATA.TOPICS[topic].label, prompt: esc(q.q), choices: q.choices.map(esc), answer: q.answer, explain: `<p>${esc(q.explain)}</p>`, hint: "Think about what each option would actually cause or do in practice." };
  }

  // ---------- Binary ----------
  function genBinary(diff) {
    const t = pick(diff === 1 ? ["d2b", "b2d", "d2b", "b2d", "hostbits"] : ["d2b", "b2d", "h2d", "d2h", "hostbits", "maskones", "bitsum"]);
    if (t === "d2b") {
      const n = diff === 1 ? pick([128, 192, 224, 240, 248, 252, 254, 255, 0, 1, 2, 4, 8, 16, 32, 64, 10, 100, 172, 168, 200]) : randInt(0, 255);
      return { topic: "binary", diff, kind: "input", title: "Binary conversion", prompt: `Convert the decimal octet <b>${n}</b> to 8-bit binary.`, hint: "Bit values left to right: 128 64 32 16 8 4 2 1. Subtract the biggest value that fits and write a 1 for it.",
        fields: [{ key: "b", label: "Binary (8 bits)", answer: IP.octetBin(n), norm: "bin", placeholder: "e.g. 11000000" }],
        explain: `<p>${n} = ${binExplainSum(n)}</p><p>So ${n} = ${code(IP.octetBin(n))}.</p>` };
    }
    if (t === "b2d") {
      const n = randInt(0, 255);
      return { topic: "binary", diff, kind: "input", title: "Binary conversion", prompt: `Convert the binary octet ${code(IP.octetBin(n))} to decimal.`, hint: "Add the place values of every 1 bit: 128 64 32 16 8 4 2 1.",
        fields: [{ key: "d", label: "Decimal", answer: String(n), norm: "int" }], explain: `<p>${IP.octetBin(n)} = ${binExplainSum(n)} = <b>${n}</b>.</p>` };
    }
    if (t === "h2d") {
      const n = randInt(0, 255);
      const hex = n.toString(16).toUpperCase().padStart(2, "0");
      return { topic: "binary", diff, kind: "input", title: "Hex conversion", prompt: `A MAC address contains the hex byte <b>${hex}</b>. What is it in decimal?`, hint: "Each hex digit is 4 bits (0–15). Value = first digit × 16 + second digit. A=10 … F=15.",
        fields: [{ key: "d", label: "Decimal", answer: String(n), norm: "int" }], explain: `<p>${hex[0]} = ${parseInt(hex[0], 16)}, ${hex[1]} = ${parseInt(hex[1], 16)}. ${parseInt(hex[0], 16)} × 16 + ${parseInt(hex[1], 16)} = <b>${n}</b>. In binary: ${code(IP.octetBin(n))}.</p>` };
    }
    if (t === "d2h") {
      const n = randInt(0, 255);
      return { topic: "binary", diff, kind: "input", title: "Hex conversion", prompt: `Convert decimal <b>${n}</b> to two-digit hexadecimal (as you'd see in a MAC or IPv6 address).`, hint: "Divide by 16: the quotient is the first digit, the remainder the second. 10–15 become A–F.",
        fields: [{ key: "h", label: "Hex", answer: n.toString(16).toUpperCase().padStart(2, "0"), norm: "hex", placeholder: "e.g. C0" }], explain: `<p>${n} ÷ 16 = ${Math.floor(n / 16)} remainder ${n % 16} → ${code(n.toString(16).toUpperCase().padStart(2, "0"))}.</p>` };
    }
    if (t === "hostbits") {
      const p = randInt(8, 30);
      return { topic: "binary", diff, kind: "input", title: "Prefix bits", prompt: `A network uses the prefix <b>/${p}</b>. How many bits are for the network and how many for hosts?`, hint: "An IPv4 address is 32 bits. The prefix length is the number of network bits.",
        fields: [{ key: "n", label: "Network bits", answer: String(p), norm: "int" }, { key: "h", label: "Host bits", answer: String(32 - p), norm: "int" }],
        explain: `<p>/${p} means ${p} network bits; 32 − ${p} = <b>${32 - p}</b> host bits, giving 2<sup>${32 - p}</sup> = ${IP.hostCount(p).toLocaleString()} addresses (${IP.usableHosts(p).toLocaleString()} usable).</p>` };
    }
    if (t === "maskones") {
      const p = randInt(8, 30);
      return { topic: "binary", diff, kind: "input", title: "Mask to binary", prompt: `Write the last non-zero, non-255 octet of the mask ${code(IP.maskStr(p))} in binary.`, hint: "Mask octets are always a run of 1s followed by 0s: 128, 192, 224, 240, 248, 252, 254, 255.",
        fields: [{ key: "b", label: "Binary octet", answer: IP.octetBin(interestingOctet(p)), norm: "bin" }],
        explain: `<p>${code(IP.maskStr(p))} in binary is ${code(IP.toBin(IP.maskInt(p)))}. The partial octet is ${interestingOctet(p)} = ${code(IP.octetBin(interestingOctet(p)))}.</p>` };
    }
    // bitsum: how many addresses in a block
    const p = randInt(16, 30);
    return { topic: "binary", diff, kind: "input", title: "Block size", prompt: `How many total addresses (including network and broadcast) are in a <b>/${p}</b> block?`, hint: "2 to the power of the host bits.",
      fields: [{ key: "n", label: "Addresses", answer: String(IP.hostCount(p)), norm: "int" }], explain: `<p>32 − ${p} = ${32 - p} host bits → 2<sup>${32 - p}</sup> = <b>${IP.hostCount(p).toLocaleString()}</b> addresses, of which ${IP.usableHosts(p).toLocaleString()} are usable.</p>` };
  }
  function interestingOctet(p) {
    if (p % 8 === 0) return 255;
    return 256 - Math.pow(2, 8 - (p % 8));
  }
  function binExplainSum(n) {
    const parts = [];
    for (let b = 7; b >= 0; b--) if (n & (1 << b)) parts.push(1 << b);
    return parts.length ? parts.join(" + ") : "0";
  }

  // ---------- IP basics ----------
  function genIpBasics(diff) {
    const t = pick(diff === 1 ? ["kind", "kind", "ipconfig", "class", "bank", "bank"] : ["kind", "ipconfig", "same", "bank", "bank", "bank"]);
    if (t === "kind") {
      const kinds = ["private", "public", "apipa", "loopback", "multicast"];
      const kind = pick(kinds);
      const ip = kindSample(kind);
      const labels = { private: "Private (RFC 1918)", public: "Public (internet-routable)", apipa: "APIPA / link-local (169.254.0.0/16)", loopback: "Loopback (127.0.0.0/8)", multicast: "Multicast (224.0.0.0/4)" };
      return { topic: "ip-basics", diff, kind: "mcq", title: "Address types", prompt: `What type of address is <b>${IP.toStr(ip)}</b>?`, choices: kinds.map((k) => labels[k]), answer: kinds.indexOf(kind), hint: "Private: 10.x, 172.16–31.x, 192.168.x. APIPA: 169.254.x. Loopback: 127.x. Multicast: 224–239.x.",
        explain: `<p>${IP.toStr(ip)} is <b>${labels[kind]}</b>.</p><ul><li>10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 — private</li><li>169.254.0.0/16 — APIPA (DHCP failed)</li><li>127.0.0.0/8 — loopback</li><li>224.0.0.0/4 — multicast</li><li>Everything else — public</li></ul>` };
    }
    if (t === "class") {
      const ip = IP.randomHostV4();
      const cls = IP.ipClass(ip);
      return { topic: "ip-basics", diff, kind: "mcq", title: "Address classes", prompt: `Under classful addressing, which class is <b>${IP.toStr(ip)}</b>?`, choices: ["Class A", "Class B", "Class C", "Class D"], answer: "ABCD".indexOf(cls), hint: "Look at the first octet: 1–126 A, 128–191 B, 192–223 C, 224–239 D.",
        explain: `<p>First octet ${ip >>> 24} → <b>Class ${cls}</b>. Default masks: A /8, B /16, C /24. Classes are historic (CIDR replaced them) but the terms are still used.</p>` };
    }
    if (t === "same") {
      const p = pick([24, 25, 26, 23, 22, 27]);
      const a = IP.randomHostV4(p);
      const net = IP.network(a, p);
      const same = (net + randInt(1, IP.usableHosts(p))) >>> 0;
      const diffNet = (IP.broadcast(a, p) + randInt(1, 20)) >>> 0;
      const isSame = Math.random() < 0.5;
      const b = isSame ? same : diffNet;
      return { topic: "ip-basics", diff, kind: "mcq", title: "Same subnet?", prompt: `PC A is ${code(IP.toStr(a))} with mask ${code(IP.maskStr(p))}. PC B is ${code(IP.toStr(b))} with the same mask. Can they talk directly without a router?`, choices: ["Yes — same subnet", "No — different subnets"], answer: isSame ? 0 : 1, hint: "AND both addresses with the mask. If the results match, they share a subnet.",
        explain: `<p>Network of A: ${code(IP.toStr(net) + "/" + p)}. Network of B: ${code(IP.toStr(IP.network(b, p)) + "/" + p)}. ${isSame ? "They match, so the PCs are on the same subnet and communicate via the switch." : "They differ, so traffic must go through the default gateway."}</p>${subnetExplain(a, p)}` };
    }
    if (t === "ipconfig") return genIpconfigRead(diff);
    return bankMcq("ip-basics", diff);
  }
  function kindSample(kind) {
    switch (kind) {
      case "private": return IP.toInt(pick([`10.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`, `172.${randInt(16, 31)}.${randInt(0, 255)}.${randInt(1, 254)}`, `192.168.${randInt(0, 255)}.${randInt(1, 254)}`]));
      case "apipa": return IP.toInt(`169.254.${randInt(1, 254)}.${randInt(1, 254)}`);
      case "loopback": return IP.toInt(`127.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`);
      case "multicast": return IP.toInt(`${randInt(224, 239)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`);
      default: return IP.toInt(pick([`172.${pick([15, 32, 33, 40])}.${randInt(0, 255)}.${randInt(1, 254)}`, `11.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`, `192.169.${randInt(0, 255)}.${randInt(1, 254)}`, `${pick([8, 45, 64, 96, 142, 151, 198, 203])}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`]));
    }
  }
  function makeLan(prefix) {
    const p = prefix || pick([24, 24, 24, 23, 25, 22, 26]);
    const base = IP.network(IP.toInt(pick([`10.${randInt(0, 250)}.${randInt(0, 255)}.0`, `192.168.${randInt(0, 250)}.0`, `172.${randInt(16, 31)}.${randInt(0, 255)}.0`])), p);
    const usable = IP.usableHosts(p);
    const big = usable >= 100;
    // lay out the subnet: gateway, DNS/DC, file server, printer, a static-host range, then the DHCP scope to the end
    let o = 2;
    const take = (n) => { const r = [o, o + n - 1]; o += n; return r; };
    const dnsR = take(big ? 8 : 1), fsR = take(big ? 10 : 2), prR = take(big ? 10 : 2), stR = take(big ? 20 : Math.max(3, Math.floor(usable / 5)));
    const gw = (base + 1) >>> 0;
    const dns = (base + randInt(dnsR[0], dnsR[1])) >>> 0;
    const fileserver = (base + randInt(fsR[0], fsR[1])) >>> 0;
    const printer = (base + randInt(prR[0], prR[1])) >>> 0;
    const scopeStart = (base + o) >>> 0;
    const scopeEnd = IP.lastHost(base, p);
    const staticRange = [(base + stR[0]) >>> 0, (base + stR[1]) >>> 0];
    const freeStatic = () => (staticRange[0] + randInt(0, staticRange[1] - staticRange[0])) >>> 0;
    return { p, base, gw, dns, scopeStart, scopeEnd, printer, fileserver, staticRange, freeStatic, mask: IP.maskStr(p), cidr: IP.toStr(base) + "/" + p };
  }
  function ipconfigBlock(cfg) {
    const l = [];
    l.push("Windows IP Configuration", "", `   Host Name . . . . . . . . . . . . : ${cfg.host}`, "", "Ethernet adapter Ethernet0:", "");
    l.push(`   Connection-specific DNS Suffix  . : ${cfg.suffix || "corp.local"}`);
    l.push(`   Physical Address. . . . . . . . . : ${cfg.mac}`);
    l.push(`   DHCP Enabled. . . . . . . . . . . : ${cfg.dhcp ? "Yes" : "No"}`);
    l.push(`   IPv4 Address. . . . . . . . . . . : ${cfg.ip}${cfg.dhcp ? "(Preferred)" : ""}`);
    l.push(`   Subnet Mask . . . . . . . . . . . : ${cfg.mask}`);
    if (cfg.dhcp) l.push(`   Lease Obtained. . . . . . . . . . : ${cfg.leaseFrom}`, `   Lease Expires . . . . . . . . . . : ${cfg.leaseTo}`);
    l.push(`   Default Gateway . . . . . . . . . : ${cfg.gw}`);
    if (cfg.dhcp) l.push(`   DHCP Server . . . . . . . . . . . : ${cfg.dhcpServer}`);
    l.push(`   DNS Servers . . . . . . . . . . . : ${cfg.dns[0]}`);
    for (let i = 1; i < cfg.dns.length; i++) l.push(`                                       ${cfg.dns[i]}`);
    return `<pre class="term">${esc(l.join("\n"))}</pre>`;
  }
  function genIpconfigRead(diff) {
    const lan = makeLan();
    const dhcp = Math.random() < 0.7;
    const ip = dhcp ? (lan.scopeStart + randInt(0, Math.min(40, lan.scopeEnd - lan.scopeStart))) >>> 0 : lan.freeStatic();
    const cfg = { host: pick(["WS-", "LT-", "PC-"]) + randInt(100, 999), mac: IP.randomMac(), dhcp, ip: IP.toStr(ip), mask: lan.mask, gw: IP.toStr(lan.gw), dhcpServer: IP.toStr(lan.dns), dns: [IP.toStr(lan.dns), pick(["8.8.8.8", "1.1.1.1", IP.toStr((lan.dns + 1) >>> 0)])], leaseFrom: "Monday, 09:12:04", leaseTo: "Tuesday, 09:12:04" };
    const block = ipconfigBlock(cfg);
    const variants = [
      () => ({ kind: "input", prompt: `Read this output of ${code("ipconfig /all")}. What is the PC's <b>default gateway</b>?${block}`, fields: [{ key: "a", label: "Default gateway", answer: cfg.gw, norm: "ip" }], explain: `<p>The default gateway line shows ${code(cfg.gw)} — the router this PC uses to leave its subnet ${code(lan.cidr)}.</p>` }),
      () => ({ kind: "input", prompt: `Read this ${code("ipconfig /all")} output. Which server is answering <b>DNS</b> queries first?${block}`, fields: [{ key: "a", label: "Primary DNS server", answer: cfg.dns[0], norm: "ip" }], explain: `<p>The first address under DNS Servers is used first; the second is only tried if the first fails. Here that's ${code(cfg.dns[0])}.</p>` }),
      () => ({ kind: "mcq", prompt: `Read this ${code("ipconfig /all")} output. Was this address assigned by DHCP or configured manually?${block}`, choices: ["DHCP (automatic)", "Static (manual)"], answer: dhcp ? 0 : 1, explain: `<p>"DHCP Enabled: ${dhcp ? "Yes" : "No"}"${dhcp ? " plus a DHCP Server and lease times" : " and no lease information"} tells you the address was ${dhcp ? "leased from " + code(cfg.dhcpServer) : "typed in by hand"}.</p>` }),
      () => ({ kind: "input", prompt: `Read this ${code("ipconfig /all")} output. What is the <b>network address</b> of the subnet this PC is on?${block}`, fields: [{ key: "a", label: "Network address", answer: IP.toStr(lan.base), norm: "ip" }], explain: subnetExplain(ip, lan.p) }),
      () => ({ kind: "input", prompt: `Read this ${code("ipconfig /all")} output. What is the PC's <b>MAC (physical) address</b>?${block}`, fields: [{ key: "a", label: "MAC address", answer: cfg.mac, norm: "mac" }], explain: `<p>Windows calls the MAC the "Physical Address": ${code(cfg.mac)}. It's 48 bits shown as six hex pairs; the first three (${cfg.mac.slice(0, 8)}) are the vendor OUI.</p>` }),
    ];
    const v = pick(diff === 1 ? variants.slice(0, 3).concat([variants[4]]) : variants)();
    return Object.assign({ topic: "ip-basics", diff, title: "Reading ipconfig", hint: "Every line in ipconfig /all is labelled. Match the label to the question." }, v);
  }

  // ---------- Subnetting ----------
  function genSubnet(diff) {
    const t = diff === 1 ? pick(["m2c", "c2m", "net", "bc", "hosts", "net", "bc"])
      : diff === 2 ? pick(["net", "bc", "first", "last", "hosts", "sheet", "which", "m2c", "c2m"])
        : pick(["sheet", "sheet", "which", "wild", "last", "first", "nth"]);
    const p = diff === 1 ? randInt(24, 30) : diff === 2 ? randInt(20, 30) : randInt(9, 30);
    const ip = IP.randomHostV4(p);
    const ipS = IP.toStr(ip), cidr = `${ipS}/${p}`;
    const base = { topic: "subnet", diff, title: "Subnetting" };
    switch (t) {
      case "m2c": {
        const pp = randInt(8, 30);
        return Object.assign(base, { kind: "input", prompt: `Convert the subnet mask ${code(IP.maskStr(pp))} to CIDR prefix length.`, hint: "Count the 1 bits. 255 = 8 ones; 254=7, 252=6, 248=5, 240=4, 224=3, 192=2, 128=1.", fields: [{ key: "p", label: "Prefix length (just the number)", answer: String(pp), norm: "prefix", placeholder: "e.g. 24" }], explain: `<p>${code(IP.maskStr(pp))} = ${code(IP.toBin(IP.maskInt(pp)))} has ${pp} one-bits → <b>/${pp}</b>.</p>` });
      }
      case "c2m": {
        const pp = randInt(8, 30);
        return Object.assign(base, { kind: "input", prompt: `Write the dotted-decimal subnet mask for <b>/${pp}</b>.`, hint: "Full octets of 255 for every 8 bits, then one partial octet (128,192,224,240,248,252,254), then zeros.", fields: [{ key: "m", label: "Subnet mask", answer: IP.maskStr(pp), norm: "ip", placeholder: "e.g. 255.255.255.0" }], explain: `<p>/${pp} = ${pp} one-bits: ${code(IP.toBin(IP.maskInt(pp)))} = <b>${IP.maskStr(pp)}</b>.</p>` });
      }
      case "net": return Object.assign(base, { kind: "input", prompt: `What is the <b>network address</b> for host ${code(cidr)}?`, hint: "AND the address with the mask, or use the block-size trick on the interesting octet.", fields: [{ key: "n", label: "Network address", answer: IP.toStr(IP.network(ip, p)), norm: "ip" }], explain: subnetExplain(ip, p) });
      case "bc": return Object.assign(base, { kind: "input", prompt: `What is the <b>broadcast address</b> for host ${code(cidr)}?`, hint: "Find the network address, then set all host bits to 1 (last address of the block).", fields: [{ key: "b", label: "Broadcast address", answer: IP.toStr(IP.broadcast(ip, p)), norm: "ip" }], explain: subnetExplain(ip, p) });
      case "first": return Object.assign(base, { kind: "input", prompt: `What is the <b>first usable host</b> address in the subnet containing ${code(cidr)}?`, hint: "Network address + 1.", fields: [{ key: "f", label: "First usable host", answer: IP.toStr(IP.firstHost(ip, p)), norm: "ip" }], explain: subnetExplain(ip, p) });
      case "last": return Object.assign(base, { kind: "input", prompt: `What is the <b>last usable host</b> address in the subnet containing ${code(cidr)}?`, hint: "Broadcast address − 1.", fields: [{ key: "l", label: "Last usable host", answer: IP.toStr(IP.lastHost(ip, p)), norm: "ip" }], explain: subnetExplain(ip, p) });
      case "hosts": return Object.assign(base, { kind: "input", prompt: `How many <b>usable host addresses</b> are in a <b>/${p}</b> subnet?`, hint: "2^(host bits) − 2 (network and broadcast are not usable). /31 and /32 are special cases.", fields: [{ key: "h", label: "Usable hosts", answer: String(IP.usableHosts(p)), norm: "int" }], explain: `<p>32 − ${p} = ${32 - p} host bits. 2<sup>${32 - p}</sup> = ${IP.hostCount(p).toLocaleString()} addresses − 2 = <b>${IP.usableHosts(p).toLocaleString()}</b> usable.${p >= 31 ? " (/31 point-to-point links use both addresses; /32 is a single host.)" : ""}</p>` });
      case "wild": return Object.assign(base, { kind: "input", prompt: `An ACL needs the <b>wildcard mask</b> for the subnet ${code(IP.toStr(IP.network(ip, p)) + "/" + p)}. What is it?`, hint: "The wildcard is the inverse of the subnet mask: 255 − each mask octet.", fields: [{ key: "w", label: "Wildcard mask", answer: IP.wildcardStr(p), norm: "ip" }], explain: `<p>Mask ${code(IP.maskStr(p))} inverted octet by octet gives <b>${IP.wildcardStr(p)}</b>. In a wildcard, 0 bits must match and 1 bits are "don't care".</p>` });
      case "which": {
        const net = IP.network(ip, p);
        const choices = [IP.toStr(net)];
        const block = IP.hostCount(p);
        const cands = [(net - block) >>> 0, (net + block) >>> 0, (net + 2 * block) >>> 0, (net - 2 * block) >>> 0].filter((x) => x !== net && x < 0xffffffff);
        while (choices.length < 4 && cands.length) choices.push(IP.toStr(cands.splice(randInt(0, cands.length - 1), 1)[0]));
        return Object.assign(base, { kind: "mcq", prompt: `Host ${code(ipS)} uses mask ${code(IP.maskStr(p))}. Which subnet does it belong to?`, hint: "Block size = 256 − interesting mask octet. Subnets start at multiples of the block size.", choices: choices.map((c) => c + "/" + p), answer: 0, explain: subnetExplain(ip, p) });
      }
      case "nth": {
        const parent = pick([24, 16, 20]);
        const newP = parent + randInt(2, 4);
        const count = Math.pow(2, newP - parent);
        const n = randInt(1, count);
        const pbase = IP.network(IP.randomHostV4(parent), parent);
        const answer = (pbase + (n - 1) * IP.hostCount(newP)) >>> 0;
        return Object.assign(base, { kind: "input", prompt: `${code(IP.toStr(pbase) + "/" + parent)} is divided into <b>/${newP}</b> subnets. What is the network address of subnet number <b>${n}</b> (counting from 1)?`, hint: `Each /${newP} block holds ${IP.hostCount(newP)} addresses. Subnet n starts at (n−1) × block size.`, fields: [{ key: "n", label: `Network address of subnet #${n}`, answer: IP.toStr(answer), norm: "ip" }], explain: `<p>A /${parent} split into /${newP} gives 2<sup>${newP - parent}</sup> = ${count} subnets of ${IP.hostCount(newP).toLocaleString()} addresses. Subnet #${n} starts at ${IP.toStr(pbase)} + (${n} − 1) × ${IP.hostCount(newP).toLocaleString()} = <b>${IP.toStr(answer)}/${newP}</b>.</p><p>The first four: ${Array.from({ length: Math.min(4, count) }, (_, i) => code(IP.toStr((pbase + i * IP.hostCount(newP)) >>> 0))).join(", ")}…</p>` });
      }
      default: // sheet
        return Object.assign(base, { kind: "input", title: "Subnet worksheet", prompt: `Complete the worksheet for host ${code(cidr)}.`, hint: "Work out the network address first; everything else follows from it and the block size.",
          fields: [
            { key: "m", label: "Subnet mask", answer: IP.maskStr(p), norm: "ip" },
            { key: "n", label: "Network address", answer: IP.toStr(IP.network(ip, p)), norm: "ip" },
            { key: "f", label: "First usable host", answer: IP.toStr(IP.firstHost(ip, p)), norm: "ip" },
            { key: "l", label: "Last usable host", answer: IP.toStr(IP.lastHost(ip, p)), norm: "ip" },
            { key: "b", label: "Broadcast address", answer: IP.toStr(IP.broadcast(ip, p)), norm: "ip" },
            { key: "h", label: "Usable hosts", answer: String(IP.usableHosts(p)), norm: "int" },
          ], explain: subnetExplain(ip, p) });
    }
  }

  // ---------- VLSM / design ----------
  function genVlsm(diff) {
    const t = diff === 1 ? pick(["forhosts", "forhosts", "split", "count"]) : diff === 2 ? pick(["forhosts", "split", "alloc", "count", "summ"]) : pick(["alloc", "alloc", "summ", "split"]);
    const base = { topic: "vlsm", diff, title: "Subnet design" };
    if (t === "forhosts") {
      const n = pick([2, 5, 10, 12, 14, 20, 25, 30, 50, 60, 62, 63, 100, 120, 126, 200, 250, 254, 300, 500, 1000]);
      const p = IP.prefixForHosts(n);
      return Object.assign(base, { kind: "input", prompt: `A department needs <b>${n}</b> host addresses. What is the <b>smallest subnet</b> (longest prefix) that fits, and its mask?`, hint: "Find the smallest power of two that is ≥ hosts + 2. /26 = 62 hosts, /25 = 126, /24 = 254, /23 = 510…", fields: [{ key: "p", label: "Prefix length", answer: String(p), norm: "prefix" }, { key: "m", label: "Subnet mask", answer: IP.maskStr(p), norm: "ip" }], explain: `<p>${n} hosts + network + broadcast = ${n + 2} addresses needed. The smallest power of two ≥ ${n + 2} is ${IP.hostCount(p)} (2<sup>${32 - p}</sup>), so ${32 - p} host bits → <b>/${p}</b> (${IP.maskStr(p)}), with ${IP.usableHosts(p)} usable hosts.${IP.usableHosts(p + 1) < n && n <= IP.usableHosts(p + 1) + 2 ? " Watch the trap: a /" + (p + 1) + " gives only " + IP.usableHosts(p + 1) + " usable, not " + IP.hostCount(p + 1) + "." : ""}</p>` });
    }
    if (t === "count") {
      const parent = pick([24, 23, 22, 16, 20]);
      const child = parent + randInt(1, 5);
      return Object.assign(base, { kind: "input", prompt: `How many <b>/${child}</b> subnets fit inside one <b>/${parent}</b>?`, hint: "2 to the power of (new prefix − old prefix).", fields: [{ key: "n", label: "Number of subnets", answer: String(Math.pow(2, child - parent)), norm: "int" }], explain: `<p>You borrowed ${child - parent} bits: 2<sup>${child - parent}</sup> = <b>${Math.pow(2, child - parent)}</b> subnets, each with ${IP.usableHosts(child).toLocaleString()} usable hosts.</p>` });
    }
    if (t === "split") {
      const parent = pick([24, 24, 23, 22, 16]);
      const want = pick([2, 4, 8, 4, 16, 3, 5, 6]);
      const newP = IP.prefixForSubnets(parent, want);
      const pbase = IP.network(IP.randomHostV4(parent), parent);
      const k = randInt(2, Math.min(want, 4));
      const kth = (pbase + (k - 1) * IP.hostCount(newP)) >>> 0;
      return Object.assign(base, { kind: "input", prompt: `You must divide ${code(IP.toStr(pbase) + "/" + parent)} into at least <b>${want}</b> equal subnets. What prefix do you use, and what is the network address of subnet #${k}?`, hint: "Borrow bits until 2^bits ≥ subnets wanted. Then count blocks from the parent network.", fields: [{ key: "p", label: "New prefix length", answer: String(newP), norm: "prefix" }, { key: "k", label: `Network address of subnet #${k}`, answer: IP.toStr(kth), norm: "ip" }], explain: `<p>Need ≥ ${want} subnets → borrow ${newP - parent} bit(s) (2<sup>${newP - parent}</sup> = ${Math.pow(2, newP - parent)}), so the new prefix is <b>/${newP}</b> with blocks of ${IP.hostCount(newP).toLocaleString()} addresses.</p><p>Subnets: ${Array.from({ length: Math.min(Math.pow(2, newP - parent), 5) }, (_, i) => code(IP.toStr((pbase + i * IP.hostCount(newP)) >>> 0) + "/" + newP)).join(", ")}${Math.pow(2, newP - parent) > 5 ? "…" : ""}. Subnet #${k} = <b>${IP.toStr(kth)}/${newP}</b>.</p>` });
    }
    if (t === "summ") {
      const p = pick([22, 23, 21, 20]);
      const count = Math.pow(2, 24 - p);
      const start = IP.network(IP.toInt(`${pick([10, 172, 192])}.${randInt(16, 200)}.${randInt(0, 255)}.0`), p);
      const list = Array.from({ length: count }, (_, i) => IP.toStr((start + i * 256) >>> 0) + "/24");
      return Object.assign(base, { kind: "input", prompt: `Summarise (supernet) these contiguous networks into one route: ${list.map(code).join(", ")}.`, hint: "Count the /24s (a power of two) and shorten the prefix by that many bits. The first network must be aligned to the block.", fields: [{ key: "s", label: "Summary route (CIDR)", answer: IP.toStr(start) + "/" + p, norm: "cidr", placeholder: "a.b.c.d/p" }], explain: `<p>${count} × /24 = 2<sup>${24 - p}</sup> blocks, so move the prefix left ${24 - p} bits: <b>${IP.toStr(start)}/${p}</b>. Route summarisation shrinks routing tables; the summary must start on a multiple of ${count} in the third octet (${(start >>> 8) & 255} is).</p>` });
    }
    // alloc: VLSM allocation
    const pbase = IP.network(IP.toInt(`${pick(["192.168", "10.10", "172.16"])}.${randInt(0, 200)}.0`), 24);
    const depts = sample(["Sales", "Engineering", "HR", "Finance", "Warehouse", "Guest Wi-Fi", "Servers", "Printers"], 3);
    const sizes = shuffle([pick([100, 110, 120, 126]), pick([40, 50, 60, 62]), pick([10, 12, 14, 20, 25, 30])]);
    const reqs = depts.map((d, i) => ({ d, n: sizes[i], p: IP.prefixForHosts(sizes[i]) }));
    const sorted = reqs.slice().sort((a, b) => a.p - b.p);
    let cursor = pbase;
    for (const r of sorted) { r.net = cursor; cursor = (cursor + IP.hostCount(r.p)) >>> 0; }
    const fields = [];
    for (const r of sorted) fields.push({ key: r.d + "p", label: `${r.d}: prefix`, answer: String(r.p), norm: "prefix" }, { key: r.d + "n", label: `${r.d}: network address`, answer: IP.toStr(r.net), norm: "ip" });
    return Object.assign(base, { kind: "input", title: "VLSM allocation", prompt: `Carve ${code(IP.toStr(pbase) + "/24")} with VLSM. Allocate the <b>largest department first</b>, packing subnets back to back from the start of the block.<ul>${reqs.map((r) => `<li><b>${r.d}</b>: ${r.n} hosts</li>`).join("")}</ul>`, hint: "Sort by size (biggest first). Give each the smallest prefix that fits, and start each subnet right after the previous one ends.", fields, explain: `<p>Sorted largest first:</p><ol>${sorted.map((r) => `<li><b>${r.d}</b> (${r.n} hosts) → /${r.p} (${IP.usableHosts(r.p)} usable): ${code(IP.toStr(r.net) + "/" + r.p)} through ${code(IP.toStr(IP.broadcast(r.net, r.p)))}</li>`).join("")}</ol><p>Allocating biggest first keeps every subnet aligned to its own block size; ${IP.toStr(cursor)} onward remains free for growth.</p>` });
  }

  // ---------- IPv6 ----------
  function genIpv6(diff) {
    const t = diff === 1 ? pick(["compress", "expand", "type", "bank", "compress", "type"]) : pick(["compress", "expand", "type", "bank", "valid", "expand"]);
    const base = { topic: "ipv6", diff, title: "IPv6" };
    if (t === "compress") {
      const full = IP.randomV6();
      return Object.assign(base, { kind: "input", prompt: `Write this IPv6 address in its shortest valid form:<br>${code(full)}`, hint: "1) Drop leading zeros in each group. 2) Replace the single longest run of all-zero groups with :: (leftmost if tied). Never use :: twice.", fields: [{ key: "c", label: "Compressed address", answer: IP.compressV6(full), norm: "v6" }], explain: `<p>Leading zeros removed: ${code(full.split(":").map((g) => g.replace(/^0+(?=.)/, "")).join(":"))}.<br>Longest run of zero groups collapsed to <code>::</code> → <b>${IP.compressV6(full)}</b>.</p><p>Rules: only one <code>::</code> per address; a single zero group is written as <code>0</code>, not <code>::</code>, when a longer run exists elsewhere.</p>` });
    }
    if (t === "expand") {
      const full = IP.randomV6();
      const short = IP.compressV6(full);
      return Object.assign(base, { kind: "input", prompt: `Expand ${code(short)} to its full 8-group, 32-hex-digit form.`, hint: "Each group must have 4 hex digits. :: stands for as many zero groups as needed to reach 8 groups.", fields: [{ key: "e", label: "Full address", answer: full, norm: "v6" }], explain: `<p>${code(short)} has ${short.split("::").length === 2 ? `${8 - short.replace(/^::|::$/g, "").split("::").join(":").split(":").filter(Boolean).length} group(s) hidden by ::` : "no ::"} → <b>${full}</b>.</p>` });
    }
    if (t === "type") {
      const types = ["global-unicast", "link-local", "unique-local", "multicast", "loopback"];
      const labels = { "global-unicast": "Global unicast (2000::/3) — public, routable", "link-local": "Link-local (fe80::/10) — auto-assigned, never routed", "unique-local": "Unique local (fc00::/7) — private, like RFC 1918", "multicast": "Multicast (ff00::/8)", "loopback": "Loopback (::1)" };
      const type = pick(types);
      const addr = type === "loopback" ? "::1" : IP.compressV6(IP.randomV6(type));
      return Object.assign(base, { kind: "mcq", prompt: `What kind of IPv6 address is ${code(addr)}?`, hint: "Look at the first hex digits: 2xxx/3xxx global, fe80 link-local, fc/fd unique-local, ff multicast.", choices: types.map((x) => labels[x]), answer: types.indexOf(type), explain: `<p>${code(addr)} starts with ${code(addr.split(":")[0] || "::")} → <b>${labels[type]}</b>.</p><ul><li>Every IPv6 interface has a link-local fe80:: address, even with no DHCP.</li><li>ff02::1 = all nodes, ff02::2 = all routers (IPv6 has no broadcast).</li><li>SLAAC lets hosts build their own global address from the router advertisement.</li></ul>` });
    }
    if (t === "valid") {
      const good = IP.compressV6(IP.randomV6());
      const bads = [good.replace("::", ":0:").replace(/^([0-9a-f]+):/, "$1::").replace(/:([0-9a-f]+)$/, "::$1"), good.replace(/[0-9a-f]{1,4}$/, "g1z2"), good + ":ffff:1", good.replace(/:/, ".")];
      const choices = shuffle([good].concat(bads.filter((b) => !IP.isValidV6(b)).slice(0, 3)));
      return Object.assign(base, { kind: "mcq", prompt: "Which of these is a <b>valid</b> IPv6 address?", hint: "Valid: hex digits 0–f only, at most 8 groups, at most one ::.", choices, answer: choices.indexOf(good), explain: `<p>Only ${code(good)} is valid. The others use non-hex characters, more than 8 groups, dots, or a second <code>::</code>.</p>` });
    }
    const bank = [
      ["Which IPv6 address type replaces broadcast for reaching all hosts on a link?", ["Multicast ff02::1", "Anycast", "Link-local fe80::1", "Unique local fd00::1"], 0, "IPv6 has no broadcast. ff02::1 is the all-nodes link-local multicast group; ff02::2 is all routers."],
      ["How many bits is an IPv6 address?", ["128", "64", "32", "48"], 0, "128 bits = 8 groups of 16 bits (4 hex digits each). The usual host subnet is a /64."],
      ["Which mechanism lets an IPv6 host configure its own address from a router advertisement without a DHCP server?", ["SLAAC", "APIPA", "NAT64", "DHCPv4"], 0, "Stateless Address Autoconfiguration uses Router Advertisements (ICMPv6) and often EUI-64 or a random interface ID."],
      ["What is the standard prefix length for an IPv6 LAN subnet?", ["/64", "/24", "/128", "/48"], 0, "/64 is expected by SLAAC. Organisations typically receive a /48 and carve /64s. /128 is a single host."],
      ["Which protocol replaces ARP in IPv6?", ["Neighbor Discovery (ICMPv6 NDP)", "RARP", "DHCPv6", "IGMP"], 0, "NDP uses ICMPv6 Neighbor Solicitation/Advertisement messages instead of ARP broadcasts."],
      ["Which IPv6 transition technology lets IPv6-only clients reach IPv4 servers?", ["NAT64 with DNS64", "6to4", "Dual stack", "Teredo"], 0, "NAT64 translates between the families; DNS64 synthesises AAAA records. Dual stack runs both; tunnels (6to4, Teredo) carry v6 over v4."],
      ["What does ::1 represent?", ["The IPv6 loopback address", "The default gateway", "An unspecified address", "The all-routers multicast"], 0, ":: is unspecified; ::1 is loopback (like 127.0.0.1)."],
    ];
    const q = pick(bank);
    return Object.assign(base, { kind: "mcq", prompt: esc(q[0]), choices: q[1].map(esc), answer: q[2], hint: "IPv6 basics: 128 bits, fe80 link-local, ff02 multicast, no broadcast, /64 subnets.", explain: `<p>${esc(q[3])}</p>` });
  }

  // ---------- Ports ----------
  function genPorts(diff) {
    const t = diff === 1 ? pick(["match", "match", "whichport", "whichsvc", "bank"]) : pick(["match", "tcpudp", "whichport", "bank", "bank"]);
    const base = { topic: "ports", diff, title: "Ports & protocols" };
    const core = DATA.PORTS.filter((p) => diff > 1 || ["20/21", "22", "23", "25", "53", "67/68", "80", "110", "143", "443", "3389", "123", "445"].includes(p.port));
    if (t === "match") {
      const set = sample(core, 6);
      return Object.assign(base, { kind: "match", prompt: "Match each service to its port number.", hint: "Web 80/443, mail 25/110/143, remote 22/23/3389, DNS 53, DHCP 67/68, FTP 20/21.", pairs: set.map((p) => ({ l: p.name, r: p.port })), explain: `<ul>${set.map((p) => `<li><b>${esc(p.name)}</b> — ${p.port} (${p.proto}): ${esc(p.desc)}</li>`).join("")}</ul>` });
    }
    if (t === "tcpudp") {
      const items = sample(DATA.PORTS.filter((p) => p.proto !== "TCP/UDP"), 6).map((p) => ({ text: `${p.name} (${p.port})`, bucket: p.proto }));
      return Object.assign(base, { kind: "bucket", prompt: "Sort each service by the transport protocol it uses.", hint: "UDP: DHCP, TFTP, NTP, SNMP, syslog. TCP: anything connection-oriented (web, mail, SSH, RDP, SMB, databases).", buckets: ["TCP", "UDP"], items, explain: `<p>UDP suits small, time-sensitive or broadcast-based exchanges (DHCP, NTP, SNMP, syslog, TFTP). TCP is used where reliability matters (HTTP, SMTP, SSH, RDP, SMB). DNS uses both: UDP for queries, TCP for zone transfers and large responses.</p>` });
    }
    if (t === "whichport") {
      const p = pick(core);
      const others = sample(core.filter((x) => x.port !== p.port), 3).map((x) => x.port);
      const choices = shuffle([p.port].concat(others));
      return Object.assign(base, { kind: "mcq", prompt: `Which port number does <b>${esc(p.name)}</b> use?`, hint: p.desc, choices, answer: choices.indexOf(p.port), explain: `<p><b>${esc(p.name)}</b> — port ${p.port} (${p.proto}). ${esc(p.desc)}.</p>` });
    }
    if (t === "whichsvc") {
      const p = pick(core);
      const others = sample(core.filter((x) => x.port !== p.port), 3).map((x) => x.name);
      const choices = shuffle([p.name].concat(others));
      return Object.assign(base, { kind: "mcq", prompt: `A firewall log shows traffic to port <b>${p.port}</b>. Which service is that?`, hint: p.desc, choices: choices.map(esc), answer: choices.indexOf(p.name), explain: `<p>Port ${p.port} = <b>${esc(p.name)}</b> (${p.proto}). ${esc(p.desc)}.</p>` });
    }
    return bankMcq("ports", diff);
  }

  // ---------- OSI ----------
  function genOsi(diff) {
    const t = diff === 1 ? pick(["bucket", "layerof", "pdu", "bank", "layerof"]) : pick(["bucket", "layerof", "pdu", "bank", "bank"]);
    const base = { topic: "osi", diff, title: "OSI model" };
    const names = DATA.OSI.map((l) => `${l.n} — ${l.name}`);
    if (t === "bucket") {
      const items = [];
      for (const l of sample(DATA.OSI, diff === 1 ? 4 : 6)) items.push({ text: pick(l.items), bucket: `${l.n} — ${l.name}` });
      return Object.assign(base, { kind: "bucket", prompt: "Assign each item to the OSI layer where it belongs.", hint: "Physical: cables/bits. Data Link: MAC/switch/frame. Network: IP/router/packet. Transport: TCP/UDP/port. Session/Presentation/Application: everything above.", buckets: names, items: shuffle(items), explain: `<table class="ref"><tr><th>Layer</th><th>PDU</th><th>Examples</th></tr>${DATA.OSI.map((l) => `<tr><td>${l.n} ${l.name}</td><td>${l.pdu}</td><td>${l.items.slice(0, 5).join(", ")}</td></tr>`).join("")}</table>` });
    }
    if (t === "layerof") {
      const l = pick(DATA.OSI);
      const item = pick(l.items);
      const choices = shuffle(sample(DATA.OSI.filter((x) => x !== l), 3).concat([l]).map((x) => `Layer ${x.n} — ${x.name}`));
      return Object.assign(base, { kind: "mcq", prompt: `At which OSI layer does <b>${esc(item)}</b> operate?`, hint: "Please Do Not Throw Sausage Pizza Away (1→7).", choices, answer: choices.indexOf(`Layer ${l.n} — ${l.name}`), explain: `<p><b>${esc(item)}</b> belongs to layer ${l.n}, <b>${l.name}</b> (PDU: ${l.pdu}). Others at this layer: ${l.items.filter((x) => x !== item).slice(0, 4).join(", ")}.</p>` });
    }
    if (t === "pdu") {
      const l = pick(DATA.OSI.filter((x) => x.n <= 4));
      const choices = ["Bits", "Frame", "Packet", "Segment", "Data"];
      return Object.assign(base, { kind: "mcq", prompt: `What is the protocol data unit (PDU) called at layer ${l.n}, the <b>${l.name}</b> layer?`, hint: "Bits, Frames, Packets, Segments from layer 1 up.", choices, answer: choices.indexOf(l.pdu), explain: `<p>Layer ${l.n} ${l.name} → <b>${l.pdu}</b>. Layer 1 bits, 2 frames, 3 packets, 4 segments (TCP) or datagrams (UDP), 5–7 data.</p>` });
    }
    return bankMcq("osi", diff);
  }

  // ---------- Sequences ----------
  const seqUsed = [];
  function genSequence(diff, filterIds) {
    let pool = DATA.SEQUENCES.filter((s) => !filterIds || filterIds.includes(s.id));
    let fresh = pool.filter((s) => !seqUsed.includes(s.id));
    if (!fresh.length) { pool.forEach((s) => { const i = seqUsed.indexOf(s.id); if (i >= 0) seqUsed.splice(i, 1); }); fresh = pool; }
    const s = pick(fresh);
    seqUsed.push(s.id);
    return { topic: "sequences", diff, kind: "order", title: "Put it in order", prompt: esc(s.title) + ".", hint: "Tap the steps in order. Tap a placed step to remove it.", items: s.items, colors: s.colors ? DATA.WIRE_COLORS : null, explain: `<ol>${s.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ol><p>${esc(s.explain)}</p>` };
  }

  // ---------- Cabling ----------
  function genCabling(diff) {
    const t = pick(["bank", "bank", "bank", "conn", "speed", "t568"]);
    const base = { topic: "cabling", diff, title: "Cabling" };
    if (t === "conn") {
      const set = sample(DATA.CONNECTORS, 5);
      return Object.assign(base, { kind: "match", prompt: "Match each connector to what it is used for.", hint: "RJ = registered jack (copper). LC/SC/ST = fiber. F-type/BNC = coax.", pairs: set.map((c) => ({ l: c.name, r: c.use })), explain: `<ul>${DATA.CONNECTORS.map((c) => `<li><b>${esc(c.name)}</b> — ${esc(c.use)}</li>`).join("")}</ul>` });
    }
    if (t === "speed") {
      const distinct = DATA.CABLES.filter((x, i, a) => a.findIndex((y) => y.speed === x.speed) === i).slice(0, 5);
      const c = pick(distinct);
      const choices = shuffle(sample(distinct.filter((x) => x !== c), 3).concat([c]).map((x) => x.speed));
      return Object.assign(base, { kind: "mcq", prompt: `What is the rated speed of <b>${esc(c.name)}</b>?`, hint: "5e = 1G, 6 = 10G to 55 m, 6a = 10G to 100 m, 8 = 25/40G to 30 m.", choices, answer: choices.indexOf(c.speed), explain: `<table class="ref"><tr><th>Cable</th><th>Speed</th><th>Distance</th></tr>${DATA.CABLES.slice(0, 5).map((x) => `<tr><td>${x.name}</td><td>${x.speed}</td><td>${x.dist}</td></tr>`).join("")}</table>` });
    }
    if (t === "t568") return Object.assign(genSequence(diff, ["t568b", "t568a"]), { topic: "cabling", title: "Cable termination" });
    return bankMcq("cabling", diff);
  }

  // ---------- Wireless ----------
  function genWireless(diff) {
    const t = pick(["bank", "bank", "bank", "gen", "band"]);
    const base = { topic: "wireless", diff, title: "Wireless" };
    if (t === "gen") {
      const set = DATA.WIFI.filter((w) => w.gen !== "—");
      return Object.assign(base, { kind: "match", prompt: "Match each 802.11 standard to its Wi-Fi generation name.", hint: "n=4, ac=5, ax=6, be=7.", pairs: set.map((w) => ({ l: w.std, r: w.gen })), explain: `<table class="ref"><tr><th>Std</th><th>Name</th><th>Band</th><th>Max speed</th></tr>${DATA.WIFI.map((w) => `<tr><td>${w.std}</td><td>${w.gen}</td><td>${w.band}</td><td>${w.speed}</td></tr>`).join("")}</table>` });
    }
    if (t === "band") {
      const w = pick(DATA.WIFI);
      const choices = ["2.4 GHz only", "5 GHz only", "2.4 and 5 GHz", "2.4, 5 and 6 GHz"];
      const ans = w.band.startsWith("2.4 / 5 GHz (+6") ? 2 : w.band.startsWith("2.4 / 5 / 6") ? 3 : w.band.startsWith("2.4 / 5") ? 2 : w.band.startsWith("2.4") ? 0 : 1;
      return Object.assign(base, { kind: "mcq", prompt: `Which band(s) does <b>${w.std}${w.gen !== "—" ? " (" + w.gen + ")" : ""}</b> operate on?`, hint: "a/ac = 5 GHz only. b/g = 2.4 only. n/ax = both. be = all three (6E adds 6 GHz to ax).", choices, answer: ans, explain: `<p><b>${w.std}</b> (${w.gen}): ${w.band}, up to ${w.speed}.</p>` });
    }
    return bankMcq("wireless", diff);
  }

  // ---------- Services / devices / troubleshoot: bank + matches ----------
  function genServices(diff) {
    const t = pick(["bank", "bank", "bank", "dns"]);
    if (t === "dns") {
      const set = sample(DATA.DNS_RECORDS, 5);
      return { topic: "services", diff, kind: "match", title: "DNS records", prompt: "Match each DNS record type to what it does.", hint: "A/AAAA = address, CNAME = alias, MX = mail, PTR = reverse, NS = name server, TXT = text, SRV = service.", pairs: set.map((r) => ({ l: r.type, r: r.desc })), explain: `<ul>${DATA.DNS_RECORDS.map((r) => `<li><b>${r.type}</b> — ${esc(r.desc)}</li>`).join("")}</ul>` };
    }
    return bankMcq("services", diff);
  }
  function genTroubleshoot(diff) {
    const t = pick(["bank", "bank", "bank", "cmd", "steps"]);
    if (t === "cmd") {
      const set = sample(DATA.COMMANDS.slice(0, 14), 5);
      return { topic: "troubleshoot", diff, kind: "match", title: "Command line tools", prompt: "Match each command to what it does.", hint: "ipconfig = my config, ping = reachability, tracert = path, nslookup = DNS, arp = IP→MAC, netstat = connections.", pairs: set.map((c) => ({ l: c.cmd, r: c.desc })), explain: `<ul>${set.map((c) => `<li>${code(c.cmd)} (${c.os}) — ${esc(c.desc)}</li>`).join("")}</ul>` };
    }
    if (t === "steps") return Object.assign(genSequence(diff, ["trouble"]), { topic: "troubleshoot" });
    return bankMcq("troubleshoot", diff);
  }

  // ---------- IP config fixer scenarios ----------
  function genIpFix(diff) {
    const lan = makeLan(diff === 1 ? 24 : diff === 2 ? pick([24, 25, 23, 26]) : pick([22, 25, 26, 27, 23, 20]));
    const faultsAll = ["mask", "gateway", "ip", "dns", "apipa", "duplicate"];
    const nFaults = diff === 3 ? 2 : 1;
    let faults;
    if (diff === 1) faults = [pick(["gateway", "dns", "apipa", "ip"])];
    else faults = sample(faultsAll.filter((f) => nFaults === 1 || (f !== "apipa" && f !== "duplicate")), nFaults);
    const goodIp = lan.freeStatic(); // documented static range: outside the DHCP scope and clear of servers
    const cfg = { mode: faults.includes("apipa") ? "dhcp" : "static", ip: IP.toStr(goodIp), mask: lan.mask, gw: IP.toStr(lan.gw), dns: IP.toStr(lan.dns) };
    const symptoms = [];
    for (const f of faults) {
      switch (f) {
        case "mask": {
          // choose a wrong mask that puts the gateway outside the PC's idea of the subnet, or is simply wrong
          const wrongP = pick([lan.p + 2, lan.p + 3, lan.p - 8, lan.p + 1].filter((x) => x >= 8 && x <= 30 && x !== lan.p));
          cfg.mask = IP.maskStr(wrongP);
          symptoms.push("I can print, but some servers and the internet are unreachable.");
          break;
        }
        case "gateway": {
          const wrong = Math.random() < 0.5 ? IP.toStr((lan.gw + randInt(200, 250)) >>> 0) : IP.toStr(IP.toInt(cfg.gw) ^ (1 << randInt(8, 18)));
          cfg.gw = wrong;
          symptoms.push("Shared drives on this floor work, but nothing on the internet loads.");
          break;
        }
        case "ip": {
          cfg.ip = IP.toStr((IP.toInt(cfg.ip) ^ (1 << randInt(Math.max(8, 32 - lan.p + 1), 20))) >>> 0);
          symptoms.push("Nothing works — not even the printer down the hall.");
          break;
        }
        case "dns": {
          cfg.dns = pick([IP.toStr((lan.dns ^ 1) >>> 0), IP.toStr((lan.scopeEnd - 1) >>> 0), "8.8.8.8", IP.toStr(IP.toInt(cfg.dns) ^ (1 << 12))]);
          symptoms.push(cfg.dns === "8.8.8.8" ? "Google works but I can't open the intranet or any internal server by name." : "I can ping IP addresses fine but no website or server name resolves.");
          break;
        }
        case "apipa": {
          cfg.ip = `169.254.${randInt(1, 254)}.${randInt(1, 254)}`; cfg.mask = "255.255.0.0"; cfg.gw = ""; cfg.dns = "";
          symptoms.push("It says 'No internet access'. IT rewired the desk yesterday.");
          break;
        }
        case "duplicate": {
          cfg.ip = IP.toStr(lan.printer);
          symptoms.push("A popup said 'IP address conflict'. Sometimes it works, sometimes it doesn't, and the printer keeps dropping too.");
          break;
        }
      }
    }
    const requireStatic = !faults.includes("apipa") && Math.random() < 0.85;
    const faultLabels = { mask: "Wrong subnet mask", gateway: "Wrong default gateway", ip: "IP address outside the subnet", dns: "Wrong DNS server", apipa: "No DHCP lease (APIPA address)", duplicate: "Duplicate IP address (conflict)" };
    return {
      topic: "ipfix", diff, kind: "ipfix", title: "Fix the workstation", prompt: "",
      hint: "Compare every field against the network documentation. Compute the subnet range from the CIDR and check the IP, gateway and DNS all belong to it (and to nothing else).",
      scenario: { lan, cfg: Object.assign({}, cfg), original: Object.assign({}, cfg), faults, requireStatic, symptoms, faultLabels, user: pick(["Dana in Accounting", "Marcus (Sales)", "the front desk kiosk", "Priya in Engineering", "the warehouse scanner PC", "Jordan in HR"]) },
      explain: "", // built at check time
    };
  }

  // ---------- generic dispatch ----------
  const GEN = {
    "ip-basics": genIpBasics, binary: genBinary, subnet: genSubnet, vlsm: genVlsm, ipv6: genIpv6, ports: genPorts, osi: genOsi,
    sequences: (d) => genSequence(d), cabling: genCabling, wireless: genWireless, services: genServices, troubleshoot: genTroubleshoot,
    ipfix: genIpFix, devices: (d) => bankMcq("devices", d), security: (d) => bankMcq("security", d), hardware: (d) => bankMcq("hardware", d),
    windows: (d) => bankMcq("windows", d), ops: (d) => bankMcq("ops", d),
    terminal: (d) => NetSim.generate(d),
  };
  function generate(topic, diff) {
    const task = GEN[topic](diff);
    task.topic = task.topic || topic;
    task.diff = task.diff || diff;
    task.xp = task.xp || ({ mcq: 10, input: 12, match: 14, bucket: 14, order: 14, ipfix: 25, terminal: 30 }[task.kind] || 10) * task.diff;
    return task;
  }

  // ---------- answer normalisation ----------
  function normalize(v, norm) {
    v = String(v || "").trim();
    switch (norm) {
      case "ip": return IP.normV4(v) || v.toLowerCase();
      case "int": return String(parseInt(v.replace(/[,\s]/g, ""), 10));
      case "prefix": return String(parseInt(v.replace(/^\//, ""), 10));
      case "bin": return v.replace(/[\s.]/g, "");
      case "hex": return v.replace(/^0x/i, "").toUpperCase().padStart(2, "0");
      case "v6": { const e = IP.expandV6(v); return e || v.toLowerCase(); }
      case "mac": return v.toUpperCase().replace(/[:.]/g, "-").replace(/^([0-9A-F]{4})-?([0-9A-F]{4})-?([0-9A-F]{4})$/, (m, a, b, c) => (a + b + c).match(/.{2}/g).join("-"));
      case "cidr": { const c = IP.parseCidr(v); return c ? IP.toStr(c.ip) + "/" + c.prefix : v.toLowerCase(); }
      default: return v.toLowerCase();
    }
  }
  function fieldCorrect(field, value) {
    return normalize(value, field.norm) === normalize(field.answer, field.norm);
  }

  global.Challenges = { generate, normalize, fieldCorrect, subnetExplain, ipconfigBlock, makeLan, esc };
})(typeof window !== "undefined" ? window : globalThis);
