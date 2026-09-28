// Apollonian Gasket Live - real-time Descartes Circle Theorem solver
// with infinite zoom, panning, rotation, color palettes
// Public viewer at /, admin panel at /?admin=1

// =============================================================================
// PALETTES
// =============================================================================
const PALETTES = {
  classic: ['#ff2d6d', '#ff8a3d', '#ffd93d', '#3dff8a', '#3dffe8', '#8a3dff', '#ff3d8a'],
  neon:    ['#ff006e', '#fb5607', '#ffbe0b', '#8338ec', '#3a86ff', '#06ffa5'],
  cosmic:  ['#ff0844', '#ff5e5e', '#ffae00', '#7c00ff', '#00d4ff', '#00ff9c'],
  ocean:   ['#001f3f', '#0074d9', '#39cccc', '#7fdbff', '#01ff70', '#ffdc00'],
  fire:    ['#ff0000', '#ff4500', '#ff8c00', '#ffae00', '#ffdc00', '#ffff00'],
  ice:     ['#00ffff', '#80deea', '#b2ebf2', '#e0f7fa', '#ce93d8', '#7e57c2'],
  sunset:  ['#ff006e', '#ff4500', '#ff8c00', '#ffd700', '#ff1493', '#c71585'],
  matrix:  ['#39ff14', '#00ff7f', '#00fa9a', '#98fb98', '#7cfc00', '#adff2f'],
};

// =============================================================================
// STATE
// =============================================================================
const state = {
  depth: 10,
  zoomSpeed: 0.06,
  panSpeed: 0.10,
  rotSpeed: 0.08,
  stroke: 0.012,
  fill: 0.18,
  glow: 1.4,
  palette: 'classic',
  bg1: '#1a0010',
  bg2: '#0a0008',
  bgMix: 0.30,
};

const SYNC_KEY = new URLSearchParams(location.search).get('stream') || 'default';
const IS_ADMIN = new URLSearchParams(location.search).has('admin');

// Apply admin mode
if (IS_ADMIN) document.body.classList.add('admin');

// =============================================================================
// CANVAS SETUP
// =============================================================================
const canvas = document.getElementById('gl');
const ctx = canvas.getContext('2d');
let W = 0, H = 0;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.width = window.innerWidth * dpr;
  H = canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.scale(dpr, dpr);
}
resize();
window.addEventListener('resize', resize);

// =============================================================================
// APOLLONIAN GASKET - Descartes Circle Theorem
// =============================================================================
//
// Given three mutually tangent circles with complex curvatures (curvature = 1/radius,
// signed), the fourth tangent circle has curvature:
//
//   z4 = z1 + z2 + z3 ± 2 * sqrt(z1*z2 + z2*z3 + z3*z1)
//
// where z = (curvature as real, center as imaginary). The two roots are
// the inner+outer solutions; we take the smaller one (the circle that fits
// in the gap, not the one that encloses the three).

function solveApollonian(c1, c2, c3, outer) {
  // c1, c2, c3: {z: complex} where Re(z)=curvature, Im(z)=center.x, and center.y is implicit
  // Actually we use full complex: z = k + i*x_center where center.y is separate
  // For Descartes: z1*z2 + z2*z3 + z3*z1 is complex multiplication
  // The result is also z = k + i*x_center. The y-center must be solved separately.

  // Using standard Descartes in 2D: complex form
  const sum = c1 + c2 + c3;
  const prod = c1 * c2 + c2 * c3 + c3 * c1;
  const disc = sum * sum - 2 * (c1 * c1 + c2 * c2 + c3 * c3);
  // sqrt of complex
  const sqrt_disc = complexSqrt(disc);
  return [
    { k: (sum + sqrt_disc).k, x: ((sum + sqrt_disc).k === 0 ? 0 : ((sum + sqrt_disc).x / (sum + sqrt_disc).k)), y: 0 },  // dummy
    sum - sqrt_disc,
  ];
}

function complexAdd(a, b) { return { k: a.k + b.k, x: a.x + b.x, y: (a.y || 0) + (b.y || 0) }; }
function complexMul(a, b) { return { k: a.k * b.k - a.x * b.x, x: a.k * b.x + a.k * b.x, y: 0 }; }
function complexSqrt(c) {
  // sqrt of complex number k + ix
  const r = Math.sqrt(c.k * c.k + c.x * c.x);
  const re = Math.sqrt((r + c.k) / 2);
  const im = Math.sign(c.x) * Math.sqrt((r - c.k) / 2);
  return { k: re, x: im, y: 0 };
}

