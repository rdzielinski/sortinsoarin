// GENERATED from the published Soarin' plan artifact (soarin-template.html) so the in-game map
// draws exactly the same building. Footprints: OpenStreetMap. Interior: blueprint sheet E-44.
// Do not hand-edit; regenerate from the artifact source.
export const PLAN_CSS = ".plan-map {\n  --paper: #0e161c; --sheet: #131e26; --ink: #e2eaf0; --muted: #91a3b1; --rule: #22313c; --shell: #1a2832;\n  --wall: #b4c9d8; --room: #1d2c37; --room-alt: #243845; --sign: #f2b51d; --sign-ink: #121a21;\n  --standby: #5fa3e8; --ll: #c48ae9; --exit: #4ccb8f; --dome: #1d3a52; --dome-line: #7ab4de; --seat: #5b7385; --inferred: #f08a4b;\n  \n--display: \"Barlow Condensed\", \"Arial Narrow\", sans-serif; --mono: \"JetBrains Mono\", ui-monospace, Menlo, monospace; --paper: #0e161c; }\n.plan-map .flow.show { opacity: .4; }\n/* SVG \u2014 drawn like an architect's plan: solid wall poch\u00e9, door gaps with swings, hatched backstage */\n.plan-map .shell { fill: var(--shell); fill-opacity: .55; stroke: var(--wall); stroke-width: 3.2; stroke-linejoin: miter; fill-rule: evenodd; }\n.plan-map .landshell { fill: var(--shell); fill-opacity: .45; stroke: var(--wall); stroke-width: 2.4; fill-rule: evenodd; }\n.plan-map .room { fill: var(--room); stroke: var(--wall); stroke-width: 1.6; stroke-linejoin: miter; }\n.plan-map .room.alt { fill: var(--room-alt); }\n.plan-map .room.inf { stroke-dasharray: 4 2; }\n.plan-map .room.open { fill: url(#pm-hatch-out); stroke: none; }\n.plan-map .back { fill: url(#pm-hatch); stroke: none; }\n.plan-map .ramp { fill: url(#pm-hatch-ramp); stroke: var(--wall); stroke-width: .5; }\n.plan-map .room.upper { stroke: var(--exit); stroke-dasharray: 3 2; fill-opacity: .7; }\n.plan-map .gap { fill: var(--room); stroke: none; }\n.plan-map .gap.alt { fill: var(--room-alt); }\n.plan-map .swing { fill: none; stroke: var(--wall); stroke-width: .5; }\n.plan-map .leaf { stroke: var(--wall); stroke-width: .8; }\n.plan-map .rail { stroke: var(--wall); stroke-width: .6; fill: none; opacity: .75; }\n.plan-map .spot { fill: var(--muted); }\n.plan-map .dome { fill: var(--dome); stroke: var(--dome-line); stroke-width: 1.4; }\n.plan-map .domeinner { fill: none; stroke: var(--dome-line); stroke-width: .6; stroke-dasharray: 2 2.5; }\n.plan-map .over { fill: none; stroke: var(--ink); stroke-width: .6; stroke-dasharray: 3 2; opacity: .7; }\n.plan-map .seat { fill: var(--seat); }\n.plan-map .seat.raised { fill: none; stroke: var(--seat); stroke-width: .7; stroke-dasharray: 1.5 1.2; }\n.plan-map .canopy { fill: none; stroke: var(--seat); stroke-width: .6; }\n.plan-map .gate { fill: var(--sign); stroke: var(--wall); stroke-width: .5; }\n.plan-map .gtext { font: 700 5px var(--display); fill: var(--sign-ink); pointer-events: none; letter-spacing: .03em; }\n.plan-map .lbl { font: 700 10px var(--display); letter-spacing: .06em; text-transform: uppercase; fill: var(--ink); pointer-events: none; paint-order: stroke; stroke: var(--shell); stroke-width: 2.5px; stroke-linejoin: round; }\n.plan-map .lbl.sm { font-size: 8px; }\n.plan-map .lbl.xs { font-size: 6.5px; letter-spacing: .04em; }\n.plan-map .sub { font: 400 5px var(--mono); fill: var(--muted); pointer-events: none; paint-order: stroke; stroke: var(--shell); stroke-width: 1.6px; }\n.plan-map .door { fill: var(--exit); }\n.plan-map .zone { cursor: pointer; }\n.plan-map .zone:hover .room, .plan-map .zone.on .room, .plan-map .zone:hover .dome, .plan-map .zone.on .dome { stroke: var(--sign); }\n.plan-map .zone.on .room { fill: color-mix(in srgb, var(--sign) 26%, var(--room)); }\n.plan-map .zone.on .gap { fill: color-mix(in srgb, var(--sign) 26%, var(--room)); }\n.plan-map .flow { fill: none; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 5 5; opacity: 0; transition: opacity .2s; pointer-events: none; }\n.plan-map .flow.show { opacity: .95; animation: march 1s linear infinite; }\n.plan-map .flow.standby { stroke: var(--standby); } .flow.ll { stroke: var(--ll); } .flow.exit { stroke: var(--exit); }\n@keyframes march { to { stroke-dashoffset: -10; } }\n@media (prefers-reduced-motion: reduce) { .plan-map .flow.show { animation: none; } }\n.plan-map .merge { fill: var(--sign); stroke: var(--wall); stroke-width: .8; }\n.plan-map .compass, .plan-map .scale text { font: 600 8px var(--mono); fill: var(--ink); }\n.plan-map .scale rect { fill: var(--ink); }\n.plan-map #pm-aerial { transition: opacity .2s; }\n.plan-map .cross { fill: none; stroke: var(--inferred); stroke-width: 1.2; }\n.plan-map .hatchline { stroke: var(--wall); stroke-width: .5; opacity: .45; }\n";

