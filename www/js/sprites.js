// Carga hojas de sprites generadas sobre fondo magenta y recorta cada criatura.

export async function loadImage(src) {
  const img = new Image();
  await new Promise((ok, fail) => {
    img.onload = ok;
    img.onerror = () => fail(new Error('No se pudo cargar ' + src));
    img.src = src;
  });
  return img;
}

// Vuelve transparente el fondo magenta de la hoja.
// smart: solo borra el magenta conectado con el borde (más el magenta puro encerrado en huecos),
// para no comerse los morados que haya dentro de los dibujos.
export function keyOut(img, smart = false) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const p = d.data, W = c.width, H = c.height;
  const loose = i => { const r = p[i], g = p[i + 1], b = p[i + 2], m = Math.min(r, b); return m > 110 && g < m * 0.45 && Math.abs(r - b) < 60; };
  const pure = i => p[i] > 205 && p[i + 2] > 205 && p[i + 1] < 70;
  if (!smart) {
    for (let i = 0; i < p.length; i += 4) if (loose(i)) p[i + 3] = 0;
  } else {
    const seen = new Uint8Array(W * H), stack = [];
    const push = k => { if (!seen[k] && loose(k * 4)) { seen[k] = 1; stack.push(k); } };
    for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
    while (stack.length) {
      const k = stack.pop(), x = k % W;
      p[k * 4 + 3] = 0;
      if (x > 0) push(k - 1);
      if (x < W - 1) push(k + 1);
      if (k >= W) push(k - W);
      if (k < W * (H - 1)) push(k + W);
    }
    for (let i = 0; i < p.length; i += 4) if (pure(i)) p[i + 3] = 0;
    if (smart === 'glow') {
      // Brillos: los bordes suaves quedaron mezclados con el magenta del fondo (se ven rosados).
      // Se deshace la mezcla: pasan a ser blanco semitransparente.
      for (let i = 0; i < p.length; i += 4) {
        const r = p[i], g = p[i + 1], b = p[i + 2], m = Math.min(r, b);
        if (p[i + 3] && m > 140 && Math.abs(r - b) < 30 && g < m - 30) { p[i + 3] = Math.round((255 * g) / m); p[i] = p[i + 1] = p[i + 2] = 255; }
      }
    }
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

// Limpia a fondo el tinte magenta de un brillo ya recortado (para destellos blancos o dorados).
export function despill(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2], m = Math.min(r, b);
    if (!p[i + 3] || b <= g + 25 || m <= g) continue;      // solo lo que tira a rosa o morado
    p[i + 3] = Math.round((p[i + 3] * g) / m);               // cuanto más magenta, más transparente
    p[i] = Math.max(r, 255 - (255 - r) * 0.4); p[i + 1] = Math.max(g, 235); p[i + 2] = Math.min(b, 200);
  }
  ctx.putImageData(d, 0, 0);
  return canvas;
}