// Simpler 2D Descartes: solve for k, then solve for center from one tangent condition
function apollonianStep(c1, c2, c3) {
  // c1, c2, c3: {k: number, x: number, y: number}
  // Returns new circle {k, x, y}
  const k1 = c1.k, k2 = c2.k, k3 = c3.k;
  // Descartes: (k1+k2+k3+k4)^2 = 2(k1^2+k2^2+k3^2+k4^2)
  // Solve quadratic for k4:
  // k4^2 - k4*(k1+k2+k3) + ((k1+k2+k3)^2 - (k1^2+k2^2+k3^2)) = 0
  // k4 = [k1+k2+k3 ± sqrt((k1+k2+k3)^2 - 2*(k1^2+k2^2+k3^2))] / 2... wait
  // Actually simpler: k4 = k1 + k2 + k3 ± 2*sqrt(k1*k2 + k2*k3 + k3*k1)
  const inside = k1 * k2 + k2 * k3 + k3 * k1;
  if (inside < 0) return null; // No valid 4th circle
  const sqrt_inside = Math.sqrt(inside);
  const k4_a = k1 + k2 + k3 + 2 * sqrt_inside;
  const k4_b = k1 + k2 + k3 - 2 * sqrt_inside;
  // k4_b is the smaller (inner circle that fits the gap)
  const k4 = k4_b;
  if (k4 <= 0) return null;

  // Now find the center. Use one tangency condition:
  // |P - c1| = 1/k1 + 1/k4 (if same side) or |1/k1 - 1/k4| (opposite sides)
  // For three mutually tangent (all internal), the new circle touches all three externally.
  // Distance between centers = r1 + r4 = 1/k1 + 1/k4 (since both positive curvatures)
  // Wait actually for fully internal packing, the new circle's curvature is positive
  // and it's tangent to each from inside, so:
  // d_new_c1 = 1/k1 + 1/k4 (or |1/k1 - 1/k4| if on opposite sides)

  // Need to find (x, y) such that distance to each c_i = 1/k_i + 1/k4
  // That's 3 equations, 2 unknowns - overdetermined. Use least squares or just 2.

  // For our purposes, we use the actual Descartes complex form for centers.
  // z_i = k_i + i * center_x_i (assuming y=0 for simplicity)
  // z_4 = k_4 + i * center_x_4
  // z_4 = k_1 + k_2 + k_3 ± 2*sqrt(z_1*z_2 + z_2*z_3 + z_3*z_1)

  const z1 = { k: c1.k, x: c1.x };
  const z2 = { k: c2.k, x: c2.x };
  const z3 = { k: c3.k, x: c3.x };
  const sum = { k: z1.k + z2.k + z3.k, x: z1.x + z2.x + z3.x };
  const prod = {
    k: z1.k * z2.k - z1.x * z2.x + z2.k * z3.k - z2.x * z3.x + z3.k * z1.k - z3.x * z1.x,
    x: z1.k * z2.x + z1.x * z2.k + z2.k * z3.x + z2.x * z3.k + z3.k * z1.x + z3.x * z1.k
  };
  // Actually the complex Descartes formula uses complex multiplication properly:
  // z1*z2 = (k1*k2 - x1*x2) + i*(k1*x2 + x1*k2)
  // For 3 products and a sum...
  // Actually let's just numerically solve with coordinates:
  // Find (x, y) such that |P - c1| = r1+r4, |P - c2| = r2+r4, |P - c3| = r3+r4
  // r_i = 1/k_i

  const r1 = 1 / k1, r2 = 1 / k2, r3 = 1 / k3;
  const r4 = 1 / k4;
  const d14 = r1 + r4;
  const d24 = r2 + r4;
  const d34 = r3 + r4;

  // Solve using first two circles for two solutions, check against third
  // Distance from P=(x,y) to c1=(c1.x, c1.y) is d14
  // (x - c1.x)^2 + (y - c1.y)^2 = d14^2
  // (x - c2.x)^2 + (y - c2.y)^2 = d24^2
  // Subtract: -2*x*c1.x + c1.x^2 - 2*y*c1.y + c1.y^2 - (d14^2)
  //          +2*x*c2.x - c2.x^2 + 2*y*c2.y - c2.y^2 + (d24^2) = 0
  // Simplify: 2*x*(c2.x - c1.x) + 2*y*(c2.y - c1.y) = d14^2 - d24^2 + c2.x^2 - c1.x^2 + c2.y^2 - c1.y^2
  const A = 2 * (c2.x - c1.x);
  const B = 2 * (c2.y - c1.y);
  const C = d14*d14 - d24*d24 + c2.x*c2.x - c1.x*c1.x + c2.y*c2.y - c1.y*c1.y;

  if (Math.abs(A) < 1e-10) {
    // Vertical line - use c1 and c3
    const A2 = 2 * (c3.x - c1.x);
    const B2 = 2 * (c3.y - c1.y);
    const C2 = d14*d14 - d34*d34 + c3.x*c3.x - c1.x*c1.x + c3.y*c3.y - c1.y*c1.y;
    // ... solve A*x + B*y = C; A2*x + B2*y = C2
    const det = A * B2 - A2 * B;
    if (Math.abs(det) < 1e-10) return null;
    const x = (C * B2 - C2 * B) / det;
    const y = (A * C2 - A2 * C) / det;
    return { k: k4, x, y };
  }

  // Use first two circles
  const y = (C - A * c1.x - B * c1.y) / (B + 1e-10);
  // Actually solve: A*x + B*y = C with x from circle 1
  // (x - c1.x)^2 + (y - c1.y)^2 = d14^2
  // x = c1.x + sqrt(d14^2 - (y-c1.y)^2)
  // Plug into A*x + B*y = C
  // (A^2)*d14^2 - (A^2)*(y-c1.y)^2 + ... ugh
  // Cleaner: solve 2-circle intersection algebraically

  // Let dx = c2.x - c1.x, dy = c2.y - c1.y
  // We want (x,y) such that |P-c1| = d14 AND |P-c2| = d24
  // (x-c1.x)^2 + (y-c1.y)^2 = d14^2
  // (x-c2.x)^2 + (y-c2.y)^2 = d24^2
  // Subtract: 2(xc2.x - xc1.x + yc2.y - yc1.y) = d14^2 - d24^2 + c1.x^2 - c2.x^2 + c1.y^2 - c2.y^2
  // 2x(c2.x-c1.x) + 2y(c2.y-c1.y) = d14^2 - d24^2 + c1.x^2 - c2.x^2 + c1.y^2 - c2.y^2
  // 2x*dx + 2y*dy = d14^2 - d24^2 + c1.x^2 - c2.x^2 + c1.y^2 - c2.y^2
  // Let K = d14^2 - d24^2 + c1.x^2 - c2.x^2 + c1.y^2 - c2.y^2
  // x = (K - 2y*dy) / (2*dx)
  // Sub into circle 1:
  // ((K-2y*dy)/(2dx) - c1.x)^2 + (y-c1.y)^2 = d14^2
  // Let mx = (K/(2dx)) - c1.x, my = -(dy/dx), then x = mx + my*y
  // (mx + my*y)^2 + (y-c1.y)^2 = d14^2
  // mx^2 + 2*mx*my*y + my^2*y^2 + y^2 - 2*c1.y*y + c1.y^2 = d14^2
  // (my^2+1)*y^2 + (2*mx*my - 2*c1.y)*y + (mx^2 + c1.y^2 - d14^2) = 0
  const mx = K / (2*dx) - c1.x;
  const my = -dy / dx;
  const A_q = my*my + 1;
  const B_q = 2*mx*my - 2*c1.y;
  const C_q = mx*mx + c1.y*c1.y - d14*d14;
  const disc_y = B_q*B_q - 4*A_q*C_q;
  if (disc_y < 0) return null;
  const sqrt_disc_y = Math.sqrt(disc_y);
  const y1 = (-B_q + sqrt_disc_y) / (2*A_q);
  const y2 = (-B_q - sqrt_disc_y) / (2*A_q);
  const x1 = (K - 2*y1*dy) / (2*dx);
  const x2 = (K - 2*y2*dy) / (2*dx);

  // Pick the one closer to c3 (which is "inside" the gasket)
  const d1_c3 = Math.hypot(x1 - c3.x, y1 - c3.y);
  const d2_c3 = Math.hypot(x2 - c3.x, y2 - c3.y);
  const best = Math.abs(d1_c3 - d34) < Math.abs(d2_c3 - d34);
  return { k: k4, x: best ? x1 : x2, y: best ? y1 : y2 };
}

