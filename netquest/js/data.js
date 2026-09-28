/* NetQuest — static knowledge used by the challenge generators and the reference tab. */
(function (global) {
  "use strict";

  const PORTS = [
    { port: "20/21", name: "FTP", proto: "TCP", desc: "File Transfer Protocol (21 control, 20 data)" },
    { port: "22", name: "SSH / SFTP", proto: "TCP", desc: "Secure Shell; secure remote CLI and file transfer" },
    { port: "23", name: "Telnet", proto: "TCP", desc: "Unencrypted remote CLI (legacy)" },
    { port: "25", name: "SMTP", proto: "TCP", desc: "Sending mail between servers" },
    { port: "53", name: "DNS", proto: "TCP/UDP", desc: "Name resolution (UDP queries, TCP zone transfers)" },
    { port: "67/68", name: "DHCP", proto: "UDP", desc: "Automatic IP addressing (67 server, 68 client)" },
    { port: "69", name: "TFTP", proto: "UDP", desc: "Trivial FTP; firmware/config transfers" },
    { port: "80", name: "HTTP", proto: "TCP", desc: "Unencrypted web" },
    { port: "110", name: "POP3", proto: "TCP", desc: "Downloading mail (older)" },
    { port: "123", name: "NTP", proto: "UDP", desc: "Network Time Protocol" },
    { port: "143", name: "IMAP", proto: "TCP", desc: "Synchronising mail with the server" },
    { port: "161/162", name: "SNMP", proto: "UDP", desc: "Device monitoring (161 agent, 162 traps)" },
    { port: "389", name: "LDAP", proto: "TCP/UDP", desc: "Directory services (Active Directory)" },
    { port: "443", name: "HTTPS", proto: "TCP", desc: "Web over TLS" },
    { port: "445", name: "SMB", proto: "TCP", desc: "Windows file and printer sharing" },
    { port: "514", name: "Syslog", proto: "UDP", desc: "Central logging" },
    { port: "587", name: "SMTP (TLS)", proto: "TCP", desc: "Mail submission from clients" },
    { port: "636", name: "LDAPS", proto: "TCP", desc: "LDAP over TLS" },
    { port: "993", name: "IMAPS", proto: "TCP", desc: "IMAP over TLS" },
    { port: "995", name: "POP3S", proto: "TCP", desc: "POP3 over TLS" },
    { port: "1433", name: "MS SQL", proto: "TCP", desc: "Microsoft SQL Server" },
    { port: "3306", name: "MySQL", proto: "TCP", desc: "MySQL / MariaDB" },
    { port: "3389", name: "RDP", proto: "TCP", desc: "Remote Desktop Protocol" },
    { port: "5060/5061", name: "SIP", proto: "TCP/UDP", desc: "VoIP call signalling (5061 = TLS)" },
  ];

  const OSI = [
    { n: 7, name: "Application", pdu: "Data", items: ["HTTP", "HTTPS", "DNS", "SMTP", "FTP", "SSH", "DHCP", "SNMP", "RDP", "Telnet", "IMAP"] },
    { n: 6, name: "Presentation", pdu: "Data", items: ["TLS/SSL encryption", "JPEG / PNG", "ASCII / Unicode", "MPEG", "Data compression"] },
    { n: 5, name: "Session", pdu: "Data", items: ["NetBIOS", "RPC", "Session setup and teardown", "PPTP", "SOCKS"] },
    { n: 4, name: "Transport", pdu: "Segment", items: ["TCP", "UDP", "Port numbers", "Three-way handshake", "Flow control / windowing", "Segments"] },
    { n: 3, name: "Network", pdu: "Packet", items: ["IP addresses", "Routers", "ICMP (ping)", "IPv4 / IPv6", "OSPF", "Packets", "IPsec"] },
    { n: 2, name: "Data Link", pdu: "Frame", items: ["MAC addresses", "Switches", "Ethernet", "Frames", "ARP", "VLANs (802.1Q)", "STP", "Wi-Fi (802.11 MAC)", "PPP"] },
    { n: 1, name: "Physical", pdu: "Bits", items: ["Cables", "Hubs", "Repeaters", "Bits", "Connectors (RJ45)", "Fiber optics", "Radio frequencies", "Voltages"] },
  ];

  const CABLES = [
    { name: "Cat 5e", speed: "1 Gbps", dist: "100 m", notes: "Twisted pair; minimum for gigabit" },
    { name: "Cat 6", speed: "10 Gbps (55 m) / 1 Gbps (100 m)", dist: "55 m at 10 Gbps", notes: "Thicker, sometimes has a spline" },
    { name: "Cat 6a", speed: "10 Gbps", dist: "100 m", notes: "Full 10 Gbps run length" },
    { name: "Cat 7", speed: "10 Gbps", dist: "100 m", notes: "Shielded; uses GG45/TERA connectors officially" },
    { name: "Cat 8", speed: "25 / 40 Gbps", dist: "30 m", notes: "Data-centre short runs" },
    { name: "RG-6 coax", speed: "Cable TV / cable internet", dist: "—", notes: "F-type connector, 75 ohm" },
    { name: "Single-mode fiber (SMF)", speed: "10–100+ Gbps", dist: "Tens of km", notes: "Laser, 8–10 µm core, yellow jacket" },
    { name: "Multimode fiber (MMF)", speed: "10 Gbps", dist: "~400 m (OM3/OM4)", notes: "LED/VCSEL, 50 or 62.5 µm core, orange/aqua jacket" },
  ];

  const CONNECTORS = [
    { name: "RJ45 (8P8C)", use: "Ethernet twisted pair" },
    { name: "RJ11 (6P2C/6P4C)", use: "Telephone / DSL line" },
    { name: "F-type", use: "Coax for cable TV / cable modem" },
    { name: "BNC", use: "Coax, older networks and CCTV" },
    { name: "LC", use: "Fiber; small, common on SFP modules" },
    { name: "SC", use: "Fiber; square push-pull" },
    { name: "ST", use: "Fiber; bayonet twist-lock" },
    { name: "MPO/MTP", use: "Multi-fiber ribbon, 40/100 GbE" },
    { name: "USB-C", use: "Universal; data, video, power delivery" },
    { name: "DB-9 (RS-232)", use: "Serial console to switches/routers" },
  ];

  const T568B = ["White/Orange", "Orange", "White/Green", "Blue", "White/Blue", "Green", "White/Brown", "Brown"];
  const T568A = ["White/Green", "Green", "White/Orange", "Blue", "White/Blue", "Orange", "White/Brown", "Brown"];
  const WIRE_COLORS = {
    "White/Orange": "#f5a25d", "Orange": "#f97316", "White/Green": "#86efac", "Green": "#16a34a",
    "Blue": "#2563eb", "White/Blue": "#93c5fd", "White/Brown": "#c4a484", "Brown": "#7c4a1d",
  };

  const WIFI = [
    { std: "802.11a", gen: "—", band: "5 GHz", speed: "54 Mbps" },
    { std: "802.11b", gen: "—", band: "2.4 GHz", speed: "11 Mbps" },
    { std: "802.11g", gen: "—", band: "2.4 GHz", speed: "54 Mbps" },
    { std: "802.11n", gen: "Wi-Fi 4", band: "2.4 / 5 GHz", speed: "600 Mbps (MIMO)" },
    { std: "802.11ac", gen: "Wi-Fi 5", band: "5 GHz", speed: "1.3–6.9 Gbps (MU-MIMO)" },
    { std: "802.11ax", gen: "Wi-Fi 6 / 6E", band: "2.4 / 5 GHz (+6 GHz for 6E)", speed: "9.6 Gbps (OFDMA)" },
    { std: "802.11be", gen: "Wi-Fi 7", band: "2.4 / 5 / 6 GHz", speed: "~46 Gbps" },
  ];
  const WIFI_SECURITY = [
    { name: "WEP", note: "Broken RC4; never use" },
    { name: "WPA", note: "TKIP; deprecated" },
    { name: "WPA2", note: "AES-CCMP; Personal (PSK) or Enterprise (802.1X/RADIUS)" },
    { name: "WPA3", note: "SAE handshake, forward secrecy, protects against offline dictionary attacks" },
  ];

  const DNS_RECORDS = [
    { type: "A", desc: "Hostname → IPv4 address" },
    { type: "AAAA", desc: "Hostname → IPv6 address" },
    { type: "CNAME", desc: "Alias of another hostname" },
    { type: "MX", desc: "Mail server for the domain" },
    { type: "NS", desc: "Authoritative name server for the zone" },
    { type: "PTR", desc: "Reverse lookup: IP → hostname" },
    { type: "SOA", desc: "Start of authority: zone serial and timers" },
    { type: "TXT", desc: "Free text: SPF, DKIM, domain verification" },
    { type: "SRV", desc: "Service locator (port + host), e.g. for AD / SIP" },
  ];

  const COMMANDS = [
    { cmd: "ipconfig", os: "Windows", desc: "Show IP, mask and gateway" },
    { cmd: "ipconfig /all", os: "Windows", desc: "Adds MAC, DHCP server, DNS servers, lease times" },
    { cmd: "ipconfig /release  &  /renew", os: "Windows", desc: "Drop and re-request a DHCP lease" },
    { cmd: "ipconfig /flushdns", os: "Windows", desc: "Clear the local DNS resolver cache" },
    { cmd: "ping <host>", os: "Both", desc: "ICMP reachability and round-trip time" },
    { cmd: "tracert / traceroute", os: "Win / Linux", desc: "Path taken to a destination, hop by hop" },
    { cmd: "pathping", os: "Windows", desc: "tracert + per-hop packet loss statistics" },
    { cmd: "nslookup / dig", os: "Win / Linux", desc: "Query DNS directly" },
    { cmd: "arp -a", os: "Both", desc: "Show the IP-to-MAC cache" },
    { cmd: "netstat -an", os: "Both", desc: "Open connections and listening ports" },
    { cmd: "route print / ip route", os: "Win / Linux", desc: "Routing table" },
    { cmd: "ip addr / ifconfig", os: "Linux", desc: "Interface addresses" },
    { cmd: "nmap", os: "Linux/Win", desc: "Port scanner / host discovery" },
    { cmd: "tcpdump / Wireshark", os: "Both", desc: "Packet capture" },
    { cmd: "hostname", os: "Both", desc: "Show the computer's name" },
    { cmd: "getmac", os: "Windows", desc: "Show MAC addresses" },
    { cmd: "net use", os: "Windows", desc: "Map / list network drives" },
    { cmd: "gpupdate /force", os: "Windows", desc: "Re-apply Group Policy" },
    { cmd: "sfc /scannow", os: "Windows", desc: "Repair protected system files" },
    { cmd: "chkdsk /f", os: "Windows", desc: "Check and repair the file system" },
  ];

  const TROUBLESHOOTING_STEPS = [
    "Identify the problem (gather information, question users, identify symptoms)",
    "Establish a theory of probable cause (question the obvious)",
    "Test the theory to determine the cause",
    "Establish a plan of action and identify potential effects",
    "Implement the solution or escalate as necessary",
    "Verify full system functionality and implement preventive measures",
    "Document findings, actions, outcomes and lessons learned",
  ];

  const SEQUENCES = [
    { id: "dora", title: "Put the DHCP lease process (DORA) in order", items: ["Discover — client broadcasts looking for a DHCP server", "Offer — server offers an address", "Request — client asks for the offered address", "Acknowledge — server confirms the lease"], explain: "DHCP uses UDP 67/68. The client has no IP yet, so Discover and Request are broadcasts." },
    { id: "tcp", title: "Order the TCP three-way handshake", items: ["SYN — client requests a connection", "SYN-ACK — server acknowledges and syncs", "ACK — client acknowledges; connection open"], explain: "TCP is connection-oriented. The handshake happens before any data. UDP has no handshake." },
    { id: "encap", title: "Order the encapsulation of data as it goes DOWN the stack (top first)", items: ["Data (Application/Presentation/Session)", "Segment (Transport — adds ports)", "Packet (Network — adds IP addresses)", "Frame (Data Link — adds MAC addresses)", "Bits (Physical — signals on the wire)"], explain: "Each layer wraps the layer above with its own header. Remember: Data, Segment, Packet, Frame, Bits." },
    { id: "trouble", title: "Order the CompTIA troubleshooting methodology", items: TROUBLESHOOTING_STEPS, explain: "Seven steps. A common exam trap: you establish a theory BEFORE testing it, and you verify functionality BEFORE documenting." },
    { id: "dns", title: "Order a DNS lookup for a name not yet cached anywhere", items: ["Check local cache and hosts file", "Ask the configured recursive resolver", "Resolver queries a root server", "Resolver queries the TLD server (.com)", "Resolver queries the authoritative name server", "Answer returned and cached"], explain: "The client only ever talks to the recursive resolver; the resolver walks root → TLD → authoritative on its behalf." },
    { id: "osi-up", title: "Order the OSI layers from Layer 1 to Layer 7", items: ["Physical", "Data Link", "Network", "Transport", "Session", "Presentation", "Application"], explain: "Mnemonic (bottom-up): Please Do Not Throw Sausage Pizza Away." },
    { id: "boot", title: "Order a PC boot sequence", items: ["Power on; PSU sends Power Good signal", "POST (Power-On Self-Test) checks hardware", "BIOS/UEFI reads boot order", "Bootloader loads from the boot device", "Operating system kernel loads", "User logs in"], explain: "Beep codes or an error during POST point at hardware (RAM, GPU, CPU) rather than the OS." },
    { id: "laser", title: "Order the laser printer imaging process", items: ["Processing — page rasterised", "Charging — drum given a uniform charge", "Exposing — laser writes the image", "Developing — toner sticks to exposed areas", "Transferring — toner moved onto paper", "Fusing — heat and pressure melt toner on", "Cleaning — drum wiped for the next page"], explain: "A+ favourite. Fuser problems show up as toner that smears off the page." },
    { id: "t568b", title: "Arrange the T568B wire order from pin 1 to pin 8", items: T568B, explain: "T568B: White/Orange, Orange, White/Green, Blue, White/Blue, Green, White/Brown, Brown. T568A swaps the orange and green pairs.", colors: true },
    { id: "t568a", title: "Arrange the T568A wire order from pin 1 to pin 8", items: T568A, explain: "T568A: White/Green, Green, White/Orange, Blue, White/Blue, Orange, White/Brown, Brown. A on one end + B on the other = crossover cable.", colors: true },
    { id: "arp", title: "Order what happens when a PC first sends to another PC on the same LAN", items: ["Compare destination IP with own subnet: it is local", "Check ARP cache for the destination's MAC", "Broadcast an ARP request: who has this IP?", "Destination replies with its MAC", "Build the frame with that MAC and send it"], explain: "If the destination were on a different subnet, the PC would ARP for the default gateway's MAC instead." },
  ];

  const RANKS = [
    { xp: 0, title: "Trainee" },
    { xp: 250, title: "Help Desk Tier 1" },
    { xp: 700, title: "Help Desk Tier 2" },
    { xp: 1400, title: "Field Technician" },
    { xp: 2400, title: "Junior Network Admin" },
    { xp: 4000, title: "Network Administrator" },
    { xp: 6500, title: "Network Engineer" },
    { xp: 10000, title: "Senior Network Engineer" },
  ];

  // Topic keys used by the generators; label + group for the practice picker.
  const TOPICS = {
    "ip-basics": { label: "IP basics", group: "Addressing" },
    "binary": { label: "Binary & hex", group: "Addressing" },
    "subnet": { label: "Subnetting", group: "Addressing" },
    "vlsm": { label: "Subnet design / VLSM", group: "Addressing" },
    "ipv6": { label: "IPv6", group: "Addressing" },
    "ipfix": { label: "Fix the workstation", group: "Hands-on" },
    "terminal": { label: "Terminal lab", group: "Hands-on" },
    "ports": { label: "Ports & protocols", group: "Protocols" },
    "osi": { label: "OSI model", group: "Protocols" },
    "sequences": { label: "Processes in order", group: "Protocols" },
    "services": { label: "DHCP, DNS, NAT & services", group: "Protocols" },
    "cabling": { label: "Cabling & connectors", group: "Infrastructure" },
    "wireless": { label: "Wireless", group: "Infrastructure" },
    "devices": { label: "Devices, switching & routing", group: "Infrastructure" },
    "security": { label: "Security", group: "Operations" },
    "troubleshoot": { label: "Troubleshooting & tools", group: "Operations" },
    "hardware": { label: "A+ hardware", group: "A+" },
    "windows": { label: "A+ Windows & OS", group: "A+" },
    "ops": { label: "Operational procedures", group: "A+" },
  };

  // Campaign: each shift is a list of ticket specs. {topic, n, diff}
  const SHIFTS = [
    { id: "s1", title: "Day One: What Is an IP Address?", blurb: "Your first shift on the help desk. Learn what the four numbers in an IP config mean, which addresses are private, and how binary works.", tickets: [["ip-basics", 4, 1], ["binary", 3, 1], ["ip-basics", 2, 2]], badge: "First Day Survivor" },
    { id: "s2", title: "Subnetting 101", blurb: "Masks, prefixes, network and broadcast addresses. The skill every network job interview checks.", tickets: [["binary", 2, 2], ["subnet", 6, 1], ["subnet", 2, 2]], badge: "Mask Wearer" },
    { id: "s3", title: "Ports & Protocols", blurb: "Firewall rules and 'is it TCP or UDP?' questions start landing in your queue.", tickets: [["ports", 6, 1], ["ports", 2, 2], ["services", 2, 1]], badge: "Port Authority" },
    { id: "s4", title: "The OSI Model", blurb: "Every troubleshooting conversation eventually says 'is this a layer 2 problem?'. Learn to answer.", tickets: [["osi", 5, 1], ["sequences", 2, 1], ["osi", 2, 2]], badge: "Seven Layers" },
    { id: "s5", title: "The Broken Workstation", blurb: "Users report 'no internet'. Read an ipconfig, spot the bad field, fix it, prove it with ping.", tickets: [["ipfix", 3, 1], ["troubleshoot", 2, 1], ["ipfix", 3, 2]], badge: "Config Fixer" },
    { id: "s6", title: "The Wiring Closet", blurb: "Cable categories, fiber types, connectors and how to crimp T568B without looking it up.", tickets: [["cabling", 5, 1], ["sequences", 1, 1], ["cabling", 2, 2]], badge: "Crimp Master" },
    { id: "s7", title: "Wireless Week", blurb: "Standards, bands, channels and why the coffee shop Wi-Fi is slow.", tickets: [["wireless", 6, 1], ["wireless", 2, 2], ["security", 1, 1]], badge: "Signal Finder" },
    { id: "s8", title: "Terminal Time", blurb: "Open a command prompt on a broken machine and find the fault using only ipconfig, ping, tracert and nslookup.", tickets: [["terminal", 3, 1], ["troubleshoot", 3, 1], ["terminal", 2, 2]], badge: "Command Line Hero" },
    { id: "s9", title: "Subnet Design", blurb: "The company is growing. Carve a /24 into departments and pick the right prefix for each host count.", tickets: [["subnet", 3, 2], ["vlsm", 5, 1], ["vlsm", 2, 2]], badge: "VLSM Architect" },
    { id: "s10", title: "IPv6 Arrives", blurb: "128 bits, colons, and no more broadcast. Compress, expand and classify addresses.", tickets: [["ipv6", 6, 1], ["ipv6", 2, 2], ["ip-basics", 1, 2]], badge: "Hex Whisperer" },
    { id: "s11", title: "Switches & Routers", blurb: "VLANs, trunks, spanning tree, routing protocols and what each box actually does.", tickets: [["devices", 6, 1], ["services", 2, 2], ["devices", 2, 2]], badge: "Packet Forwarder" },
    { id: "s12", title: "Hardware Bench (A+)", blurb: "The desktop team is short-staffed. RAM, storage, ports, printers and the boot process.", tickets: [["hardware", 6, 1], ["sequences", 2, 1], ["hardware", 2, 2]], badge: "Bench Tech" },
    { id: "s13", title: "Windows Toolbox (A+)", blurb: "Event Viewer, Device Manager, file systems, user accounts and the commands that fix things.", tickets: [["windows", 6, 1], ["troubleshoot", 2, 2], ["windows", 2, 2]], badge: "Toolbox Certified" },
    { id: "s14", title: "Security & Procedures", blurb: "Least privilege, MFA, malware, change management, ESD and safety. The stuff that keeps you employed.", tickets: [["security", 5, 1], ["ops", 4, 1], ["security", 2, 2]], badge: "Policy Keeper" },
    { id: "s15", title: "On-Call: Everything at Once", blurb: "Final shift. Mixed tickets from every topic at the hardest difficulty. Pass this and you're ready.", tickets: [["subnet", 2, 3], ["ipfix", 2, 3], ["terminal", 2, 2], ["ports", 1, 3], ["ipv6", 1, 3], ["vlsm", 1, 3], ["devices", 1, 3], ["security", 1, 3], ["hardware", 1, 3]], badge: "Certified Ready" },
  ];

  const SUBNET_TABLE = Array.from({ length: 9 }, (_, i) => {
    const p = 24 + i;
    const hosts = Math.pow(2, 32 - p);
    return { prefix: "/" + p, mask: "255.255.255." + (256 - hosts), block: hosts, usable: p === 31 ? 2 : p === 32 ? 1 : hosts - 2, subnets: Math.pow(2, i) };
  }).concat(Array.from({ length: 8 }, (_, i) => {
    const p = 16 + i;
    const hosts = Math.pow(2, 32 - p);
    return { prefix: "/" + p, mask: "255.255." + (256 - hosts / 256) + ".0", block: hosts / 256 + " (3rd octet)", usable: hosts - 2, subnets: Math.pow(2, i) + " (of a /16)" };
  }));

  global.DATA = {
    PORTS, OSI, CABLES, CONNECTORS, T568A, T568B, WIRE_COLORS, WIFI, WIFI_SECURITY, DNS_RECORDS, COMMANDS,
    TROUBLESHOOTING_STEPS, SEQUENCES, RANKS, TOPICS, SHIFTS, SUBNET_TABLE,
  };
})(typeof window !== "undefined" ? window : globalThis);
