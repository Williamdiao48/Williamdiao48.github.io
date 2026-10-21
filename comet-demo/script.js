const canvas = document.querySelector('#sky');
const ctx = canvas.getContext('2d', { alpha: false });
const motionCanvas = document.querySelector('#sky-motion');
const motionCtx = motionCanvas.getContext('2d');
const foregroundCanvas = document.querySelector('#sky-foreground');
const foregroundCtx = foregroundCanvas.getContext('2d');
const hero = document.querySelector('.hero');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
document.querySelector('#year').textContent = new Date().getFullYear();

let width = 0;
let height = 0;
let ratio = 1;
let particles = [];
let motes = [];
let draggedMote = null;
let streaks = [];
let scatterMarks = [];
let bodyMarks = [];
let pointer = { x: -1000, y: -1000, active: false, lastX: -1000, lastY: -1000, speed: 0 };
let lastFrame = 0;
let animationFrame = 0;
let heroVisible = true;
const interactiveWisps = [
  { strand: 0, start: .035, end: .72, offset: -9, spread: -13, phase: .3, width: 1.15, color: '171, 238, 255', alpha: .34 },
  { strand: 0, start: .08, end: .83, offset: 9, spread: 17, phase: 2.2, width: .85, color: '91, 207, 255', alpha: .28 },
  { strand: 0, start: .16, end: .69, offset: -16, spread: -8, phase: 4.1, width: .7, color: '220, 248, 255', alpha: .21 },
  { strand: 1, start: .055, end: .75, offset: 4, spread: 11, phase: 1.4, width: 1, color: '255, 153, 226', alpha: .27 },
  { strand: 1, start: .19, end: .8, offset: 13, spread: 16, phase: 3.7, width: .7, color: '203, 132, 255', alpha: .22 },
  { strand: 2, start: .045, end: .7, offset: -4, spread: -12, phase: 2.9, width: 1.05, color: '117, 218, 255', alpha: .3 },
  { strand: 2, start: .13, end: .82, offset: -12, spread: -15, phase: 5.2, width: .7, color: '98, 151, 255', alpha: .23 },
];
const moteLayouts = [
  { u: .025, strand: 0, dx: -54, dy: -37, size: 29, color: 'blue' },
  { u: .10, strand: 1, dx: 38, dy: 31, size: 25, color: 'pink' },
  { u: .17, strand: 2, dx: -70, dy: -20, size: 27, color: 'blue' },
  { u: .25, strand: 0, dx: -82, dy: 37, size: 22, color: 'white' },
  { u: .31, strand: 1, dx: 49, dy: 46, size: 25, color: 'pink' },
  { u: .39, strand: 2, dx: -78, dy: -23, size: 24, color: 'blue' },
  { u: .47, strand: 0, dx: -59, dy: 40, size: 21, color: 'white' },
  { u: .54, strand: 1, dx: 54, dy: 31, size: 21, color: 'pink' },
  { u: .62, strand: 2, dx: -52, dy: -29, size: 22, color: 'blue' },
  { u: .70, strand: 0, dx: 48, dy: 35, size: 19, color: 'white' },
  { u: .77, strand: 1, dx: 47, dy: 24, size: 20, color: 'pink' },
];

function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function mix(a, b, t) { return a + (b - a) * t; }

function sizeCanvas(layer, context) {
  layer.width = Math.round(width * ratio);
  layer.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function glow(context, x, y, radius, inner, outer = 'transparent') {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function makeMoteSprite(color) {
  const sprite = document.createElement('canvas');
  sprite.width = 72;
  sprite.height = 72;
  const context = sprite.getContext('2d');
  const gradient = context.createRadialGradient(36, 36, 0, 36, 36, 36);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(.07, 'rgba(248, 253, 255, .96)');
  gradient.addColorStop(.17, `rgba(${color}, .85)`);
  gradient.addColorStop(.46, `rgba(${color}, .16)`);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 72, 72);
  return sprite;
}

const moteSprites = {
  blue: makeMoteSprite('91, 205, 255'),
  pink: makeMoteSprite('246, 132, 221'),
  white: makeMoteSprite('192, 227, 255'),
};

function cloudShape(context, x, y, cloudWidth, cloudHeight, color, seed, blur = 0) {
  const rand = random(seed);
  context.save();
  context.filter = blur ? `blur(${blur}px)` : 'none';
  context.fillStyle = color;
  context.beginPath();
  const steps = 38;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const arch = Math.sin(t * Math.PI);
    const rough = Math.sin(t * 38 + seed) * .07 + Math.sin(t * 91 + seed * .12) * .045;
    const py = y - cloudHeight * (arch * (.58 + rough) + rand() * .11);
    if (!i) context.moveTo(x, py);
    else context.lineTo(x + t * cloudWidth, py);
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const py = y + cloudHeight * (.12 + Math.sin(t * 26 + seed) * .07 + rand() * .03);
    context.lineTo(x + t * cloudWidth, py);
  }
  context.closePath();
  context.fill();
  context.restore();
}

function drawBase(context) {
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#071423');
  sky.addColorStop(.32, '#0b2440');
  sky.addColorStop(.63, '#153656');
  sky.addColorStop(.79, '#1a3253');
  sky.addColorStop(1, '#071521');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  glow(context, width * .61, height * .78, width * .53, 'rgba(92, 111, 184, .24)');
  glow(context, width * .74, height * .82, width * .29, 'rgba(231, 112, 175, .12)');
  glow(context, width * .38, height * .84, width * .34, 'rgba(60, 159, 217, .15)');
  glow(context, width * .84, height * .24, width * .32, 'rgba(73, 74, 162, .16)');
  glow(context, width * .74, height * .4, width * .23, 'rgba(33, 130, 181, .10)');
  glow(context, width * .87, height * .18, width * .38, 'rgba(58, 93, 209, .19)');
  glow(context, width * .71, height * .39, width * .24, 'rgba(42, 163, 223, .12)');

  const rand = random(82171);
  for (let i = 0; i < Math.max(90, width * .13); i++) {
    const x = rand() * width;
    const y = rand() * height * .68;
    const r = rand() > .93 ? 1.25 : .35 + rand() * .45;
    const alpha = .18 + rand() * .42;
    context.fillStyle = `rgba(213, 232, 255, ${alpha})`;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
    if (r > 1) glow(context, x, y, 12, 'rgba(171, 213, 255, .23)');
  }

  cloudShape(context, -width * .12, height * .18, width * .47, height * .15, '#06111d', 25, 12);
  cloudShape(context, width * .21, height * .12, width * .33, height * .09, '#071523', 48, 9);
  cloudShape(context, width * .65, height * .2, width * .5, height * .17, '#071321', 7, 9);
  cloudShape(context, -width * .06, height * .41, width * .31, height * .10, 'rgba(5, 18, 32, .72)', 122, 12);
  cloudShape(context, width * .36, height * .36, width * .46, height * .10, 'rgba(6, 21, 37, .72)', 41, 10);
  cloudShape(context, width * .76, height * .47, width * .39, height * .10, 'rgba(5, 21, 38, .8)', 13, 9);
  cloudShape(context, width * .02, height * .57, width * .7, height * .08, 'rgba(9, 27, 44, .62)', 17, 14);

  // Nearby cloud banks catch a trace of the comet's blue and violet light.
  glow(context, width * .79, height * .24, width * .23, 'rgba(76, 119, 226, .17)');
  glow(context, width * .72, height * .4, width * .17, 'rgba(56, 189, 232, .12)');

  const horizon = context.createLinearGradient(0, height * .6, 0, height * .9);
  horizon.addColorStop(0, 'rgba(18, 54, 84, 0)');
  horizon.addColorStop(.56, 'rgba(95, 109, 165, .15)');
  horizon.addColorStop(1, 'rgba(4, 18, 32, 0)');
  context.fillStyle = horizon;
  context.fillRect(0, height * .6, width, height * .3);
}