// =============================================================================
// BUILD GASKET
// =============================================================================
let circles = [];
function seed() {
  // Three mutually tangent circles inside the bounding circle
  // Use classic integer curvatures: -1, 2, 2, 3 (Descartes-kfmn style)
  // Outer = -1 (radius 1, enclosing circle), inner 2, 2, 3 (radii 0.5, 0.5, 1/3)
  // Position them so they all touch each other and the outer
  // For simplicity: 3 inner circles in a row with the outer as unit circle

  // Pick a random seed for variety
  const seed = Math.random() * 1000;
  const rng = mulberry32(seed);

  // Three radii
  const r1 = 0.3 + rng() * 0.4;  // 0.3 to 0.7
  const r2 = 0.3 + rng() * 0.4;
  const r3 = 0.3 + rng() * 0.4;
  // Place inside unit circle. Spread them around center
  // Simplest: three circles in triangular formation inside the outer
  // For tangency: pick positions so each touches the others
  // We use: two on horizontal axis tangent to each other and outer, one on top
  // Place r1 left, r2 right (tangent), r3 top tangent to both
  const bigR = 1;
  // r1 + r2 = distance between left and right circles
  // r1 + bigR = distance from left to right edge of outer (going outward)
  // Place r1 at (-r1_offset, 0), r2 at (r1_offset + r1 + r2 - r1_offset, 0) ... complex
  // Simpler: just place and adjust so they all touch within unit circle

  // Easiest: use a known Apollonian seed: {r=0.5, r=0.5, r=1/3} in unit circle
  // outer r=1 at center (0,0)
  // r1=0.5 at (-0.5, 0), touches left wall AND touches outer at (-0.5, 0) -> (0,0) distance 0.5 = 0.5+r2? no r1+r2
  // Place r1 at (-0.5, 0), touches outer at origin (distance 0.5 = r1=0.5 OK)
  // r2 at (0.5, 0), distance from r1 = 1.0 = r1+r2 = 1 OK, distance from origin = 0.5 = r2=0.5 OK
  // r3 must touch both r1 and r2 and outer.
  // Distance from r1 to r2 = 1.0 = r1+r3 = 0.5+r3, so r3 = 0.5
  // But r1+r2 = 1.0 = 0.5+0.5 ✓
  // r3 must also touch outer (distance = 1.0 from origin)
  // Distance from r1 (-0.5, 0) to outer (centered) - r1 touches at -0.5
  // r3 must be on perpendicular bisector of r1-r2 segment, i.e. x=0
  // Distance from r3 (x=0, y) to r1 (-0.5, 0) = sqrt(0.25 + y^2) = 0.5 + r3 = 1
  // So 0.25 + y^2 = 1, y^2 = 0.75, y = ±sqrt(0.75) = ±0.866
  // But also distance to outer = 1 = r3 + 1 (touches outer from inside), so r3 = 0 (impossible)
  // So this seed doesn't work cleanly. Let me pick something else.

  // Better seed: outer r=1 at origin, r1=0.5 at (-0.25, 0), r2=0.5 at (0.25, 0)
  // r1+r2 = 1 = distance. Both touch outer (dist 0.25 from origin - r1=0.5? no r1=0.5 needs dist 0.5)
  // Hmm.
  // OK let's just generate three random circles with adjustable positions
  // until we find tangencies that satisfy Descartes

  // Use direct Descartes-curvature seed: curvatures k1, k2, k3 with outer k4 (negative)
  // (k1+k2+k3+k4)^2 = 2(k1^2+k2^2+k3^2+k4^2)
  // Choose integer curvatures for simplicity

  // Use classic seed: outer=-1, inner=2,2,3
  const k_outer = -1;
  let k1, k2, k3;
  // Pick two random integer-like curvatures
  k1 = 2 + Math.floor(rng() * 4);  // 2..5
  k2 = 2 + Math.floor(rng() * 4);

  // Solve for k3 given the constraint that the three inner circles are mutually tangent
  // and all are tangent to the outer.
  // From Descartes: (k1+k2+k3+k4)^2 = 2(k1^2+k2^2+k3^2+k4^2)
  // k3 = k1+k2+k4 ± 2*sqrt(k1*k2 + k2*k4 + k4*k1)
  const sum_inner = k1 + k2 + k_outer;
  const inside3 = k1*k2 + k2*k_outer + k_outer*k1;
  if (inside3 < 0) {
    k1 = 2; k2 = 3;
    return seed();
  }
  const sqrt3 = Math.sqrt(inside3);
  const k3a = sum_inner + 2*sqrt3;
  const k3b = sum_inner - 2*sqrt3;
  // k3b is smaller, more inner
  k3 = k3b;
  if (k3 <= 0) {
    k1 = 2; k2 = 3;
    return seed();
  }

  // r_outer = 1 (unit circle, center at origin)
  // r_i = 1/k_i
  const R1 = 1/k1, R2 = 1/k2, R3 = 1/k3, ROUTER = 1/Math.abs(k_outer);

  // Position them so all are tangent to outer and to each other.
  // Place R1 at angle 0: at (ROUTER - R1, 0) = (1 - R1, 0)
  // Place R2 at angle theta: (cos*ROUTER, sin*ROUTER) but adjusted for radius
  // Angle between R1 and R2: from law of cosines in triangle:
  // R1^2 + R2^2 + 2*R1*R2 = (2*ROUTER - R1 - R2)^2? No.
  // Distance between R1 and R2 = R1 + R2
  // Both at distance ROUTER from origin
  // Chord length between two points on circle of radius ROUTER with angle theta:
  // 2*ROUTER*sin(theta/2) = R1 + R2
  // sin(theta/2) = (R1+R2)/(2*ROUTER)

  // Place R1 at angle alpha1
  const alpha1 = rng() * 2 * Math.PI;
  const alpha2 = alpha1 + 2 * Math.asin((R1+R2)/(2*ROUTER));
  const alpha3 = alpha2 + 2 * Math.asin((R2+R3)/(2*ROUTER));

  const c1 = { k: k1, x: ROUTER*Math.cos(alpha1), y: ROUTER*Math.sin(alpha1) };
  const c2 = { k: k2, x: ROUTER*Math.cos(alpha2), y: ROUTER*Math.sin(alpha2) };
  const c3 = { k: k3, x: ROUTER*Math.cos(alpha3), y: ROUTER*Math.sin(alpha3) };
  const outer = { k: k_outer, x: 0, y: 0 };

  circles = [outer, c1, c2, c3];
  expandGasket(state.depth);
}