export const PLAN_SVG = "\n        <defs>\n          <pattern id=\"pm-hatch\" width=\"4\" height=\"4\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(45)\"><line class=\"hatchline\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"4\"/></pattern>\n          <pattern id=\"pm-hatch-ramp\" width=\"2.5\" height=\"2.5\" patternUnits=\"userSpaceOnUse\"><line class=\"hatchline\" x1=\"0\" y1=\"0\" x2=\"2.5\" y2=\"0\" style=\"opacity:.9\"/></pattern>\n          <pattern id=\"pm-hatch-out\" width=\"7\" height=\"7\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(-45)\"><line class=\"hatchline\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"7\"/></pattern>\n        </defs>\n        \n        <image id=\"pm-aerial\" href=\"/plan-aerial.jpg\" x=\"300\" y=\"220\" width=\"700\" height=\"1000\" opacity=\".55\" preserveAspectRatio=\"none\"/>\n        <path class=\"landshell\" d=\"M678.2 659.9 L679.3 678.6 L409.3 679.1 L409.3 664.9 L425.2 664.9 L423.6 540.9 L408.2 541.4 L407.7 525.8 L420.5 521.1 L432.4 513.4 L445.3 500.8 L456.0 484.9 L460.9 469.0 L498.8 467.9 L498.8 487.1 L487.2 487.1 L487.2 603.4 L541.0 656.1 L577.3 657.1 L638.0 658.8 L678.2 659.9 Z M960.2 526.3 L959.9 539.3 L916.4 642.0 L886.0 630.4 L868.4 648.2 L880.5 660.2 L824.0 715.8 L816.8 710.4 L814.6 708.2 L784.0 678.6 L762.7 700.7 L778.3 717.2 L770.2 772.6 L745.6 790.9 L348.7 792.5 L349.1 679.7 L384.4 679.3 L384.4 664.6 L365.1 664.2 L366.3 542.3 L384.5 542.3 L384.0 526.3 L371.9 523.4 L360.8 519.5 L340.6 507.3 L327.0 489.1 L317.7 468.9 L316.9 447.8 L324.1 424.9 L339.7 403.0 L360.4 389.5 L378.6 384.8 L400.9 384.0 L420.8 390.3 L439.8 404.2 L452.0 419.9 L457.9 434.7 L460.9 444.0 L498.9 443.5 L500.6 382.7 L436.4 381.5 L436.4 358.2 L368.0 357.8 L367.6 222.3 L552.5 221.0 L552.5 336.3 L657.6 335.9 L656.8 246.8 L772.1 246.3 L798.6 246.2 L867.1 245.9 L877.8 245.9 L877.8 333.7 L914.9 333.7 L958.4 438.4 L959.2 450.2 L936.0 457.0 L927.8 459.5 L923.7 460.7 L924.0 470.3 L925.0 503.7 L925.3 512.9 L935.4 516.8 L960.2 526.3 Z\"/>\n        <path class=\"shell\" d=\"M695.3 1064.3 L672.1 1199.2 L656.2 1196.6 L654.1 1209.0 L633.2 1205.3 L631.6 1217.0 L606.0 1213.0 L601.9 1212.6 L597.9 1211.5 L561.7 1205.1 L563.7 1192.0 L565.2 1182.6 L542.6 1178.6 L563.2 1061.0 L536.4 1054.9 L542.0 1024.5 L510.5 1019.6 L507.8 1031.6 L439.1 1018.7 L435.0 1045.2 L422.8 1043.2 L426.4 1015.6 L374.5 1007.1 L376.7 993.1 L347.5 987.8 L369.3 855.0 L495.4 877.1 L560.6 832.3 L691.5 855.0 L693.3 840.8 L719.5 844.1 L723.5 821.2 L767.5 790.8 L770.2 772.6 L778.3 717.2 L762.7 700.7 L784.0 678.6 L814.6 708.2 L816.8 710.4 L800.4 810.9 L760.3 838.4 L721.2 1067.8 L695.3 1064.3 Z M714.9 870.8 L712.8 882.6 L590.1 862.5 L583.1 893.5 L595.6 896.1 L579.4 978.1 L551.3 972.9 L546.7 998.2 L539.3 997.0 L537.1 1006.3 L519.7 1003.1 L512.7 1001.8 L531.3 894.9 L513.6 891.4 L515.8 878.0 L563.7 844.8 L714.9 870.8 Z\"/>\n        <g class=\"zone\" data-id=\"atrium\" tabindex=\"0\" role=\"button\" aria-label=\"The Land lower level atrium\">\n          <circle class=\"room alt\" cx=\"703\" cy=\"483\" r=\"128\"/>\n          <text class=\"lbl\" x=\"703\" y=\"470\" text-anchor=\"middle\">The Land \u00b7 lower level</text>\n          <text class=\"sub\" x=\"703\" y=\"484\" text-anchor=\"middle\">Sunshine Seasons food court</text>\n        </g>\n        <g class=\"zone\" data-id=\"lobby\" tabindex=\"0\" role=\"button\" aria-label=\"Soarin' entrance and Great Hall\">\n          <path class=\"room inf\" d=\"M772 586 L842 566 L884 626 L866 648 L824 700 L800 690 L784 678 L766 668 L756 620 Z\"/>\n          <rect x=\"770\" y=\"590\" width=\"26\" height=\"8\" fill=\"var(--sign)\" transform=\"rotate(-16 783 594)\"/>\n          <text class=\"lbl sm\" x=\"818\" y=\"622\" text-anchor=\"middle\">Lobby /</text>\n          <text class=\"lbl sm\" x=\"818\" y=\"633\" text-anchor=\"middle\">Great Hall</text>\n          <text class=\"sub\" x=\"818\" y=\"645\" text-anchor=\"middle\">ex-Food Rocks</text>\n          <rect class=\"over\" x=\"728\" y=\"592\" width=\"18\" height=\"9\" transform=\"rotate(-16 737 596)\"/>\n          <text class=\"sub\" x=\"737\" y=\"612\" text-anchor=\"middle\">seating</text>\n        </g>\n        <g class=\"zone\" data-id=\"skyway\" tabindex=\"0\" role=\"button\" aria-label=\"Skyway queue hallway\">\n          <path class=\"room\" d=\"M800 690 L816 710 L800 811 L775 828 L786 760 L790 702 Z\"/>\n          <text class=\"lbl xs\" transform=\"translate(796 790) rotate(-82)\">Skyway</text>\n        </g>\n        <g class=\"zone\" data-id=\"exit\" tabindex=\"0\" role=\"button\" aria-label=\"Exit hallways\">\n          <path class=\"room alt\" d=\"M762 700 L778 717 L770 773 L767 791 L724 821 L720 844 L760 838 L775 828 L786 760 L790 702 L784 679 Z\"/>\n        </g>\n        <g transform=\"translate(590 862) rotate(10)\">\n          <path class=\"room open\" d=\"M124.5 -13 L124.5 -1 L0.2 0.5 L-1.3 32.2 L11.4 32.6 L9.7 116.2 L-18.9 115.9 L-19 141.6 L-26.5 141.8 L-27 151.3 L-51.8 151.1 L-52.1 42.6 L-70.1 42.2 L-70.3 28.6 L-28.9 -12.4 Z\"/>\n          <text class=\"sub\" x=\"-25\" y=\"70\" text-anchor=\"middle\">open courtyard</text>\n          <g data-interior=\"\"></g>\n          <path class=\"flow standby show\" data-flow=\"f-standby\" d=\"M160 -60 L143 -50 V-6 L138 0 H150 L138 16 H150 L138 32 H150 L138 48 H150 L138 64 H150 L138 80 H150 L138 96 H150 L138 112 H150 L138 128 H150 L144 150 L130 170\"/>\n          <path class=\"flow ll show\" data-flow=\"f-ll\" d=\"M156 -60 L130 -50 V170\"/>\n          <path class=\"flow standby show\" data-flow=\"f-dist\" d=\"M130 170 H8 M8 170 V9 H69 V25 M8 170 V334 H76 V318 M8 170 H-51 L-60 173 H-213 V105 H-198\"/>\n          <path class=\"flow exit show\" data-flow=\"f-exit-in\" d=\"M120 296 H128 L133 290 V240 L145 230 V180 L158 170 V-50 L150 -90 M118 46 H124 L158 46 V-50 M-176 50 V38 H-80 L-31 -18 H120 L140 -45 L150 -90\"/>\n        </g>\n        <path class=\"flow standby show\" data-flow=\"f-standby2\" d=\"M770 600 L812 640 L800 700 L796 760 L788 812 L764 838\"/>\n        <path class=\"flow ll show\" data-flow=\"f-ll2\" d=\"M764 606 L806 646 L796 702 L792 760 L784 812 L760 838\"/>\n        <path class=\"flow exit show\" data-flow=\"f-exit2\" d=\"M753 799 L776 760 L780 712 L770 682 L760 628 L752 600\"/>\n        <g transform=\"translate(905 1150)\">\n          <circle r=\"16\" fill=\"var(--sheet)\" stroke=\"var(--muted)\" stroke-width=\"1\"/>\n          <path d=\"M0 -13 L4 2 L0 -1 L-4 2 Z\" fill=\"var(--ink)\"/>\n          <text class=\"compass\" y=\"-20\" text-anchor=\"middle\">N</text>\n        </g>\n        <g class=\"scale\" transform=\"translate(360 1140)\">\n          <rect x=\"0\" y=\"0\" width=\"76.1\" height=\"4\"/>\n          <rect x=\"76.1\" y=\"0\" width=\"76.1\" height=\"4\" fill=\"var(--sheet)\" stroke=\"var(--ink)\" stroke-width=\".8\"/>\n          <text x=\"0\" y=\"-4\">0</text><text x=\"70\" y=\"-4\">20 m</text><text x=\"144\" y=\"-4\">40 m</text>\n          <text x=\"0\" y=\"16\" style=\"font-weight:400;fill:var(--muted)\">Imagery: Esri, Maxar, Earthstar Geographics</text><text x=\"0\" y=\"27\" style=\"font-weight:400;fill:var(--muted)\">Footprints \u00a9 OpenStreetMap \u00b7 interior after sheet E-44</text>\n        </g>\n      ";