function windows(context, building, rand, distant) {
  const spacingX = distant ? 7 : 10;
  const spacingY = distant ? 9 : 14;
  for (let y = building.top + 8; y < building.bottom - 5; y += spacingY) {
    for (let x = building.x + 5; x < building.x + building.width - 4; x += spacingX) {
      if (rand() > (distant ? .44 : .35)) continue;
      const cool = rand() > .3;
      context.fillStyle = cool
        ? `rgba(131, 194, 225, ${.13 + rand() * .32})`
        : `rgba(251, 189, 164, ${.14 + rand() * .28})`;
      context.fillRect(x, y, distant ? 2 : 3, distant ? 2 : 4);
    }
  }
}

function drawCity(context) {
  const rand = random(56804);
  const layers = [
    { baseline: .85, topMin: .68, topMax: .81, color: '#10283d', distant: true, minWidth: 14, maxWidth: 45 },
    { baseline: .97, topMin: .74, topMax: .89, color: '#0a1e30', distant: false, minWidth: 24, maxWidth: 70 },
  ];

  for (const layer of layers) {
    let x = -15;
    while (x < width + 25) {
      const bw = mix(layer.minWidth, layer.maxWidth, rand());
      const top = height * mix(layer.topMin, layer.topMax, rand());
      const bottom = height * layer.baseline;
      context.fillStyle = layer.color;
      context.fillRect(x, top, bw, bottom - top);
      context.fillStyle = 'rgba(108, 158, 201, .13)';
      context.fillRect(x, top, bw, 1);
      windows(context, { x, width: bw, top, bottom }, rand, layer.distant);
      if (rand() > .89) {
        context.strokeStyle = 'rgba(90, 133, 166, .28)';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x + bw * .5, top);
        context.lineTo(x + bw * .5, top - 13 - rand() * 21);
        context.stroke();
      }
      x += bw - 1;
    }
  }

  const skylineGlow = context.createLinearGradient(0, height * .7, 0, height * .92);
  skylineGlow.addColorStop(0, 'rgba(75, 130, 190, 0)');
  skylineGlow.addColorStop(1, 'rgba(84, 120, 181, .11)');
  context.fillStyle = skylineGlow;
  context.fillRect(0, height * .7, width, height * .22);

  // One occupied rooftop rather than a row of interchangeable buildings.
  const roofY = height * .924;
  context.fillStyle = '#06121f';
  context.fillRect(0, roofY, width, height - roofY);
  context.fillStyle = '#0c2032';
  context.fillRect(0, roofY, width, 4);
  context.fillStyle = '#071623';
  context.fillRect(width * .02, roofY - 32, width * .19, 32);
  context.fillRect(width * .71, roofY - 42, width * .29, 42);
  context.fillStyle = '#0d2436';
  context.fillRect(width * .70, roofY - 45, width * .3, 5);

  // Railing, posts, distant aerial and cables make the viewing position legible.
  context.strokeStyle = '#152b3a';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(width * .21, roofY - 58);
  context.lineTo(width * .71, roofY - 58);
  context.moveTo(width * .21, roofY - 10);
  context.lineTo(width * .71, roofY - 10);
  for (let x = width * .22; x < width * .71; x += 26) {
    context.moveTo(x, roofY - 59);
    context.lineTo(x, roofY - 9);
  }
  context.stroke();

  const aerialX = width * .84;
  context.strokeStyle = '#07111b';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(aerialX, roofY - 40);
  context.lineTo(aerialX + width * .022, height * .33);
  context.moveTo(aerialX - 30, height * .43);
  context.lineTo(aerialX + 54, height * .42);
  context.moveTo(aerialX - 22, height * .39);
  context.lineTo(aerialX + 43, height * .395);
  context.moveTo(aerialX - 12, height * .36);
  context.lineTo(aerialX + 28, height * .36);
  context.stroke();
  context.lineWidth = 1;
  context.strokeStyle = 'rgba(4, 13, 22, .95)';
  context.beginPath();
  context.moveTo(aerialX + width * .02, height * .42);
  context.quadraticCurveTo(width * .95, height * .57, width * 1.05, height * .58);
  context.moveTo(aerialX + width * .02, height * .43);
  context.quadraticCurveTo(width * .72, height * .57, width * .69, roofY - 46);
  context.stroke();

  // A water tank and a few rooftop plants add uneven, human-scale detail.
  const tankX = width * .10;
  context.fillStyle = '#071623';
  context.fillRect(tankX, roofY - 59, 43, 54);
  context.fillStyle = '#102638';
  context.fillRect(tankX - 4, roofY - 63, 51, 7);
  context.strokeStyle = '#182f40';
  context.lineWidth = 2;
  context.strokeRect(tankX, roofY - 59, 43, 54);
  context.strokeStyle = '#0a1e2a';
  context.lineWidth = 2;
  for (let i = 0; i < 13; i++) {
    const x = width * .16 + i * 3.8;
    const tip = roofY - 9 - (i % 3) * 7 - rand() * 12;
    context.beginPath();
    context.moveTo(width * .18, roofY);
    context.quadraticCurveTo(x, tip + 10, x, tip);
    context.stroke();
  }
}