function expandGasket(maxDepth) {
  // Recursively expand the gasket by replacing each triple with their 4th circle
  // Run a fixed number of expansion rounds
  for (let round = 0; round < maxDepth; round++) {
    const newCircles = [];
    // For each consecutive triple (i, j, k) in current circles, find the 4th
    // Actually we want to find the 4th that fits in each triangular gap
    // For a full Apollonian gasket, every triple of mutually tangent circles has 2 fourths
    // (inner and outer). For our 3-inner setup, the "gaps" are:
    //   gap A: between (outer, c1, c2)
    //   gap B: between (outer, c2, c3)
    //   gap C: between (outer, c3, c1)
    //   gap D: between (c1, c2, c3) -- central
    // Then each new circle creates 3 more gaps with its neighbors, etc.

    // Start with the initial 4: outer, c1, c2, c3
    // Gap D (c1, c2, c3) gives one new circle.
    if (circles.length >= 3) {
      const newCircle = apollonianStep(circles[0], circles[1], circles[2]);
      if (newCircle) newCircles.push(newCircle);
    }
    // After one step, we have 5 circles. For each new gap (n consecutive triples), step again.
    // But simpler: for each existing triple (i,i+1,i+2 mod n), get the 4th.
    const n = circles.length;
    for (let i = 0; i < n; i++) {
      const a = circles[i];
      const b = circles[(i+1) % n];
      const c = circles[(i+2) % n];
      const newC = apollonianStep(a, b, c);
      if (newC) newCircles.push(newC);
    }
    if (newCircles.length === 0) break;
    circles = circles.concat(newCircles);
    if (circles.length > 10000) break; // safety
  }
}

