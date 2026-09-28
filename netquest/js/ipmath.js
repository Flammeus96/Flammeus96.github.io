/* NetQuest — IPv4 / IPv6 math and small random helpers.
   Plain script (no modules) so it works from file:// and GitHub Pages alike. */
(function (global) {
  "use strict";

  // ---------- random helpers ----------
  const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const sample = (arr, n) => shuffle(arr).slice(0, n);

  // ---------- IPv4 ----------
  const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

  function isValidV4(s) {
    const m = IPV4_RE.exec(String(s).trim());
    if (!m) return false;
    for (let i = 1; i <= 4; i++) {
      const o = m[i];
      if (o.length > 1 && o[0] === "0") return false; // no leading zeros
      if (+o > 255) return false;
    }
    return true;
  }
  function toInt(s) {
    return String(s).trim().split(".").reduce((a, o) => ((a << 8) | (+o)) >>> 0, 0) >>> 0;
  }
  function toStr(n) {
    n = n >>> 0;
    return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
  }
  function maskInt(prefix) {
    if (prefix <= 0) return 0;
    if (prefix >= 32) return 0xffffffff;
    return (0xffffffff << (32 - prefix)) >>> 0;
  }
  const maskStr = (prefix) => toStr(maskInt(prefix));
  function prefixFromMask(s) {
    if (!isValidV4(s)) return -1;
    const n = toInt(s);
    let p = 0;
    // must be contiguous ones followed by zeros
    for (let i = 31; i >= 0; i--) {
      if ((n >>> i) & 1) { if (p !== 31 - i) return -1; p++; } else break;
    }
    // verify no stray ones after the first zero
    if (((n << p) >>> 0) !== 0 && p !== 32) return -1;
    return p;
  }
  const wildcardStr = (prefix) => toStr((~maskInt(prefix)) >>> 0);
  const network = (ip, prefix) => (ip & maskInt(prefix)) >>> 0;
  const broadcast = (ip, prefix) => (network(ip, prefix) | (~maskInt(prefix) >>> 0)) >>> 0;
  const hostCount = (prefix) => Math.pow(2, 32 - prefix);
  const usableHosts = (prefix) => (prefix >= 31 ? (prefix === 31 ? 2 : 1) : hostCount(prefix) - 2);
  const firstHost = (ip, prefix) => (prefix >= 31 ? network(ip, prefix) : network(ip, prefix) + 1) >>> 0;
  const lastHost = (ip, prefix) => (prefix >= 31 ? broadcast(ip, prefix) : broadcast(ip, prefix) - 1) >>> 0;
  const sameSubnet = (a, b, prefix) => network(a, prefix) === network(b, prefix);

  function toBin(n, dots = true) {
    const s = (n >>> 0).toString(2).padStart(32, "0");
    return dots ? s.match(/.{8}/g).join(".") : s;
  }
  const octetBin = (o) => (o & 255).toString(2).padStart(8, "0");

  function ipClass(ip) {
    const f = ip >>> 24;
    if (f < 128) return "A";
    if (f < 192) return "B";
    if (f < 224) return "C";
    if (f < 240) return "D";
    return "E";
  }
  function inRange(ip, cidr) {
    const [base, p] = cidr.split("/");
    return network(ip, +p) === network(toInt(base), +p);
  }
  const isPrivate = (ip) => inRange(ip, "10.0.0.0/8") || inRange(ip, "172.16.0.0/12") || inRange(ip, "192.168.0.0/16");
  const isApipa = (ip) => inRange(ip, "169.254.0.0/16");
  const isLoopback = (ip) => inRange(ip, "127.0.0.0/8");
  const isMulticast = (ip) => inRange(ip, "224.0.0.0/4");
  const isCgnat = (ip) => inRange(ip, "100.64.0.0/10");
  function kindOf(ip) {
    if (isLoopback(ip)) return "loopback";
    if (isApipa(ip)) return "apipa";
    if (isPrivate(ip)) return "private";
    if (isMulticast(ip)) return "multicast";
    if (isCgnat(ip)) return "cgnat";
    if ((ip >>> 24) >= 240) return "reserved";
    return "public";
  }

  // Smallest prefix whose usable host count fits n hosts.
  function prefixForHosts(n) {
    for (let p = 30; p >= 0; p--) if (usableHosts(p) >= n) return p;
    return 0;
  }
  // Smallest prefix that yields at least n subnets from a parent prefix.
  function prefixForSubnets(parentPrefix, n) {
    let p = parentPrefix;
    while (Math.pow(2, p - parentPrefix) < n) p++;
    return p;
  }

  // A "nice" random address for a practice question. Uses private ranges mostly.
  function randomHostV4(prefix) {
    const family = pick(["10", "172", "192", "192", "10", "pub"]);
    let ip;
    if (family === "10") ip = toInt(`10.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`);
    else if (family === "172") ip = toInt(`172.${randInt(16, 31)}.${randInt(0, 255)}.${randInt(1, 254)}`);
    else if (family === "192") ip = toInt(`192.168.${randInt(0, 255)}.${randInt(1, 254)}`);
    else ip = toInt(`${pick([64, 72, 96, 128, 142, 150, 172, 198, 203, 8, 45, 66])}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`);
    if (prefix !== undefined) {
      // make sure it's a host, not the network/broadcast address (when possible)
      const net = network(ip, prefix), bc = broadcast(ip, prefix);
      if (prefix <= 30 && (ip === net || ip === bc)) ip = (net + 1 + randInt(0, Math.max(0, usableHosts(prefix) - 1))) >>> 0;
    }
    return ip;
  }

  // Random prefix biased toward useful subnetting exercise ranges.
  function randomPrefix(min = 20, max = 30) {
    return randInt(min, max);
  }

  // Parse "a.b.c.d/p" -> {ip, prefix} or null
  function parseCidr(s) {
    const m = /^([\d.]+)\/(\d{1,2})$/.exec(String(s).trim());
    if (!m || !isValidV4(m[1]) || +m[2] > 32) return null;
    return { ip: toInt(m[1]), prefix: +m[2] };
  }

  // Normalise user typed IPv4 (tolerate spaces)
  function normV4(s) {
    s = String(s || "").trim();
    return isValidV4(s) ? toStr(toInt(s)) : null;
  }

  // ---------- IPv6 ----------
  function expandV6(s) {
    s = String(s).trim().toLowerCase();
    if (s.includes("%")) s = s.split("%")[0];
    if (!/^[0-9a-f:]+$/.test(s)) return null;
    const parts = s.split("::");
    if (parts.length > 2) return null;
    const head = parts[0] ? parts[0].split(":") : [];
    const tail = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
    if (parts.length === 1 && head.length !== 8) return null;
    if (head.concat(tail).some((g) => g.length === 0 || g.length > 4)) return null;
    const missing = 8 - head.length - tail.length;
    if (parts.length === 2 && missing < 1) return null;
    const groups = head.concat(Array(parts.length === 2 ? missing : 0).fill("0"), tail);
    if (groups.length !== 8) return null;
    return groups.map((g) => g.padStart(4, "0")).join(":");
  }
  function compressV6(s) {
    const full = expandV6(s);
    if (!full) return null;
    const groups = full.split(":").map((g) => g.replace(/^0+(?=.)/, ""));
    // find longest run of zero groups (len >= 2), leftmost wins ties
    let best = -1, bestLen = 0, cur = -1, curLen = 0;
    for (let i = 0; i <= groups.length; i++) {
      if (i < groups.length && groups[i] === "0") {
        if (cur < 0) { cur = i; curLen = 0; }
        curLen++;
      } else {
        if (curLen > bestLen && curLen >= 2) { best = cur; bestLen = curLen; }
        cur = -1; curLen = 0;
      }
    }
    if (best < 0) return groups.join(":");
    const left = groups.slice(0, best).join(":");
    const right = groups.slice(best + bestLen).join(":");
    return `${left}::${right}`;
  }
  const isValidV6 = (s) => expandV6(s) !== null;
  function v6Type(s) {
    const full = expandV6(s);
    if (!full) return null;
    const g = full.split(":");
    const first = parseInt(g[0], 16);
    if (full === "0000:0000:0000:0000:0000:0000:0000:0001") return "loopback";
    if (full === "0000:0000:0000:0000:0000:0000:0000:0000") return "unspecified";
    if ((first & 0xffc0) === 0xfe80) return "link-local";
    if ((first & 0xfe00) === 0xfc00) return "unique-local";
    if ((first & 0xff00) === 0xff00) return "multicast";
    if ((first & 0xe000) === 0x2000) return "global-unicast";
    return "other";
  }
  const hexGroup = () => randInt(0, 0xffff).toString(16);
  function randomV6(type) {
    const g = () => hexGroup();
    const zeros = (n) => Array(n).fill("0");
    let groups;
    switch (type || pick(["global-unicast", "link-local", "unique-local", "multicast"])) {
      case "link-local":
        groups = ["fe80"].concat(zeros(3), [g(), g(), g(), g()]);
        break;
      case "unique-local":
        groups = ["fd" + randInt(0, 255).toString(16).padStart(2, "0")].concat([g(), g(), g()], zeros(randInt(1, 3)));
        while (groups.length < 8) groups.push(g());
        break;
      case "multicast":
        groups = ["ff0" + pick(["1", "2", "5", "e"])].concat(zeros(6), [pick(["1", "2", "fb", "9", "a"])]);
        break;
      default: {
        groups = ["2" + pick(["001", "600", "a02", "401", "620"]), g(), g(), g()];
        const z = randInt(1, 3);
        groups = groups.concat(zeros(z));
        while (groups.length < 8) groups.push(g());
      }
    }
    return groups.map((x) => x.padStart(4, "0")).join(":");
  }

  // ---------- MAC ----------
  const randomMac = () => Array.from({ length: 6 }, () => randInt(0, 255).toString(16).padStart(2, "0").toUpperCase()).join("-");

  global.IP = {
    randInt, pick, shuffle, sample,
    isValidV4, toInt, toStr, maskInt, maskStr, prefixFromMask, wildcardStr,
    network, broadcast, hostCount, usableHosts, firstHost, lastHost, sameSubnet,
    toBin, octetBin, ipClass, inRange, isPrivate, isApipa, isLoopback, isMulticast, isCgnat, kindOf,
    prefixForHosts, prefixForSubnets, randomHostV4, randomPrefix, parseCidr, normV4,
    expandV6, compressV6, isValidV6, v6Type, randomV6, randomMac,
  };
})(typeof window !== "undefined" ? window : globalThis);