function trailPoint(u, strand) {
  const mobile = width < 720;
  const headX = width * (mobile ? .56 : .59);
  const headY = height * (mobile ? .37 : .52);
  const tailX = width * (mobile ? 1.09 : .96);
  const tailY = height * (mobile ? -.15 : -.12);
  const sweep = Math.sin(u * Math.PI);
  let x = mix(headX, tailX, u) - width * .025 * sweep;
  let y = mix(headY, tailY, u) - height * .020 * sweep;
  // Colored trails stay beside the light point, then fan out farther overhead.
  const separation = .85 + .15 * Math.min(1, u / .38);
  if (strand === 1) {
    x += (width * (.009 + .024 * u) + Math.sin(u * 10) * 8 * u) * separation;
    y += height * (.018 + .018 * u) * separation;
  } else if (strand === 2) {
    x -= (width * (.014 + .035 * u) + Math.sin(u * 8 + 2) * 10 * u) * separation;
    y -= height * (.012 + .019 * u) * separation;
  }
  return { x, y };
}

function disturbedTrailPoint(u, strand) {
  const p = trailPoint(u, strand);
  if (!pointer.active || reducedMotion.matches) return p;
  const dx = p.x - pointer.x;
  const dy = p.y - pointer.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= 145) return p;
  const push = Math.pow(1 - distance / 145, 2) * 37;
  return {
    x: p.x + dx / (distance || 1) * push,
    y: p.y + dy / (distance || 1) * push,
  };
}

function trailNormal(u, strand) {
  const before = disturbedTrailPoint(Math.max(0, u - .003), strand);
  const after = disturbedTrailPoint(Math.min(1, u + .003), strand);
  const dx = after.x - before.x;
  const dy = after.y - before.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: -dy / length, y: dx / length };
}