// =============================================================================
// ZOOM TRANSFORM (for "infinite zoom" effect)
// =============================================================================
let zoom = 1;
let zoomDir = 1; // 1 = zoom in, -1 = zoom out
let panX = 0, panY = 0;
let rotation = 0;

function updateTransform(dt) {
  if (state.zoomSpeed > 0) {
    zoom *= Math.pow(2, state.zoomSpeed * zoomDir * dt);
    if (zoom > 1000 || zoom < 0.001) zoomDir *= -1;
  }
  panX += state.panSpeed * Math.cos(rotation) * dt * 0.5;
  panY += state.panSpeed * Math.sin(rotation) * dt * 0.5;
  rotation += state.rotSpeed * dt;
}

// =============================================================================
// RENDER
// =============================================================================
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  updateTransform(dt);

  const w = window.innerWidth, h = window.innerHeight;
  // Background
  const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w,h)*0.7);
  grad.addColorStop(0, state.bg1);
  grad.addColorStop(1, state.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  if (circles.length === 0) {
    seed();
  }

  // Apply zoom transform (relative to center)
  ctx.save();
  ctx.translate(w/2 + panX, h/2 + panY);
  ctx.rotate(rotation);
  ctx.scale(zoom, zoom);
  ctx.translate(-w/2, -h/2);

  // Draw each circle
  const palette = PALETTES[state.palette];
  ctx.lineWidth = state.stroke / zoom;

  for (let i = 0; i < circles.length; i++) {
    const c = circles[i];
    const r = 1 / Math.abs(c.k);
    const color = palette[i % palette.length];

    // Skip circles that are too small to see or outside view
    if (r < 0.5 / zoom) continue;
    if (c.x + r < -100 || c.x - r > w + 100) continue;
    if (c.y + r < -100 || c.y - r > h + 100) continue;

    // Fill
    ctx.fillStyle = hexToRgba(color, state.fill);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI*2);
    ctx.fill();

    // Stroke with glow
    ctx.shadowColor = color;
    ctx.shadowBlur = (state.glow * 8) / zoom;
    ctx.strokeStyle = color;
    ctx.lineWidth = state.stroke / zoom;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI*2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.restore();

  requestAnimationFrame(frame);
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function mulberry32(seed) {
  return function() {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// =============================================================================
// ADMIN PANEL WIRING
// =============================================================================
function setupAdmin() {
  const paletteDiv = document.getElementById('palettes');
  Object.keys(PALETTES).forEach(name => {
    const btn = document.createElement('button');
    btn.style.background = `linear-gradient(90deg, ${PALETTES[name].join(', ')})`;
    btn.title = name;
    if (name === state.palette) btn.classList.add('active');
    btn.onclick = () => {
      state.palette = name;
      document.querySelectorAll('#palettes button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      pushState();
    };
    paletteDiv.appendChild(btn);
  });

  const bindings = [
    ['depth', 'depth', 'vDepth', parseInt],
    ['zoomSpeed', 'zoomSpeed', 'vZoomSpeed', parseFloat],
    ['panSpeed', 'panSpeed', 'vPanSpeed', parseFloat],
    ['rotSpeed', 'rotSpeed', 'vRotSpeed', parseFloat],
    ['stroke', 'stroke', 'vStroke', parseFloat],
    ['fill', 'fill', 'vFill', parseFloat],
    ['glow', 'glow', 'vGlow', parseFloat],
    ['bg1', 'bg1', null, null],
    ['bg2', 'bg2', null, null],
    ['bgMix', 'bgMix', 'vBgMix', parseFloat],
  ];
  for (const [id, key, valId, parser] of bindings) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.value = state[key];
    if (valId) document.getElementById(valId).textContent = String(state[key]);
    el.addEventListener('input', (e) => {
      const v = parser ? parser(e.target.value) : e.target.value;
      state[key] = v;
      if (valId) document.getElementById(valId).textContent = String(v);
      if (key === 'depth') {
        // Reseed and re-expand to new depth
        seed();
      }
      pushState();
    });
  }

  // Seed/reset button
  const resetBtn = document.createElement('button');
  resetBtn.textContent = '↻ Reseed';
  resetBtn.style.cssText = 'width: 100%; padding: 8px; background: rgba(255,77,109,0.2); border: 1px solid rgba(255,77,109,0.4); color: #fff; border-radius: 4px; cursor: pointer; margin-top: 8px;';
  resetBtn.onclick = () => {
    seed();
    pushState();
  };
  document.getElementById('admin').appendChild(resetBtn);
}

// =============================================================================
// STATE SYNC (admin ↔ viewer across browsers)
// =============================================================================
async function pushState() {
  try {
    await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: SYNC_KEY, state }),
    });
  } catch (e) {}
}

async function pullState() {
  try {
    const r = await fetch(`/api/state?key=${encodeURIComponent(SYNC_KEY)}`);
    if (!r.ok) return;
    const data = await r.json();
    if (data && data.state) {
      Object.assign(state, data.state);
      // Update UI if admin
      if (IS_ADMIN) setupAdmin();
    }
  } catch (e) {}
}

// =============================================================================
// INIT
// =============================================================================
seed();
if (IS_ADMIN) setupAdmin();
requestAnimationFrame(frame);

// Pull state every 2s
pullState();
setInterval(pullState, 2000);