// Recorta una celda [x, y, ancho, alto] y la ajusta al contorno del dibujo.
export function cut(sheet, [x, y, w, h]) {
  const d = sheet.getContext('2d').getImageData(x, y, w, h).data;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (d[(yy * w + xx) * 4 + 3] > 0) {
        if (xx < x0) x0 = xx;
        if (xx > x1) x1 = xx;
        if (yy < y0) y0 = yy;
        if (yy > y1) y1 = yy;
      }
    }
  }
  const c = document.createElement('canvas');
  c.width = Math.max(1, x1 - x0 + 1);
  c.height = Math.max(1, y1 - y0 + 1);
  c.getContext('2d').drawImage(sheet, x + x0, y + y0, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

// Recorta sola una hoja en rejilla (3×3 por defecto) y devuelve [fila][columna].
// 1) Busca la mancha más grande de cada casilla: esa es la figura.
// 2) Las piezas sueltas (burbujas, humo, halos) se unen a la figura que tengan más cerca.
export function sliceGrid(sheet, rows = 3, cols = 3) {
  const S = 4, W = sheet.width, H = sheet.height;
  const w = Math.ceil(W / S), h = Math.ceil(H / S), N = w * h;
  const px = sheet.getContext('2d').getImageData(0, 0, W, H).data;

  // Máscara reducida (una celda = 4×4 píxeles), engordada una celda.
  const mask = new Uint8Array(N), fat = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (px[(y * W + x) * 4 + 3] > 0) mask[(y >> 2) * w + (x >> 2)] = 1;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) fat[ny * w + nx] = 1;
    }
  }
  const around = (j, fn) => {
    const x = j % w;
    if (x > 0) fn(j - 1);
    if (x < w - 1) fn(j + 1);
    if (j >= w) fn(j - w);
    if (j < N - w) fn(j + w);
  };

  // Manchas conectadas.
  const label = new Int32Array(N);
  const comps = [];
  for (let i = 0; i < N; i++) {
    if (!fat[i] || label[i]) continue;
    const c = { id: comps.length + 1, cells: [i], sx: 0, sy: 0 };
    label[i] = c.id;
    for (let k = 0; k < c.cells.length; k++) {
      const j = c.cells[k];
      c.sx += j % w; c.sy += Math.floor(j / w);
      around(j, n => { if (fat[n] && !label[n]) { label[n] = c.id; c.cells.push(n); } });
    }
    c.cx = c.sx / c.cells.length; c.cy = c.sy / c.cells.length;
    comps.push(c);
  }

  // Figura principal de cada casilla: la mancha más grande cuyo centro cae dentro.
  const owner = new Int32Array(comps.length + 1).fill(-1);
  const main = new Array(rows * cols).fill(null);
  for (const c of comps) {
    const g = Math.min(rows - 1, Math.floor(c.cy / (h / rows))) * cols + Math.min(cols - 1, Math.floor(c.cx / (w / cols)));
    if (!main[g] || c.cells.length > main[g].cells.length) main[g] = c;
  }
  main.forEach((c, g) => { if (c) owner[c.id] = g; });

  // Distancia de cada celda a la figura principal más cercana (se expande desde todas a la vez).
  const dist = new Int32Array(N).fill(-1), near = new Int32Array(N).fill(-1);
  const queue = [];
  main.forEach((c, g) => { if (c) for (const j of c.cells) { dist[j] = 0; near[j] = g; queue.push(j); } });
  for (let k = 0; k < queue.length; k++) {
    const j = queue[k];
    around(j, n => { if (dist[n] < 0) { dist[n] = dist[j] + 1; near[n] = near[j]; queue.push(n); } });
  }
  for (const c of comps) {
    if (owner[c.id] >= 0) continue;
    let best = c.cells[0];
    for (const j of c.cells) if (dist[j] < dist[best]) best = j;
    if (dist[best] <= 40) owner[c.id] = near[best];
  }

  // Caja ajustada y copia de píxeles de cada figura.
  const box = main.map(() => ({ x0: W, y0: H, x1: -1, y1: -1 }));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (px[(y * W + x) * 4 + 3] === 0) continue;
    const g = owner[label[(y >> 2) * w + (x >> 2)]];
    if (g < 0) continue;
    const b = box[g];
    if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
  }
  const grid = [];
  for (let r = 0; r < rows; r++) {
    grid.push([]);
    for (let col = 0; col < cols; col++) {
      const g = r * cols + col, b = box[g];
      const sw = Math.max(1, b.x1 - b.x0 + 1), sh = Math.max(1, b.y1 - b.y0 + 1);
      const c = document.createElement('canvas');
      c.width = sw; c.height = sh;
      if (b.x1 >= 0) {
        const ctx = c.getContext('2d'), out = ctx.createImageData(sw, sh);
        for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
          const sx = b.x0 + x, sy = b.y0 + y, i = (sy * W + sx) * 4;
          if (px[i + 3] === 0 || owner[label[(sy >> 2) * w + (sx >> 2)]] !== g) continue;
          out.data.set([px[i], px[i + 1], px[i + 2], px[i + 3]], (y * sw + x) * 4);
        }
        ctx.putImageData(out, 0, 0);
      }
      grid[r].push(c);
    }
  }
  return grid;
}

// Ajusta un lienzo a su tamaño en pantalla (nítido en pantallas de alta densidad).
export function fit(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const r = canvas.getBoundingClientRect();
  const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: r.width, h: r.height, dpr };
}

// Carga una hoja en rejilla y devuelve sus figuras como [fila][columna].
export async function loadGrid(url, rows, cols, smart = false) {
  return sliceGrid(keyOut(await loadImage(url), smart), rows, cols);
}

// Carga todas las hojas de criaturas y devuelve sprites[hoja][fila][etapa].
export async function loadSprites(urls) {
  const imgs = await Promise.all(urls.map(loadImage));
  return imgs.map(img => sliceGrid(keyOut(img)));
}

// Versión reducida de un sprite (se guarda para no recalcularla en cada fotograma).
const cache = new WeakMap();
export function scaled(sprite, height) {
  const h = Math.max(8, Math.round(height));
  if (h >= sprite.height) return sprite;
  let sizes = cache.get(sprite);
  if (!sizes) cache.set(sprite, sizes = new Map());
  let c = sizes.get(h);
  if (!c) {
    c = document.createElement('canvas');
    c.height = h;
    c.width = Math.max(1, Math.round(sprite.width * h / sprite.height));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sprite, 0, 0, c.width, c.height);
    sizes.set(h, c);
  }
  return c;
}
