/* NetQuest — Terminal Lab: a small simulated Windows network with one injected fault. */
(function (global) {
  "use strict";
  const { randInt, pick } = IP;

  const EXTERNAL = {
    "www.example.com": "93.184.216.34", "example.com": "93.184.216.34", "www.google.com": "142.250.72.36", "google.com": "142.250.72.36",
    "dns.google": "8.8.8.8", "one.one.one.one": "1.1.1.1", "www.comptia.org": "104.18.30.55", "microsoft.com": "20.70.246.20",
  };
  const PUBLIC_DNS = ["8.8.8.8", "8.8.4.4", "1.1.1.1", "9.9.9.9"];

  const FAULTS = {
    "link-down": { cause: "Physical link is down (cable, NIC or switch port)", fix: "Reseat or replace the patch cable and check the switch port link light", clue: "ipconfig reports 'Media disconnected' and every ping says 'transmit failed. General failure' — the NIC has no link at all, so nothing above layer 1 can work." },
    "dhcp-down": { cause: "DHCP server unreachable — the client fell back to an APIPA address", fix: "Check the DHCP server/scope (or the DHCP relay on the router), then run ipconfig /renew", clue: "The address 169.254.x.x with no gateway or DNS is APIPA. ipconfig /renew fails with 'unable to contact your DHCP server'." },
    "dns-down": { cause: "The internal DNS server is down or unreachable", fix: "Restore the DNS server (escalate to the server team); as a workaround point clients at the secondary DNS", clue: "Pinging by IP works (gateway, 8.8.8.8) but names fail; nslookup times out and pinging the DNS server's own IP fails. The configured DNS matches the documentation, so the server itself is the problem." },
    "wrong-dns": { cause: "The client is configured with an incorrect DNS server address", fix: "Correct the DNS server in the adapter settings to the documented server", clue: "ipconfig /all shows a DNS server that does not match the documentation. Pinging the documented DNS server works and nslookup against it succeeds, so the server is fine — the client setting is wrong." },
    "gateway-down": { cause: "The default gateway (router) is down or unreachable", fix: "Check the router and its LAN interface, plus the switch uplink; escalate to the network team", clue: "Local hosts (file server, printer, DNS) reply, but the gateway does not, and tracert shows * * * at hop 1. Internal names resolve; only off-subnet traffic fails." },
    "wan-down": { cause: "The ISP / WAN link is down beyond the gateway", fix: "Check the router's WAN status and contact the ISP", clue: "The gateway replies and tracert gets past hop 1 but dies at the next hop. Internal servers and names work; external addresses like 8.8.8.8 time out." },
    "wrong-mask": { cause: "The client has an incorrect subnet mask", fix: "Set the subnet mask to match the documented network", clue: "ipconfig shows a mask that differs from the documentation. With the wrong mask the PC believes the gateway is on another network, so any off-subnet traffic fails with 'General failure' while nearby hosts still reply." },
    "stale-dns": { cause: "A stale DNS cache entry on the client after a server IP change", fix: "Run ipconfig /flushdns (and clear the browser cache if needed)", clue: "ping resolves the server name to an old address that does not answer, while nslookup (which bypasses the cache) returns the new address. ipconfig /displaydns shows the stale record." },
    "wrong-gateway": { cause: "The client is configured with the wrong default gateway", fix: "Correct the default gateway to the documented router address", clue: "ipconfig shows a gateway that does not match the documentation. Pinging the documented router works, but the configured gateway does not exist, so every off-subnet ping reports 'Destination host unreachable'." },
  };
  const FAULT_IDS = Object.keys(FAULTS);

  function lanFor(fault, diff) {
    const p = fault === "wrong-mask" ? pick([23, 22]) : diff >= 2 ? pick([24, 24, 23, 25]) : 24;
    return Challenges.makeLan(p);
  }

  function generate(diff) {
    const easy = ["link-down", "dhcp-down", "dns-down", "gateway-down", "wrong-dns"];
    const fault = diff === 1 ? pick(easy) : pick(FAULT_IDS);
    const lan = lanFor(fault, diff);
    const hostname = pick(["WS-", "LT-", "PC-"]) + randInt(100, 999);
    const st = {
      fault, host: hostname, mac: IP.randomMac(), link: true, dhcp: true, suffix: "corp.local",
      ip: IP.toStr((lan.scopeStart + randInt(0, 30)) >>> 0), mask: lan.mask, gw: IP.toStr(lan.gw), dns: [IP.toStr(lan.dns)],
      lan, routerUp: true, wanUp: true, dnsUp: true, dhcpUp: true, dnsCache: {}, arp: {}, cmds: 0,
      names: { "dc01": IP.toStr(lan.dns), "files01": IP.toStr(lan.fileserver), "prn-2f": IP.toStr(lan.printer), "rtr-core": IP.toStr(lan.gw) },
    };
    let complaint;
    switch (fault) {
      case "link-down": st.link = false; st.ip = ""; complaint = "My computer says 'No internet' and the little network icon has a red X. I didn't change anything."; break;
      case "dhcp-down": st.dhcpUp = false; st.ip = `169.254.${randInt(1, 254)}.${randInt(1, 254)}`; st.mask = "255.255.0.0"; st.gw = ""; st.dns = []; complaint = "It worked yesterday. Today the icon shows a yellow triangle and nothing loads."; break;
      case "dns-down": st.dnsUp = false; complaint = "Every website says 'server not found', and the intranet does too. Teams shows me offline."; break;
      case "wrong-dns": st.dhcp = false; st.ip = IP.toStr(lan.freeStatic()); st.dns = [pick([IP.toStr((lan.dns ^ 1) >>> 0), IP.toStr((lan.scopeEnd - 1) >>> 0)])]; complaint = "I got a new static address for the label printer software and now nothing resolves by name."; break;
      case "gateway-down": st.routerUp = false; complaint = "Internet is down for me. My colleague says the file server still works though."; break;
      case "wan-down": st.wanUp = false; complaint = "No websites load, but email between us and the file server work fine."; break;
      case "wrong-mask": { st.dhcp = false; const upper = (lan.base + 256 + randInt(10, 60)) >>> 0; st.ip = IP.toStr(upper); st.mask = "255.255.255.0"; complaint = "I set a static IP like the wiki said. Some things work but I can't get out to the internet."; break; }
      case "stale-dns": { /* old = the server's previous address, now unused */ const old = IP.toStr(lan.staticRange[1]); st.dnsCache["files01.corp.local"] = old; complaint = "I can't open the shared drive on FILES01 since the server team did maintenance last night. Everyone else is fine."; break; }
      case "wrong-gateway": st.dhcp = false; st.ip = IP.toStr(lan.staticRange[0]); st.gw = IP.toStr(lan.staticRange[1]); /* an unused address inside the subnet */ complaint = "The static IP was set up by the last tech. Shared drives are fine but the internet doesn't work."; break;
    }
    if (st.ip && st.ip !== "" && !st.ip.startsWith("169.254")) {
      // pre-populate ARP with things the PC has talked to recently when they are reachable
      for (const target of [st.gw, IP.toStr(lan.dns)]) if (target && reach(st, target).ok) st.arp[target] = fakeMac(target);
    }
    const causes = IP.shuffle(FAULT_IDS.map((id) => FAULTS[id].cause));
    const fixes = IP.shuffle(FAULT_IDS.map((id) => FAULTS[id].fix));
    const f = FAULTS[fault];
    return {
      topic: "terminal", diff, kind: "terminal", title: "Terminal lab",
      prompt: `<p><b>Ticket from ${pick(["Dana", "Marcus", "Priya", "Jordan", "Sam", "Alex"])}:</b> “${complaint}”</p><p>You have a remote shell on their PC. Investigate with the terminal, then submit your diagnosis.</p>`,
      hint: "Work outward: ipconfig /all → ping 127.0.0.1 → ping your gateway → ping 8.8.8.8 → ping a name. Compare everything to the documentation panel.",
      scenario: { state: st, causes, fixes, answerCause: f.cause, answerFix: f.fix, explain: `<p><b>Root cause:</b> ${f.cause}.</p><p>${f.clue}</p><p><b>Fix:</b> ${f.fix}.</p>` },
    };
  }

  function fakeMac(ip) {
    const n = IP.toInt(ip);
    return ["00-1C-42", "3C-52-82", "B8-27-EB", "F4-8E-38"][n % 4] + "-" + [(n >>> 16) & 255, (n >>> 8) & 255, n & 255].map((x) => x.toString(16).toUpperCase().padStart(2, "0")).join("-");
  }

  // ---------- reachability model ----------
  // returns {ok:boolean, why:'nolink'|'general'|'unreach'|'timeout', local:boolean}
  function reach(st, ipS) {
    if (!st.link) return { ok: false, why: "nolink" };
    if (!IP.isValidV4(ipS)) return { ok: false, why: "general" };
    const ip = IP.toInt(ipS);
    if (IP.isLoopback(ip) || ipS === st.ip) return { ok: true, local: true };
    if (!st.ip) return { ok: false, why: "general" };
    const me = IP.toInt(st.ip);
    const pcP = IP.prefixFromMask(st.mask);
    const lan = st.lan;
    const onLan = IP.network(ip, lan.p) === lan.base;
    const hostUp = (x) => {
      if (x === lan.gw) return st.routerUp;
      if (x === lan.dns) return st.dnsUp;
      if (x === lan.fileserver || x === lan.printer) return true;
      if (x >= lan.scopeStart && x <= lan.scopeEnd && x !== me && (x - lan.scopeStart) % 3 === 0) return true; // a few DHCP neighbours
      return false;
    };
    const thinksLocal = pcP >= 0 && IP.network(ip, pcP) === IP.network(me, pcP);
    if (thinksLocal) {
      if (onLan && IP.network(me, lan.p) === lan.base && hostUp(ip)) return { ok: true, local: true };
      return { ok: false, why: "unreach", local: true };
    }
    // needs the gateway
    if (!st.gw || pcP < 0 || IP.network(IP.toInt(st.gw), pcP) !== IP.network(me, pcP)) return { ok: false, why: "general" };
    if (IP.toInt(st.gw) !== lan.gw || !st.routerUp) return { ok: false, why: "unreach" };
    if (IP.network(me, lan.p) !== lan.base) return { ok: false, why: "timeout" };
    if (onLan) return hostUp(ip) ? { ok: true, local: false } : { ok: false, why: "timeout" };
    if (IP.isPrivate(ip) || IP.isApipa(ip)) return { ok: false, why: "timeout" };
    return st.wanUp ? { ok: true, local: false } : { ok: false, why: "timeout" };
  }

  // ---------- name resolution ----------
  function resolve(st, name, serverIp, useCache = true) {
    name = name.toLowerCase();
    if (IP.isValidV4(name)) return { ok: true, ip: name, literal: true };
    const fq = name.includes(".") ? name : name + "." + st.suffix;
    if (useCache && st.dnsCache[fq]) return { ok: true, ip: st.dnsCache[fq], cached: true };
    const server = serverIp || st.dns[0];
    if (!server) return { ok: false, why: "noserver" };
    const r = reach(st, server);
    if (!r.ok) return { ok: false, why: "timeout", server };
    const isInternal = IP.toInt(server) === st.lan.dns;
    const short = fq.endsWith("." + st.suffix) ? fq.slice(0, -(st.suffix.length + 1)) : null;
    if (isInternal) {
      if (!st.dnsUp) return { ok: false, why: "timeout", server };
      if (short && st.names[short]) return { ok: true, ip: st.names[short], server };
      if (EXTERNAL[fq]) return st.wanUp ? { ok: true, ip: EXTERNAL[fq], server } : { ok: false, why: "timeout", server };
      return { ok: false, why: "nx", server };
    }
    if (PUBLIC_DNS.includes(server)) {
      if (EXTERNAL[fq]) return { ok: true, ip: EXTERNAL[fq], server };
      return { ok: false, why: "nx", server };
    }
    return { ok: false, why: "timeout", server };
  }

  // ---------- command execution ----------
  function exec(st, line) {
    st.cmds++;
    const parts = line.trim().split(/\s+/);
    const cmd = (parts[0] || "").toLowerCase();
    const args = parts.slice(1);
    switch (cmd) {
      case "": return "";
      case "help": case "?": return HELP;
      case "cls": case "clear": return "\u0000CLS";
      case "hostname": return st.host;
      case "getmac": return `Physical Address    Transport Name\n=================== ==========================================================\n${st.mac}   ${st.link ? "\\Device\\Tcpip_{5B1E...}" : "Media disconnected"}`;
      case "ipconfig": return ipconfig(st, args);
      case "ping": return ping(st, args);
      case "tracert": case "traceroute": return tracert(st, args);
      case "nslookup": case "dig": return nslookup(st, args);
      case "arp": return arp(st, args);
      case "netstat": return netstat(st);
      case "route": return route(st, args);
      case "pathping": return "pathping is not modelled in this lab. Use tracert.";
      case "ifconfig": case "ip": return `'${cmd}' is not recognized here — this is a Windows box. Try ipconfig.`;
      default: return `'${cmd}' is not recognized as an internal or external command,\noperable program or batch file.\nType help for the commands available in this lab.`;
    }
  }

  const HELP = `Commands available in this lab:
  ipconfig [/all | /release | /renew | /flushdns | /displaydns]
  ping <host or ip>          tracert <host or ip>
  nslookup <host> [server]   arp -a
  netstat -an                route print
  hostname                   getmac
  cls                        help`;

  function ipconfig(st, args) {
    const a = (args[0] || "").toLowerCase();
    if (a === "/flushdns") { st.dnsCache = {}; return "Windows IP Configuration\n\nSuccessfully flushed the DNS Resolver Cache."; }
    if (a === "/displaydns") {
      const e = Object.entries(st.dnsCache);
      if (!e.length) return "Windows IP Configuration\n\n    Could not display the DNS Resolver Cache (it is empty)."; 
      return "Windows IP Configuration\n\n" + e.map(([n, ip]) => `    ${n}\n    ----------------------------------------\n    Record Name . . . . . : ${n}\n    Record Type . . . . . : 1\n    Time To Live  . . . . : ${randInt(200, 3000)}\n    A (Host) Record . . . : ${ip}\n`).join("\n");
    }
    if (a === "/release") {
      if (!st.dhcp) return "The operation failed as no adapter is in the state permissible for\nthis operation (the adapter uses a static address).";
      st.ip = ""; st.gw = ""; st.dns = [];
      return "Windows IP Configuration\n\nEthernet adapter Ethernet0:\n\n   Connection-specific DNS Suffix  . :\n   IPv4 Address. . . . . . . . . . . : 0.0.0.0\n   Subnet Mask . . . . . . . . . . . : 0.0.0.0\n   Default Gateway . . . . . . . . . :";
    }
    if (a === "/renew") {
      if (!st.dhcp) return "The operation failed as no adapter is in the state permissible for\nthis operation (the adapter uses a static address).";
      if (!st.link) return "An error occurred while renewing interface Ethernet0 : The system cannot find the file specified.\n(Media disconnected)";
      if (!st.dhcpUp) { if (!st.ip) { st.ip = `169.254.${randInt(1, 254)}.${randInt(1, 254)}`; st.mask = "255.255.0.0"; } return "An error occurred while renewing interface Ethernet0 : unable to contact your DHCP server. Request has timed out."; }
      st.ip = IP.toStr((st.lan.scopeStart + randInt(0, 30)) >>> 0); st.mask = st.lan.mask; st.gw = IP.toStr(st.lan.gw); st.dns = [IP.toStr(st.lan.dns)];
      return "Windows IP Configuration\n\n" + adapterBlock(st, false);
    }
    if (a && a !== "/all") return `Error: unrecognized or incomplete command line.\n\n${HELP}`;
    return "Windows IP Configuration\n\n" + (a === "/all" ? `   Host Name . . . . . . . . . . . . : ${st.host}\n   Primary Dns Suffix  . . . . . . . : ${st.suffix}\n   Node Type . . . . . . . . . . . . : Hybrid\n   IP Routing Enabled. . . . . . . . : No\n\n` : "") + adapterBlock(st, a === "/all");
  }
  function adapterBlock(st, all) {
    const L = ["Ethernet adapter Ethernet0:", ""];
    if (!st.link) { L.push("   Media State . . . . . . . . . . . : Media disconnected", `   Connection-specific DNS Suffix  . : `); if (all) L.push(`   Description . . . . . . . . . . . : Intel(R) Ethernet Connection I219-LM`, `   Physical Address. . . . . . . . . : ${st.mac}`, `   DHCP Enabled. . . . . . . . . . . : ${st.dhcp ? "Yes" : "No"}`); return L.join("\n"); }
    const apipa = st.ip.startsWith("169.254");
    L.push(`   Connection-specific DNS Suffix  . : ${apipa || !st.ip ? "" : st.suffix}`);
    if (all) L.push(`   Description . . . . . . . . . . . : Intel(R) Ethernet Connection I219-LM`, `   Physical Address. . . . . . . . . : ${st.mac}`, `   DHCP Enabled. . . . . . . . . . . : ${st.dhcp ? "Yes" : "No"}`, `   Autoconfiguration Enabled . . . . : Yes`);
    if (apipa) L.push(`   Autoconfiguration IPv4 Address. . : ${st.ip}(Preferred)`);
    else L.push(`   IPv4 Address. . . . . . . . . . . : ${st.ip || "0.0.0.0"}${st.dhcp && st.ip ? "(Preferred)" : ""}`);
    L.push(`   Subnet Mask . . . . . . . . . . . : ${st.mask || "0.0.0.0"}`);
    if (all && st.dhcp && st.ip && !apipa) L.push(`   Lease Obtained. . . . . . . . . . : Monday 08:41:12`, `   Lease Expires . . . . . . . . . . : Tuesday 08:41:12`);
    L.push(`   Default Gateway . . . . . . . . . : ${st.gw}`);
    if (all) {
      if (st.dhcp && st.ip && !apipa) L.push(`   DHCP Server . . . . . . . . . . . : ${IP.toStr(st.lan.dns)}`);
      L.push(`   DNS Servers . . . . . . . . . . . : ${st.dns[0] || ""}`);
      L.push(`   NetBIOS over Tcpip. . . . . . . . : Enabled`);
    }
    return L.join("\n");
  }

  function why(st, r, target) {
    switch (r.why) {
      case "nolink": return "PING: transmit failed. General failure.";
      case "general": return "PING: transmit failed. General failure.";
      case "unreach": return `Reply from ${st.ip}: Destination host unreachable.`;
      default: return "Request timed out.";
    }
  }
  function ping(st, args) {
    const target = args.find((a) => !a.startsWith("-"));
    if (!target) return "Usage: ping <host or ip>";
    const res = resolve(st, target);
    if (!res.ok) return `Ping request could not find host ${target}. Please check the name and try again.`;
    const ip = res.ip;
    const r = reach(st, ip);
    const head = `\nPinging ${res.literal ? ip : target + (target.includes(".") ? "" : "." + st.suffix) + " [" + ip + "]"} with 32 bytes of data:`;
    const lines = [];
    if (r.ok) {
      if (r.local && ip !== st.ip && !IP.isLoopback(IP.toInt(ip))) st.arp[ip] = fakeMac(ip);
      const base = IP.isLoopback(IP.toInt(ip)) || ip === st.ip ? 0 : r.local ? 1 : IP.isPrivate(IP.toInt(ip)) ? 2 : randInt(9, 30);
      for (let i = 0; i < 4; i++) lines.push(`Reply from ${ip}: bytes=32 time${base === 0 ? "<1ms" : "=" + (base + randInt(0, 3)) + "ms"} TTL=${r.local ? 128 : 55}`);
      return `${head}\n${lines.join("\n")}\n\nPing statistics for ${ip}:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),`;
    }
    const w = why(st, r);
    if (w.startsWith("PING:")) return `${head}\n${w}\n${w}\n${w}\n${w}\n\nPing statistics for ${ip}:\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss),`;
    for (let i = 0; i < 4; i++) lines.push(w);
    const recv = r.why === "unreach" ? 4 : 0;
    return `${head}\n${lines.join("\n")}\n\nPing statistics for ${ip}:\n    Packets: Sent = 4, Received = ${recv}, Lost = ${4 - recv} (${recv ? 0 : 100}% loss),`;
  }

  function tracert(st, args) {
    const target = args.find((a) => !a.startsWith("-"));
    if (!target) return "Usage: tracert <host or ip>";
    const res = resolve(st, target);
    if (!res.ok) return `Unable to resolve target system name ${target}.`;
    const ip = res.ip;
    const label = res.literal ? ip : `${target}${target.includes(".") ? "" : "." + st.suffix} [${ip}]`;
    const head = `\nTracing route to ${label}\nover a maximum of 30 hops:\n`;
    const r = reach(st, ip);
    const row = (n, t, h) => `  ${String(n).padStart(2)}    ${t}    ${h}`;
    const star = (n) => row(n, " *        *        *  ", "Request timed out.");
    if (r.ok && r.local) return `${head}\n${row(1, "<1 ms    <1 ms    <1 ms", ip)}\n\nTrace complete.`;
    if (!r.ok && (r.why === "general" || r.why === "nolink")) return `${head}\nUnable to contact IP driver. General failure.`;
    if (!r.ok && r.why === "unreach") return `${head}\n${row(1, " *        *        *  ", st.gw ? `Destination host unreachable (no reply from ${st.gw}).` : "Destination host unreachable.")}\n\nTrace complete.`;
    const hops = [row(1, " 1 ms     1 ms     1 ms", `${st.gw}`)];
    const onLan = IP.network(IP.toInt(ip), st.lan.p) === st.lan.base;
    if (r.ok && onLan) return `${head}\n${hops[0]}\n${row(2, " 1 ms     1 ms     1 ms", ip)}\n\nTrace complete.`;
    if (!st.wanUp || !r.ok) { for (let i = 2; i <= 5; i++) hops.push(star(i)); return `${head}\n${hops.join("\n")}\n  ... (continues to time out through hop 30)`; }
    hops.push(row(2, " 6 ms     7 ms     6 ms", "100.64.0.1"), row(3, "11 ms    10 ms    12 ms", "203.0.113.1"), row(4, "14 ms    15 ms    14 ms", "198.51.100.9"), row(5, `${randInt(15, 25)} ms    ${randInt(15, 25)} ms    ${randInt(15, 25)} ms`, ip));
    return `${head}\n${hops.join("\n")}\n\nTrace complete.`;
  }

  function nslookup(st, args) {
    const target = args[0], serverArg = args[1];
    if (!target) return "Usage: nslookup <host> [dns-server]";
    const server = serverArg || st.dns[0];
    if (!server) return "Default Server:  UnKnown\nAddress:  ::1\n\n*** UnKnown can't find " + target + ": No response from server";
    const sname = IP.toInt(server) === st.lan.dns ? "dc01." + st.suffix : PUBLIC_DNS.includes(server) ? (server === "8.8.8.8" ? "dns.google" : "one.one.one.one") : "UnKnown";
    const res = resolve(st, target, server, false);
    const fq = IP.isValidV4(target) ? target : target.includes(".") ? target : target + "." + st.suffix;
    const head = `Server:  ${sname}\nAddress:  ${server}\n`;
    if (res.ok) { if (!res.literal) st.dnsCache[fq.toLowerCase()] = res.ip; return `${head}\nName:    ${fq}\nAddress:  ${res.ip}`; }
    if (res.why === "nx") return `${head}\n*** ${sname} can't find ${fq}: Non-existent domain`;
    return `DNS request timed out.\n    timeout was 2 seconds.\nServer:  UnKnown\nAddress:  ${server}\n\nDNS request timed out.\n    timeout was 2 seconds.\n*** Request to UnKnown timed-out`;
  }

  function arp(st, args) {
    if (!args.includes("-a")) return "Usage: arp -a";
    if (!st.link || !st.ip) return "No ARP Entries Found.";
    const rows = Object.entries(st.arp).map(([ip, mac]) => `  ${ip.padEnd(22)}${mac.padEnd(22)}dynamic`);
    rows.push(`  ${IP.toStr(IP.broadcast(IP.toInt(st.ip), Math.max(0, IP.prefixFromMask(st.mask)))).padEnd(22)}${"FF-FF-FF-FF-FF-FF".padEnd(22)}static`, `  ${"224.0.0.22".padEnd(22)}${"01-00-5E-00-00-16".padEnd(22)}static`);
    return `\nInterface: ${st.ip} --- 0x6\n  Internet Address      Physical Address      Type\n${rows.join("\n")}`;
  }
  function netstat(st) {
    const L = ["\nActive Connections\n", "  Proto  Local Address          Foreign Address        State"];
    const me = st.ip || "0.0.0.0";
    L.push(`  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING`, `  TCP    0.0.0.0:445            0.0.0.0:0              LISTENING`, `  TCP    0.0.0.0:3389           0.0.0.0:0              LISTENING`);
    if (st.ip && reach(st, IP.toStr(st.lan.fileserver)).ok && !st.dnsCache["files01." + st.suffix]) L.push(`  TCP    ${me}:${randInt(49000, 65000)}     ${IP.toStr(st.lan.fileserver)}:445     ESTABLISHED`);
    if (st.ip && reach(st, "142.250.72.36").ok) L.push(`  TCP    ${me}:${randInt(49000, 65000)}     142.250.72.36:443      ESTABLISHED`);
    L.push(`  UDP    0.0.0.0:68             *:*`, `  UDP    0.0.0.0:5353           *:*`);
    return L.join("\n");
  }
  function route(st, args) {
    if ((args[0] || "").toLowerCase() !== "print") return "Usage: route print";
    if (!st.ip) return "\nIPv4 Route Table\n===========================================================================\nActive Routes:\n  None";
    const p = IP.prefixFromMask(st.mask);
    const net = IP.toStr(IP.network(IP.toInt(st.ip), Math.max(0, p)));
    const L = ["\nIPv4 Route Table", "===========================================================================", "Active Routes:", "Network Destination        Netmask          Gateway       Interface  Metric"];
    if (st.gw) L.push(`          0.0.0.0          0.0.0.0    ${st.gw.padEnd(15)} ${st.ip}     25`);
    L.push(`        127.0.0.0        255.0.0.0         On-link         127.0.0.1    331`, `        ${net.padEnd(15)}  ${st.mask.padEnd(15)}         On-link     ${st.ip}    281`, `  255.255.255.255  255.255.255.255         On-link     ${st.ip}    281`);
    return L.join("\n");
  }

  global.NetSim = { generate, exec, reach, resolve, FAULTS };
})(typeof window !== "undefined" ? window : globalThis);