function drawPlume(context, strand, maxWidth, colors) {
  const head = trailPoint(0, strand);
  const tail = trailPoint(1, strand);
  const gradient = context.createLinearGradient(head.x, head.y, tail.x, tail.y);
  gradient.addColorStop(0, colors[3]);
  gradient.addColorStop(.16, colors[0]);
  gradient.addColorStop(.56, colors[1]);
  gradient.addColorStop(.82, colors[2]);
  gradient.addColorStop(1, colors[3]);
  context.fillStyle = gradient;
  context.beginPath();
  for (let i = 0; i <= 70; i++) {
    const u = i / 70;
    const p = disturbedTrailPoint(u, strand);
    const n = trailNormal(u, strand);
    const taper = .10 + Math.pow(u, .55) * .90;
    const ragged = 1 + Math.sin(u * 24 + strand * 2) * .08 + Math.sin(u * 53 + strand) * .04;
    const side = maxWidth * taper * ragged * .5;
    const x = p.x + n.x * side;
    const y = p.y + n.y * side;
    if (!i) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  for (let i = 70; i >= 0; i--) {
    const u = i / 70;
    const p = disturbedTrailPoint(u, strand);
    const n = trailNormal(u, strand);
    const taper = .10 + Math.pow(u, .55) * .90;
    const ragged = 1 + Math.sin(u * 19 + strand * 4) * .10 + Math.sin(u * 61 + strand) * .05;
    const side = maxWidth * taper * ragged * .5;
    context.lineTo(p.x - n.x * side, p.y - n.y * side);
  }
  context.closePath();
  context.fill();
}

function drawSoftPlume(context, strand, maxWidth, colors, blur, alpha = 1) {
  context.save();
  context.globalCompositeOperation = 'screen';
  context.globalAlpha = alpha;
  context.filter = `blur(${blur}px)`;
  drawPlume(context, strand, maxWidth, colors);
  context.restore();
}

function drawStreaks(context, time) {
  context.save();
  context.globalCompositeOperation = 'screen';
  for (const streak of streaks) {
    traceRibbon(context, streak, streak.width, streak.taper, time, 24);
    const flicker = .95 + Math.sin(time * .0009 + streak.phase) * .05;
    context.globalAlpha = streak.alpha * flicker;
    const start = ribbonPoint(streak, 0, time);
    const end = ribbonPoint(streak, 1, time);
    const fade = context.createLinearGradient(start.x, start.y, end.x, end.y);
    fade.addColorStop(0, colorWithAlpha(streak.color, .24));
    fade.addColorStop(.18, colorWithAlpha(streak.color, .85));
    fade.addColorStop(.48, colorWithAlpha(streak.color, 1));
    fade.addColorStop(.84, colorWithAlpha(streak.color, .76));
    fade.addColorStop(1, colorWithAlpha(streak.color, 0));
    context.fillStyle = fade;
    context.shadowBlur = streak.width > 5 ? 6 : 2;
    context.shadowColor = streak.color;
    context.fill();
  }
  context.restore();
}

function drawBodyTexture(context, time) {
  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  context.filter = 'blur(1.2px)';
  for (const mark of bodyMarks) {
    const p = disturbedTrailPoint(mark.u, mark.strand);
    const n = trailNormal(mark.u, mark.strand);
    const drift = reducedMotion.matches ? 0 : Math.sin(time * .0005 + mark.phase) * mark.drift;
    const x = p.x + n.x * (mark.offset + drift);
    const y = p.y + n.y * (mark.offset + drift);
    const before = disturbedTrailPoint(Math.max(0, mark.u - .004), mark.strand);
    const after = disturbedTrailPoint(Math.min(1, mark.u + .004), mark.strand);
    const angle = Math.atan2(after.y - before.y, after.x - before.x) + mark.skew;
    const dx = Math.cos(angle) * mark.length * .5;
    const dy = Math.sin(angle) * mark.length * .5;
    context.strokeStyle = mark.color;
    context.lineWidth = mark.width;
    context.globalAlpha = mark.alpha;
    context.beginPath();
    context.moveTo(x - dx, y - dy);
    context.quadraticCurveTo(x + n.x * mark.bend, y + n.y * mark.bend, x + dx, y + dy);
    context.stroke();
  }
  context.restore();
}

function drawScatterMarks(context, time) {
  context.save();
  context.globalCompositeOperation = 'screen';
  for (const mark of scatterMarks) {
    const anchor = disturbedTrailPoint(mark.u, mark.strand);
    const normal = trailNormal(mark.u, mark.strand);
    const drift = reducedMotion.matches ? 0 : Math.sin(time * .00045 + mark.phase) * mark.drift;
    const centerX = anchor.x + normal.x * (mark.offset + drift) + mark.jitterX;
    const centerY = anchor.y + normal.y * (mark.offset + drift) + mark.jitterY;
    context.globalAlpha = mark.alpha * Math.min(1, (mark.u - .10) / .22);
    context.fillStyle = mark.color;
    if (mark.speck) {
      // Tiny imperfect paint deposits, rather than a field of glowing stars.
      context.beginPath();
      context.ellipse(centerX, centerY, mark.size * mark.stretch, mark.size, mark.angle, 0, Math.PI * 2);
      context.fill();
      continue;
    }
    const dx = Math.cos(mark.angle) * mark.length;
    const dy = Math.sin(mark.angle) * mark.length;
    const sideX = -Math.sin(mark.angle);
    const sideY = Math.cos(mark.angle);
    const fromX = centerX - dx * .5;
    const fromY = centerY - dy * .5;
    const toX = centerX + dx * .5;
    const toY = centerY + dy * .5;
    context.strokeStyle = mark.color;
    context.lineWidth = mark.width;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(fromX, fromY);
    context.quadraticCurveTo(centerX + sideX * mark.bend, centerY + sideY * mark.bend, toX, toY);
    context.stroke();
    // A few broken strokes get a companion scrape instead of a smooth glow.
    if (mark.fray) {
      context.globalAlpha *= .48;
      context.lineWidth = Math.max(.45, mark.width * .34);
      context.beginPath();
      context.moveTo(fromX + dx * .23 + sideX * mark.width, fromY + dy * .23 + sideY * mark.width);
      context.lineTo(toX - dx * .12 + sideX * mark.width, toY - dy * .12 + sideY * mark.width);
      context.stroke();
    }
  }
  context.restore();
}

function ribbonPoint(ribbon, progress, time) {
  const u = mix(ribbon.start, ribbon.end, progress);
  const p = disturbedTrailPoint(u, ribbon.strand);
  const n = trailNormal(u, ribbon.strand);
  const motion = reducedMotion.matches ? 0 : time;
  const separation = ribbon.whiteCore ? 1 : .85 + .15 * Math.min(1, u / .38);
  const dance = ribbon.whiteCore ? 0 : (
    Math.sin(u * 12 + ribbon.phase + motion * .00085) * ribbon.waver
    + Math.sin(u * 27 - ribbon.phase * 1.4 - motion * .0013) * ribbon.waver * .42) * separation;
  const offset = ribbon.offset * (5 + u * ribbon.spread) * separation
    + (ribbon.whiteCore ? Math.sin(u * 17 + ribbon.phase + motion * .00018) * ribbon.waver * u : dance);
  return { x: p.x + n.x * offset, y: p.y + n.y * offset, n };
}

function traceRibbon(context, ribbon, thickness, taperPower, time, steps = 40, widthFloor = 0) {
  context.beginPath();
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const p = ribbonPoint(ribbon, progress, time);
    // Every strand is broad overhead (progress 1) and narrows into the lower point (progress 0).
    const envelope = widthFloor + (1 - widthFloor) * Math.pow(progress, taperPower);
    const uneven = 1 + Math.sin(progress * 18 + ribbon.phase) * .19
      + Math.sin(progress * 41 + ribbon.phase * 2) * .08
      + (ribbon.paint ? Math.sin(progress * 113 + ribbon.phase * 3) * .25 : 0);
    const halfWidth = thickness * envelope * uneven * .5;
    const x = p.x + p.n.x * halfWidth;
    const y = p.y + p.n.y * halfWidth;
    if (!i) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  for (let i = steps; i >= 0; i--) {
    const progress = i / steps;
    const p = ribbonPoint(ribbon, progress, time);
    const envelope = widthFloor + (1 - widthFloor) * Math.pow(progress, taperPower);
    const uneven = 1 + Math.sin(progress * 15 + ribbon.phase + 1) * .16
      + Math.sin(progress * 36 + ribbon.phase) * .07
      + (ribbon.paint ? Math.sin(progress * 97 + ribbon.phase * 2) * .23 : 0);
    const halfWidth = thickness * envelope * uneven * .5;
    context.lineTo(p.x - p.n.x * halfWidth, p.y - p.n.y * halfWidth);
  }
  context.closePath();
}

function colorWithAlpha(hex, alpha) {
  const value = hex.slice(1);
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function drawLayeredRibbon(context, ribbon, time) {
  context.save();
  context.globalCompositeOperation = 'screen';
  const mobileScale = width < 720 ? .72 : 1;
  const layers = [
    { width: ribbon.whiteCore ? 7 : 5.8, fill: ribbon.halo,
      alpha: ribbon.whiteCore ? .52 : .30, blur: ribbon.whiteCore ? 22 : 17,
      taper: ribbon.whiteCore ? .76 : ribbon.tipBridge ? .60 : .82,
      widthFloor: ribbon.whiteCore ? .18 : 0, headOpacity: ribbon.whiteCore ? .95 : 0 },
    ribbon.whiteCore ? { width: 3.5, fill: '#278ee2', alpha: .68, blur: 8,
      taper: .72, widthFloor: .34, headOpacity: .95 } : null,
    { width: 2.6, fill: ribbon.edge, alpha: ribbon.whiteCore ? .68 : .55,
      blur: 5, taper: ribbon.whiteCore ? 1.05 : ribbon.tipBridge ? .62 : .90,
      widthFloor: ribbon.whiteCore ? .10 : 0, headOpacity: ribbon.whiteCore ? .88 : 0 },
    { width: ribbon.whiteCore ? 1.5 : 1.4, fill: ribbon.mid,
      alpha: ribbon.whiteCore ? .9 : .6, blur: ribbon.whiteCore ? 2 : 3.5,
      taper: ribbon.whiteCore ? .84 : ribbon.tipBridge ? .68 : .94 },
    { width: ribbon.whiteCore ? 1.12 : .48, fill: ribbon.core, alpha: ribbon.whiteCore ? 1 : .58,
      blur: ribbon.whiteCore ? .45 : 1.7,
      taper: ribbon.whiteCore ? .72 : ribbon.tipBridge ? .76 : 1.08 },
  ];
  for (const layer of layers.filter(Boolean)) {
    traceRibbon(context, ribbon, ribbon.width * layer.width * mobileScale,
      layer.taper, time, 40, layer.widthFloor || 0);
    context.globalAlpha = Math.min(1, layer.alpha * (ribbon.tipBridge ? 1.35 : 1))
      * (width < 720 ? .85 : 1);
    const start = ribbonPoint(ribbon, 0, time);
    const end = ribbonPoint(ribbon, 1, time);
    const fade = context.createLinearGradient(start.x, start.y, end.x, end.y);
    if (ribbon.whiteCore) {
      fade.addColorStop(0, colorWithAlpha(layer.fill, layer.headOpacity || .65));
      fade.addColorStop(.18, colorWithAlpha(layer.fill, .90));
      fade.addColorStop(.55, colorWithAlpha(layer.fill, .96));
      fade.addColorStop(.84, colorWithAlpha(layer.fill, 1));
      fade.addColorStop(1, colorWithAlpha(layer.fill, .72));
    } else {
      fade.addColorStop(0, colorWithAlpha(layer.fill, 0));
      fade.addColorStop(.08, colorWithAlpha(layer.fill, ribbon.tipBridge ? .42 : .25));
      fade.addColorStop(.18, colorWithAlpha(layer.fill, ribbon.tipBridge ? .75 : .66));
      fade.addColorStop(.55, colorWithAlpha(layer.fill, .82));
      fade.addColorStop(.86, colorWithAlpha(layer.fill, .85));
      fade.addColorStop(1, colorWithAlpha(layer.fill, 0));
    }
    context.fillStyle = fade;
    context.filter = `blur(${layer.blur}px)`;
    context.fill();
  }
  context.restore();
}

function drawLayeredStreaks(context, time) {
  const ribbons = [
    // Short chromatic wisps fade beside the orb rather than joining the white core.
    { strand: 2, start: 0, end: .43, offset: -.22, spread: 15, waver: 1.2, phase: 2.1, width: 3,
      tipBridge: true,
      halo: '#145fb9', edge: '#1688d5', mid: '#3bbfec', core: '#68d8f5' },
    { strand: 1, start: 0, end: .40, offset: .12, spread: 15, waver: 1.3, phase: 4.1, width: 3,
      tipBridge: true,
      halo: '#8e269c', edge: '#bd48bf', mid: '#e567d4', core: '#f8a2e3' },
    { strand: 2, start: 0, end: .92, offset: -.27, spread: 23, waver: 3.4, phase: 2.1, width: 2.3,
      halo: '#125cc6', edge: '#087bbb', mid: '#119dcc', core: '#27bedf' },
    { strand: 1, start: 0, end: .73, offset: .12, spread: 23, waver: 3.7, phase: 4.1, width: 2.3,
      halo: '#a8229e', edge: '#ca269f', mid: '#df3aaf', core: '#f052bf' },
    { strand: 0, start: .13, end: .79, offset: .45, spread: 27, waver: 3.6, phase: 1.7, width: 1.6,
      halo: '#1278bd', edge: '#0a9bcb', mid: '#19b7db', core: '#31cbe8' },
    { strand: 0, start: 0, end: .90, offset: 0, spread: 24, waver: 1.5, phase: .3, width: 6.0,
      whiteCore: true, halo: '#2c8bdf', edge: '#72d3f4', mid: '#d4f4ff', core: '#ffffff' },
  ];
  for (const ribbon of ribbons) drawLayeredRibbon(context, ribbon, time);
}

function cometStroke(context, strand, color, widthStart, widthEnd, blur) {
  context.save();
  const ribbon = { strand, start: 0, end: 1, offset: 0, spread: 0, waver: 0, phase: 0 };
  const start = trailPoint(0, strand);
  const end = trailPoint(1, strand);
  const gradient = context.createLinearGradient(start.x, start.y, end.x, end.y);
  gradient.addColorStop(0, color[2]);
  gradient.addColorStop(.3, color[1]);
  gradient.addColorStop(.75, color[0]);
  gradient.addColorStop(1, color[2]);
  context.fillStyle = gradient;
  context.shadowColor = color[0];
  context.shadowBlur = blur;
  context.globalAlpha = .13;
  traceRibbon(context, ribbon, widthStart, .9, 0);
  context.fill();
  context.globalAlpha = .88;
  context.shadowBlur = blur * .4;
  traceRibbon(context, ribbon, widthEnd, 1.6, 0);
  context.fill();
  context.restore();
}

function makeParticles() {
  const rand = random(987413);
  const amount = width < 720
    ? Math.min(160, Math.max(120, Math.round(width * .28)))
    : Math.min(416, Math.max(176, Math.round(width * .34)));
  particles = Array.from({ length: amount }, () => {
    const strand = rand() < .60 ? 0 : rand() < .57 ? 1 : 2;
    const u = Math.pow(rand(), .68);
    const spread = (7 + u * 72) * (width < 720 ? .72 : 1);
    const angle = rand() * Math.PI * 2;
    return {
      strand,
      u,
      jitterX: Math.cos(angle) * Math.pow(rand(), 1.4) * spread,
      jitterY: Math.sin(angle) * Math.pow(rand(), 1.4) * spread * .68,
      phase: rand() * Math.PI * 2,
      size: rand() > .98 ? 1.6 : .2 + rand() * .75,
      offsetX: 0,
      offsetY: 0,
      velocityX: 0,
      velocityY: 0,
    };
  });

  draggedMote = null;
  const moteScale = width < 720 ? .72 : 1;
  motes = moteLayouts.slice(0, width < 720 ? 7 : moteLayouts.length).map((layout, index) => ({
    ...layout,
    dx: layout.dx * moteScale,
    dy: layout.dy * moteScale,
    size: layout.size * moteScale,
    phase: index * 1.83,
    offsetX: 0,
    offsetY: 0,
    velocityX: 0,
    velocityY: 0,
    x: -1000,
    y: -1000,
  }));

  const streakRandom = random(49129);
  const brightStreaks = ['#5dccf0', '#79d9f3', '#3caee8', '#4b9fe5', '#db78cd'];
  const middleStreaks = ['#258ee2', '#20a9da', '#3272d6', '#6260cd', '#ae58d1'];
  const edgeStreaks = ['#174b9b', '#2464ad', '#48428f', '#81428e', '#315987'];
  const count = width < 720 ? 100 : 152;
  streaks = Array.from({ length: count }, (_, index) => {
    const broad = index < count * .24;
    const fragment = streakRandom() > (broad ? .55 : .27);
    const strand = index % 7 === 0 ? 1 : index % 4 === 0 ? 2 : 0;
    const start = fragment ? .16 + streakRandom() * .56 : .055 + streakRandom() * .10;
    const end = fragment
      ? Math.min(.98, start + .05 + streakRandom() * .22)
      : .69 + streakRandom() * .31;
    const offset = streakRandom() * 2 - 1;
    const distanceFromCore = Math.abs(offset);
    const zone = distanceFromCore < .28 ? brightStreaks
      : distanceFromCore < .67 ? middleStreaks : edgeStreaks;
    return {
      strand,
      start,
      end,
      offset,
      spread: (broad ? 19 : 15) + streakRandom() * (broad ? 43 : 60),
      waver: 1 + streakRandom() * (broad ? 2 : 3),
      phase: streakRandom() * Math.PI * 2,
      width: broad ? 3 + streakRandom() * 8 : .45 + streakRandom() * 2.6,
      taper: broad ? .9 + streakRandom() * .5 : 1.2 + streakRandom() * .8,
      alpha: (broad ? .34 + streakRandom() * .26 : .3 + streakRandom() * .32)
        * (1 - distanceFromCore * .46),
      color: zone[Math.floor(streakRandom() * zone.length)],
      paint: true,
    };
  });

  const bodyRandom = random(712003);
  const innerBody = ['#4ba9e7', '#70cbef', '#8cdbf3', '#328fdb'];
  const middleBody = ['#176bc7', '#237bd4', '#2c8cdd', '#4b6ccd'];
  const outerBody = ['#103a83', '#16509f', '#2d51a3', '#493e89'];
  bodyMarks = Array.from({ length: width < 720 ? 225 : 352 }, (_, index) => {
    const u = .09 + bodyRandom() * .84;
    const strand = index % 8 === 0 ? 2 : 0;
    const envelope = (5 + u * 36) * (width < 720 ? .72 : 1);
    const offset = (bodyRandom() * 2 - 1) * envelope;
    const distanceFromCore = Math.abs(offset) / envelope;
    const zone = distanceFromCore < .3 ? innerBody : distanceFromCore < .67 ? middleBody : outerBody;
    return {
      u,
      strand,
      offset,
      length: 7 + bodyRandom() * 27,
      width: .7 + bodyRandom() * 3.2,
      alpha: (.4 - distanceFromCore * .18) + bodyRandom() * .28,
      color: zone[Math.floor(bodyRandom() * zone.length)],
      skew: (bodyRandom() * 2 - 1) * .16,
      bend: (bodyRandom() * 2 - 1) * 2.2,
      phase: bodyRandom() * Math.PI * 2,
      drift: bodyRandom() * 1.5,
    };
  });

  const markRandom = random(803117);
  const markColors = ['#2fa9e7', '#54c8eb', '#79d9f3', '#4a76d9', '#c562d4', '#ed81d2', '#f9d47d', '#f29b70'];
  scatterMarks = Array.from({ length: width < 720 ? 196 : 312 }, (_, index) => {
    const speck = index % 9 < 5;
    const u = .10 + markRandom() * .82;
    const strand = index % 7 === 0 ? 1 : index % 5 === 0 ? 2 : 0;
    const before = trailPoint(Math.max(0, u - .01), strand);
    const after = trailPoint(Math.min(1, u + .01), strand);
    const trailAngle = Math.atan2(after.y - before.y, after.x - before.x);
    const skew = (markRandom() * 2 - 1) * (speck ? .45 : .29);
    const outer = markRandom() > .72;
    const spread = (outer ? 110 : 62) + u * (outer ? 100 : 70);
    return {
      speck,
      u,
      strand,
      offset: (markRandom() * 2 - 1) * spread * (width < 720 ? .7 : 1),
      jitterX: (markRandom() * 2 - 1) * 7,
      jitterY: (markRandom() * 2 - 1) * 7,
      angle: trailAngle + skew,
      length: (outer ? 8 : 3) + markRandom() * (outer ? 32 : 20) * (width < 720 ? .7 : 1),
      width: .65 + markRandom() * (outer ? 1.7 : 2.6),
      size: .55 + Math.pow(markRandom(), 1.7) * (outer ? 2.2 : 3.0),
      stretch: 1 + markRandom() * 1.5,
      alpha: .3 + markRandom() * .42,
      bend: (markRandom() * 2 - 1) * 1.5,
      fray: markRandom() > .87,
      drift: markRandom() * 1.3,
      phase: markRandom() * Math.PI * 2,
      color: markColors[Math.floor(Math.pow(markRandom(), 1.4) * markColors.length)],
    };
  });
}

function drawCometArtwork(context, time) {
  context.save();
  context.globalCompositeOperation = 'screen';
  const head = trailPoint(0, 0);

  glow(context, head.x, head.y, 225, 'rgba(44, 154, 255, .36)');
  glow(context, head.x + 26, head.y + 12, 155, 'rgba(255, 69, 162, .24)');

  for (let u = .08; u < .82; u += .085) {
    const bluePoint = trailPoint(u, 2);
    const pinkPoint = trailPoint(u, 1);
    glow(context, bluePoint.x, bluePoint.y, 70 + u * 55, `rgba(42, 155, 255, ${.14 + .11 * u})`);
    glow(context, pinkPoint.x, pinkPoint.y, 55 + u * 42, `rgba(232, 75, 197, ${.085 + .08 * u})`);
  }

  // Broad, low-contrast bloom sits beneath the strands and lights the surrounding sky.
  drawSoftPlume(context, 0, width < 720 ? 104 : 156, [
    'rgba(33, 139, 255, .28)',
    'rgba(24, 118, 255, .34)',
    'rgba(39, 74, 201, .23)',
    'rgba(18, 70, 185, 0)',
  ], 36, .78);
  drawSoftPlume(context, 1, width < 720 ? 52 : 78, [
    'rgba(248, 83, 213, .32)',
    'rgba(225, 67, 207, .35)',
    'rgba(146, 64, 196, .19)',
    'rgba(103, 51, 160, 0)',
  ], 25, .84);
  drawSoftPlume(context, 0, width < 720 ? 23 : 36, [
    'rgba(166, 231, 255, .42)',
    'rgba(139, 211, 255, .5)',
    'rgba(99, 166, 251, .32)',
    'rgba(70, 150, 223, 0)',
  ], 12, .8);

  context.save();
  context.globalCompositeOperation = 'source-over';
  context.filter = 'blur(12px)';
  drawPlume(context, 0, width < 720 ? 44 : 71, [
    'rgba(13, 49, 119, .34)',
    'rgba(17, 60, 135, .38)',
    'rgba(18, 43, 105, .30)',
    'rgba(12, 37, 91, 0)',
  ]);
  context.filter = 'blur(9px)';
  drawPlume(context, 0, width < 720 ? 34 : 55, [
    'rgba(27, 100, 202, .72)',
    'rgba(29, 111, 212, .77)',
    'rgba(28, 75, 176, .56)',
    'rgba(23, 73, 164, 0)',
  ]);
  context.filter = 'blur(6px)';
  drawPlume(context, 0, width < 720 ? 19 : 30, [
    'rgba(96, 193, 239, .58)',
    'rgba(77, 181, 240, .67)',
    'rgba(54, 128, 220, .48)',
    'rgba(43, 119, 212, 0)',
  ]);
  context.filter = 'blur(4px)';
  drawPlume(context, 0, width < 720 ? 9 : 14, [
    'rgba(154, 231, 252, .48)',
    'rgba(128, 216, 250, .59)',
    'rgba(86, 170, 233, .34)',
    'rgba(70, 150, 223, 0)',
  ]);
  context.restore();
  drawSoftPlume(context, 1, width < 720 ? 17 : 27, [
    'rgba(255, 166, 225, .22)',
    'rgba(239, 91, 212, .20)',
    'rgba(163, 71, 200, .11)',
    'rgba(103, 51, 160, 0)',
  ], 7);
  drawSoftPlume(context, 2, width < 720 ? 16 : 25, [
    'rgba(162, 230, 255, .19)',
    'rgba(79, 141, 255, .16)',
    'rgba(46, 101, 233, .10)',
    'rgba(30, 66, 180, 0)',
  ], 7);

  cometStroke(context, 2, ['rgba(63, 188, 255, .86)', 'rgba(54, 89, 231, .42)', 'rgba(89, 68, 181, 0)'], 30, 1.8, 45);
  cometStroke(context, 1, ['rgba(253, 100, 205, .84)', 'rgba(171, 73, 228, .43)', 'rgba(111, 62, 196, 0)'], 27, 1.35, 40);
  cometStroke(context, 0, ['rgba(65, 196, 237, .86)', 'rgba(42, 168, 218, .68)', 'rgba(78, 100, 210, 0)'], 26, 2.1, 42);
  drawStreaks(context, time);
  drawBodyTexture(context, time);
  drawLayeredStreaks(context, time);
  drawScatterMarks(context, time);
  context.restore();
}

function drawInteractiveWisps(context, time) {
  const mobileScale = width < 720 ? .7 : 1;
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const wisp of interactiveWisps) {
    const start = disturbedTrailPoint(wisp.start, wisp.strand);
    const end = disturbedTrailPoint(wisp.end, wisp.strand);
    const fade = context.createLinearGradient(start.x, start.y, end.x, end.y);
    fade.addColorStop(0, `rgba(${wisp.color}, 0)`);
    fade.addColorStop(.13, `rgba(${wisp.color}, ${wisp.alpha * .75})`);
    fade.addColorStop(.52, `rgba(${wisp.color}, ${wisp.alpha})`);
    fade.addColorStop(1, `rgba(${wisp.color}, 0)`);
    context.strokeStyle = fade;
    context.lineWidth = wisp.width * mobileScale;
    context.beginPath();
    for (let i = 0; i <= 38; i++) {
      const progress = i / 38;
      const u = mix(wisp.start, wisp.end, progress);
      const point = disturbedTrailPoint(u, wisp.strand);
      const normal = trailNormal(u, wisp.strand);
      const sway = reducedMotion.matches ? 0 : Math.sin(time * .00075 + u * 19 + wisp.phase) * 2.6 * Math.sin(progress * Math.PI);
      const side = (wisp.offset + wisp.spread * progress + sway) * mobileScale;
      const x = point.x + normal.x * side;
      const y = point.y + normal.y * side;
      if (!i) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
  context.restore();
}

function drawInteractiveMotes(context, time, delta) {
  for (const mote of motes) {
    const anchor = trailPoint(mote.u, mote.strand);
    const driftX = reducedMotion.matches ? 0 : Math.sin(time * .00062 + mote.phase) * 3;
    const driftY = reducedMotion.matches ? 0 : Math.cos(time * .00048 + mote.phase) * 3.5;
    const baseX = anchor.x + mote.dx + driftX;
    const baseY = anchor.y + mote.dy + driftY;

    if (draggedMote === mote) {
      mote.offsetX = pointer.x - baseX;
      mote.offsetY = pointer.y - baseY;
      mote.velocityX = 0;
      mote.velocityY = 0;
    } else if (!reducedMotion.matches) {
      const dx = baseX + mote.offsetX - pointer.x;
      const dy = baseY + mote.offsetY - pointer.y;
      const distance = Math.hypot(dx, dy);
      if (pointer.active && distance < 108) {
        const force = Math.pow(1 - distance / 108, 2) * (pointer.speed > 2 ? 3.7 : 1.4) * delta;
        mote.velocityX += dx / (distance || 1) * force;
        mote.velocityY += dy / (distance || 1) * force;
      }
      mote.velocityX += -mote.offsetX * .024 * delta;
      mote.velocityY += -mote.offsetY * .024 * delta;
      mote.velocityX *= Math.pow(.89, delta);
      mote.velocityY *= Math.pow(.89, delta);
      mote.offsetX += mote.velocityX * delta;
      mote.offsetY += mote.velocityY * delta;
    }

    mote.x = baseX + mote.offsetX;
    mote.y = baseY + mote.offsetY;
    const nearPointer = pointer.active && Math.hypot(mote.x - pointer.x, mote.y - pointer.y) < 42;
    const size = mote.size * (nearPointer ? 1.18 : 1);
    context.globalAlpha = mote.color === 'white' ? .67 : .77;
    context.drawImage(moteSprites[mote.color], mote.x - size / 2, mote.y - size / 2, size, size);
  }
  context.globalAlpha = 1;
}

function drawCometParticles(context, time, delta) {
  context.save();
  context.globalCompositeOperation = 'screen';
  drawInteractiveWisps(context, time);
  const head = trailPoint(0, 0);
  const pulse = 1 + Math.sin(time * .0012) * .08;
  const pink = '#f39adf';
  const blue = '#37c5e9';
  for (const particle of particles) {
    const anchor = trailPoint(particle.u, particle.strand);
    const flow = reducedMotion.matches ? 0 : Math.sin(time * .0018 + particle.phase) * (2 + particle.u * 3);
    const bx = anchor.x + particle.jitterX + flow;
    const by = anchor.y + particle.jitterY + flow * .38;
    const dx = bx + particle.offsetX - pointer.x;
    const dy = by + particle.offsetY - pointer.y;
    const distance = Math.hypot(dx, dy);

    if (!reducedMotion.matches && pointer.active && distance < 150) {
      const strength = Math.pow(1 - distance / 150, 2) * (pointer.speed > 2 ? 6.5 : 2.7);
      particle.velocityX += (dx / (distance || 1)) * strength * delta;
      particle.velocityY += (dy / (distance || 1)) * strength * delta;
    }

    if (!reducedMotion.matches) {
      particle.velocityX += -particle.offsetX * .019 * delta;
      particle.velocityY += -particle.offsetY * .019 * delta;
      particle.velocityX *= Math.pow(.9, delta);
      particle.velocityY *= Math.pow(.9, delta);
      particle.offsetX += particle.velocityX * delta;
      particle.offsetY += particle.velocityY * delta;
    }

    const x = bx + particle.offsetX;
    const y = by + particle.offsetY;
    const fade = (1 - particle.u) * .8 + .3;
    const twinkle = reducedMotion.matches ? .75 : .68 + Math.sin(time * .0025 + particle.phase) * .28;
    context.globalAlpha = Math.min(1, fade * twinkle * 1.3);
    context.fillStyle = particle.strand === 1 ? pink : blue;
    context.beginPath();
    context.arc(x, y, particle.size, 0, Math.PI * 2);
    context.fill();
    if (particle.size > 1.9) {
      glow(context, x, y, 11, particle.strand === 1 ? 'rgba(255, 125, 218, .28)' : 'rgba(126, 229, 255, .34)');
    }
  }
  context.globalAlpha = 1;
  drawInteractiveMotes(context, time, delta);
  glow(context, head.x, head.y, 47 * pulse, 'rgba(188, 240, 255, .32)');
  glow(context, head.x, head.y, 13 * pulse, 'rgba(104, 216, 246, .6)');
  context.save();
  context.fillStyle = '#f8ffff';
  context.shadowColor = '#d5faff';
  context.shadowBlur = 10;
  context.beginPath();
  context.arc(head.x, head.y, 2.8 * pulse, 0, Math.PI * 2);
  context.fill();
  context.restore();
  context.restore();
}

function drawForeground(context) {
  // Keep sky clouds behind the comet; foreground occlusion read as dark patches.
  drawCity(context);
}

function resize() {
  const bounds = hero.getBoundingClientRect();
  width = Math.max(320, bounds.width);
  height = Math.max(600, bounds.height);
  ratio = Math.min(devicePixelRatio || 1, width < 720 ? 1.3 : 1.6);
  sizeCanvas(canvas, ctx);
  sizeCanvas(motionCanvas, motionCtx);
  sizeCanvas(foregroundCanvas, foregroundCtx);

  drawBase(ctx);
  makeParticles();
  // The multi-pass blurs are expensive; bake them into the still sky once per resize.
  const wasPointerActive = pointer.active;
  pointer.active = false;
  drawCometArtwork(ctx, 0);
  pointer.active = wasPointerActive;
  drawForeground(foregroundCtx);
  render(performance.now(), 1);
}

function render(time, delta) {
  motionCtx.clearRect(0, 0, width, height);
  drawCometParticles(motionCtx, time, delta);
}

function animate(time) {
  if (document.hidden || !heroVisible || reducedMotion.matches) {
    animationFrame = 0;
    return;
  }
  const frameInterval = width < 720 ? 33 : 28;
  if (time - lastFrame > frameInterval) {
    const delta = Math.min(2, Math.max(.5, (time - lastFrame) / 32));
    render(time, delta);
    lastFrame = time;
    pointer.speed *= .8;
  }
  animationFrame = requestAnimationFrame(animate);
}

function startAnimation() {
  if (animationFrame || document.hidden || !heroVisible || reducedMotion.matches) return;
  lastFrame = 0;
  animationFrame = requestAnimationFrame(animate);
}

function stopAnimation() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
}

function movePointer(clientX, clientY) {
  const bounds = hero.getBoundingClientRect();
  pointer.x = clientX - bounds.left;
  pointer.y = clientY - bounds.top;
  pointer.speed = Math.hypot(pointer.x - pointer.lastX, pointer.y - pointer.lastY);
  pointer.lastX = pointer.x;
  pointer.lastY = pointer.y;
  pointer.active = pointer.x >= 0 && pointer.x <= width && pointer.y >= 0 && pointer.y <= height;
}

function nearbyMote() {
  if (!pointer.active) return null;
  let closest = null;
  let closestDistance = 26;
  for (const mote of motes) {
    const distance = Math.hypot(mote.x - pointer.x, mote.y - pointer.y);
    if (distance < closestDistance) {
      closest = mote;
      closestDistance = distance;
    }
  }
  return closest;
}

hero.addEventListener('pointermove', event => {
  movePointer(event.clientX, event.clientY);
  hero.classList.toggle('mote-hover', Boolean(nearbyMote()) && !draggedMote);
  if (reducedMotion.matches) render(performance.now(), 1);
}, { passive: true });
hero.addEventListener('pointerdown', event => {
  if (event.target.closest('a, button')) return;
  movePointer(event.clientX, event.clientY);
  draggedMote = nearbyMote();
  if (!draggedMote) return;
  hero.setPointerCapture(event.pointerId);
  hero.classList.remove('mote-hover');
  hero.classList.add('mote-dragging');
  event.preventDefault();
});
function releaseMote(event) {
  if (!draggedMote) return;
  if (reducedMotion.matches) {
    draggedMote.offsetX = 0;
    draggedMote.offsetY = 0;
  }
  draggedMote = null;
  hero.classList.remove('mote-dragging');
  if (hero.hasPointerCapture(event.pointerId)) hero.releasePointerCapture(event.pointerId);
  if (reducedMotion.matches) render(performance.now(), 1);
}
hero.addEventListener('pointerup', releaseMote);
hero.addEventListener('pointercancel', releaseMote);
hero.addEventListener('pointerleave', () => {
  if (!draggedMote) pointer.active = false;
  hero.classList.remove('mote-hover');
});
hero.addEventListener('touchmove', event => {
  const touch = event.touches[0];
  if (touch) movePointer(touch.clientX, touch.clientY);
}, { passive: true });
hero.addEventListener('touchend', () => { if (!draggedMote) pointer.active = false; }, { passive: true });
reducedMotion.addEventListener('change', () => {
  resize();
  if (reducedMotion.matches) stopAnimation();
  else startAnimation();
});
window.addEventListener('resize', resize, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopAnimation();
  else startAnimation();
});
const heroObserver = new IntersectionObserver(([entry]) => {
  heroVisible = entry.isIntersecting;
  if (heroVisible) startAnimation();
  else stopAnimation();
}, { threshold: 0 });
heroObserver.observe(hero);

resize();
startAnimation();