export function buildInterior(I) {
const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
const txt = (attrs, s, parent) => { const n = el("text", attrs, parent); n.textContent = s; return n; };
const zone = (parent, id, n, label) => el("g", Object.assign({ class: "zone", "data-id": id, tabindex: 0, role: "button", "aria-label": label }, n ? { "data-n": n } : {}), parent);

/* Door in a horizontal wall at y, opening from x to x+len; leaf swings toward dir (+1 = +y). */
function doorH(p, x, y, len, dir, alt) {
  el("rect", { class: "gap" + (alt ? " alt" : ""), x, y: y - 1.3, width: len, height: 2.6 }, p);
  el("line", { class: "leaf", x1: x, y1: y, x2: x, y2: y + dir * len }, p);
  el("path", { class: "swing", d: `M${x + len} ${y} A${len} ${len} 0 0 ${dir > 0 ? 1 : 0} ${x} ${y + dir * len}` }, p);
}
/* Door in a vertical wall at x, opening from y to y+len; leaf swings toward dir (+1 = +x). */
function doorV(p, x, y, len, dir, alt) {
  el("rect", { class: "gap" + (alt ? " alt" : ""), x: x - 1.3, y, width: 2.6, height: len }, p);
  el("line", { class: "leaf", x1: x, y1: y, x2: x + dir * len, y2: y }, p);
  el("path", { class: "swing", d: `M${x} ${y + len} A${len} ${len} 0 0 ${dir > 0 ? 0 : 1} ${x + dir * len} ${y}` }, p);
}

/* One flight theater. Theater space: u runs left→right as a guest faces the screen, the screen
   is toward −v. Gate wall at v = 0, holding bays v 0…14, access corridor v 14…25, theater v −depth…0.
   Placement and proportions follow blueprint sheet E-44; ride and dome geometry follow
   US 6,354,954 / 6,727,971 (3 carriers × 3 rows; hemispherical dome, radius ≈ 480 in = 46.4 px). */
function theater(parent, id, t) {
  const g = el("g", { transform: `translate(${t.ox} ${t.oy}) rotate(${t.rot})` }, parent);
  const T = (a, s, p) => { if (t.rot === 180) a.transform = `rotate(180 ${a.x} ${a.y - 2})`; return txt(a, s, p); };
  const w = t.w, depth = t.depth, r = 46.4, rim = -t.rim;
  const cw = (w - 22) / 3;
  const cxs = [0, 1, 2].map(i => -w / 2 + 7 + cw / 2 + i * (cw + 4));

  // ---- concourse: holding bays + access corridor
  const cz = zone(g, "concourse", id, "Concourse " + id);
  el("rect", { class: "room alt", x: -w / 2, y: 0, width: w, height: 14 }, cz);
  el("rect", { class: "room", x: -w / 2, y: 14, width: w, height: 11 }, cz);
  cxs.forEach(cx => {
    [-cw * .25, 0, cw * .25].forEach(dx => {
      el("line", { class: "rail", x1: cx + dx, y1: 2, x2: cx + dx, y2: 12 }, cz);
      for (let s = 3.5; s < 12; s += 2.5) el("circle", { class: "spot", cx: cx + dx + 1.6, cy: s, r: .4 }, cz);
    });
    el("rect", { class: "over", x: cx - 8, y: 12.2, width: 16, height: 1.4 }, cz); // overhead preshow monitor
  });
  T({ class: "lbl xs", x: 0, y: 22, "text-anchor": "middle" }, "Concourse " + id, cz);

  // ---- theater room, backstage behind the dome, ride vehicle, exit ramp
  const tz = zone(g, "theater", id, "Theater " + id);
  el("rect", { class: "room", x: -w / 2, y: -depth, width: w, height: depth }, tz);
  el("path", { class: "back", d: `M${-w / 2 + .8} ${-depth + .8} H${w / 2 - .8} V${rim - r - 3} H${-w / 2 + .8} Z` }, tz);
  cxs.forEach(cx => {
    [0, 1, 2].forEach(ri => {
      const v = -4 - (2 - ri) * 4.6;              // row 1 nearest the screen
      el("rect", { class: "canopy", x: cx - cw / 2, y: v - 3.4, width: cw, height: 4.2 }, tz);
      el("rect", { class: "seat", x: cx - cw / 2 + .8, y: v - 2.6, width: cw - 1.6, height: 2.6 }, tz);
      el("rect", { class: "seat raised", x: cx - cw / 2 + 2, y: rim - 3 - ri * 3.2 - 2.4, width: cw - 4, height: 2.4 }, tz);
    });
    el("line", { class: "over", x1: cx, y1: -17, x2: cx, y2: rim - 3 }, tz); // carriage travel
  });
  el("rect", { class: "over", x: -6, y: rim - 9, width: 12, height: 6 }, tz); // projector, overhead
  T({ class: "sub", x: 0, y: rim - 11, "text-anchor": "middle" }, "projector (above)", tz);
  T({ class: "lbl sm", x: 0, y: (rim - 17) / 2 + 4, "text-anchor": "middle" }, "Theater " + id, tz);
  // exit: side door beside the loading floor + ramp along that wall (blueprint shows long ramps here)
  const ex = t.exitSide > 0 ? w / 2 : -w / 2;
  el("rect", { class: "ramp", x: t.exitSide > 0 ? w / 2 - 6 : -w / 2 + 1, y: rim + 4, width: 5, height: -rim - 26 }, tz);
  doorV(tz, ex, -22, 9, t.exitSide > 0 ? -1 : 1);
  el("rect", { class: "door", x: ex - 1.2, y: -22, width: 2.4, height: 9 }, tz);

  // ---- gates: one door per carrier
  const gz = zone(g, "gates", id, "Gates " + id);
  ["A", "B", "C"].forEach((sec, i) => {
    doorH(gz, cxs[i] - 6, 0, 12, -1, true);
    el("rect", { class: "gate", x: cxs[i] - 7, y: 1.6, width: 14, height: 4.6, rx: .8 }, gz);
    T({ class: "gtext", x: cxs[i], y: 5.2, "text-anchor": "middle" }, "GATE " + sec, gz);
  });

  // ---- dome screen: hemisphere opening toward the seats
  const dz = zone(g, "dome", id, "Dome " + id);
  el("path", { class: "dome", d: `M${-r - 2.5} ${rim} A${r + 2.5} ${r + 2.5} 0 0 1 ${r + 2.5} ${rim} H${r} A${r} ${r} 0 0 0 ${-r} ${rim} Z` }, dz);
  el("path", { class: "domeinner", d: `M${-r * .66} ${rim} A${r * .66} ${r * .66} 0 0 1 ${r * .66} ${rim}` }, dz);
  el("path", { class: "domeinner", d: `M${-r * .33} ${rim} A${r * .33} ${r * .33} 0 0 1 ${r * .33} ${rim}` }, dz);
  T({ class: "lbl xs", x: 0, y: rim - r * .78, "text-anchor": "middle" }, "Dome " + id, dz);
}

const rect = (p, x, y, w, h, cls) => el("rect", { class: cls, x, y, width: w, height: h }, p);

// Exit routes: 2016 north corridor + C's north hall (Theater C), upper-level lane along the queue hall (A, B)
const ez = zone(I, "exit", null, "Exit routes");
el("path", { class: "room alt", d: "M-34.1 -24.1 L124.5 -24.3 L124.5 -13 L-28.9 -12.4 L-70.3 28.6 L-90.5 31.3 Z" }, ez);
rect(ez, -205, 31.4, 114.5, 13.6, "room alt");
txt({ class: "lbl xs", x: 30, y: -16 }, "Exit corridor (2016)", ez);

// East queue hall: Lightning Lane | standby switchbacks
const lz = zone(I, "llhall", null, "Lightning Lane hallway");
rect(lz, 124.5, -52, 11.5, 209, "room alt");
txt({ class: "lbl xs", transform: "translate(132.5 120) rotate(-90)", x: 0, y: 0 }, "Lightning Lane", lz);
const sz = zone(I, "standby", null, "Standby queue hallway");
rect(sz, 136, -52, 16, 209, "room");
for (let y = 8, k = 0; y <= 136; y += 16, k++) el("line", { class: "rail", x1: k % 2 ? 140 : 136, y1: y, x2: k % 2 ? 152 : 148, y2: y }, sz);
[10, 50, 90].forEach(y => el("rect", { class: "over", x: 148.5, y, width: 2.5, height: 18 }, sz)); // overhead game screens
txt({ class: "lbl xs", transform: "translate(146.5 150) rotate(-90)", x: 0, y: 0 }, "Standby queue", sz);
// upper-level exit lane over the east side, continuing along Theater A
const uz = zone(I, "exit", null, "Exit routes");
rect(uz, 152, -52, 11.6, 232, "room alt upper");
rect(uz, 139, 180, 13, 140, "room alt upper");
txt({ class: "lbl xs", transform: "translate(160 140) rotate(-90)", x: 0, y: 0 }, "Exit (upper level)", uz);

// Concourse hall from the merge, west corridor to A and B, hall along C's south side
const hz = zone(I, "hall", null, "Concourse hall");
rect(hz, -51, 157, 161, 27, "room");
rect(hz, -217, 166, 166, 14, "room");
txt({ class: "lbl xs", x: 55, y: 173, "text-anchor": "middle" }, "Concourse hall", hz);
txt({ class: "lbl xs", x: -130, y: 175.5, "text-anchor": "middle" }, "→ Concourse C", hz);
const wz = zone(I, "west", null, "West corridor");
rect(wz, 2, 0, 12, 343, "room");
txt({ class: "lbl xs", transform: "translate(10.5 120) rotate(-90)", x: 0, y: 0 }, "↑ B   West corridor", wz);
txt({ class: "lbl xs", transform: "translate(10.5 300) rotate(-90)", x: 0, y: 0 }, "A ↓", wz);
const mz = zone(I, "merge", null, "Merge point");
rect(mz, 110, 157, 42, 27, "room");
el("rect", { class: "gap", x: 108.7, y: 158.5, width: 2.6, height: 24 }, mz);
el("rect", { class: "gap", x: 125.5, y: 155.6, width: 26, height: 3 }, mz);
el("rect", { x: 140, y: 176, width: 9, height: 5, fill: "var(--wall)" }, mz); // cast member podium
el("circle", { class: "merge", cx: 128, cy: 170, r: 5.5 }, mz);
txt({ x: 128, y: 172.4, "text-anchor": "middle", style: "font:700 6.5px var(--display);fill:var(--sign-ink)" }, "M", mz);

// Theaters (blueprint orientation): A loads at the south end, B at the north end, both domes face the central hall;
// C loads at its west end with the dome to the east.
const TH = el("g", {}, I);
theater(TH, "A", { ox: 76.5, oy: 314, rot: 0, w: 125, depth: 128, rim: 59, exitSide: 1 });
theater(TH, "B", { ox: 69.3, oy: 29, rot: 180, w: 110, depth: 126, rim: 59, exitSide: -1 });
theater(TH, "C", { ox: -194, oy: 105.5, rot: 90, w: 121, depth: 139, rim: 53, exitSide: -1 });
}
