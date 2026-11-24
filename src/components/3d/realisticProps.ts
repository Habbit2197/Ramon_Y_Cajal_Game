/**
 * realisticProps.ts — Objetos del Modo Historia con aspecto real.
 *
 * Cigarrillo, botellín de cerveza, lata de refresco de cola, botella de agua, manzana,
 * nueces y el libro de Cajal. Todo es geometría por procedimiento (perfiles de torno)
 * con texturas dibujadas en canvas: sin archivos externos ni marcas comerciales.
 * Algunos objetos traen `tick` para animarse (humo, brasa, burbujas).
 */
import * as THREE from 'three';

export interface Prop {
  object: THREE.Group;
  /** Animación opcional; se llama en cada fotograma con el tiempo en segundos */
  tick?: (t: number, dt: number) => void;
}

// ── Texturas en canvas (se crean una vez y se reutilizan) ─────────────────
const texCache = new Map<string, THREE.Texture>();
function canvasTexture(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, wrap = false): THREE.Texture {
  const hit = texCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (wrap) t.wrapS = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}

const smokeTexture = () =>
  canvasTexture('smoke', 128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(235,235,240,0.9)');
    g.addColorStop(0.45, 'rgba(200,200,210,0.45)');
    g.addColorStop(1, 'rgba(180,180,190,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });

/** Papel de fumar: blanco con fibras muy suaves */
const paperTexture = () =>
  canvasTexture('paper', 256, 64, (c, w, h) => {
    c.fillStyle = '#f4f2ec';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(0,0,0,0.04)';
    for (let x = 0; x < w; x += 3) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  }, true);

/** Boquilla de corcho: naranja con motas */
const corkTexture = () =>
  canvasTexture('cork', 256, 64, (c, w, h) => {
    c.fillStyle = '#d98b3a';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      c.fillStyle = Math.random() < 0.5 ? 'rgba(255,230,180,0.5)' : 'rgba(120,60,10,0.35)';
      c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    c.fillStyle = '#e8c27a';
    c.fillRect(0, 0, w, 3);
  }, true);

/** Etiqueta del botellín: papel crema, cenefas rojas y texto genérico (sin marca) */
const beerLabelTexture = () =>
  canvasTexture('beer-label', 512, 256, (c, w, h) => {
    c.fillStyle = '#f1e3c0';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#9b1c1c';
    c.fillRect(0, 18, w, 14);
    c.fillRect(0, h - 32, w, 14);
    c.fillStyle = '#c8a24a';
    c.fillRect(0, 36, w, 4);
    c.fillRect(0, h - 40, w, 4);
    c.fillStyle = '#3a2410';
    c.textAlign = 'center';
    c.font = 'bold 64px Georgia, serif';
    c.fillText('CERVEZA', w / 2, h / 2 + 10);
    c.font = '26px Georgia, serif';
    c.fillText('Alcohol 5 % vol.', w / 2, h / 2 + 52);
    // espiga de cebada
    c.strokeStyle = '#8a6a2a';
    c.lineWidth = 3;
    for (const x of [70, w - 70]) {
      c.beginPath(); c.moveTo(x, h - 60); c.lineTo(x, 70); c.stroke();
      for (let k = 0; k < 6; k++) {
        c.beginPath(); c.ellipse(x - 9, 90 + k * 18, 6, 10, -0.5, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.ellipse(x + 9, 90 + k * 18, 6, 10, 0.5, 0, Math.PI * 2); c.stroke();
      }
    }
  }, true);

/** Lata de refresco de cola genérica: rojo, burbujas y el azúcar bien visible */
const sodaTexture = () =>
  canvasTexture('soda', 1024, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#b3121b');
    g.addColorStop(0.5, '#d61f26');
    g.addColorStop(1, '#a10f17');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // burbujas
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 3 + Math.random() * 12;
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = 2;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
    }
    // dos caras iguales: texto en el centro de cada mitad y el sello del azúcar entre ellas
    c.textAlign = 'center';
    for (const x of [w * 0.25, w * 0.75]) {
      c.fillStyle = '#ffffff';
      c.font = '900 72px Arial Black, Arial, sans-serif';
      c.fillText('REFRESCO', x, h * 0.48);
      c.font = 'bold 44px Arial, sans-serif';
      c.fillText('DE COLA', x, h * 0.6);
    }
    for (const x of [w * 0.5, 0, w]) {
      c.fillStyle = '#ffd23f';
      c.beginPath(); c.arc(x, h * 0.3, 54, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#5b1300';
      c.font = 'bold 34px Arial, sans-serif';
      c.fillText('35 g', x, h * 0.3 + 2);
      c.font = 'bold 18px Arial, sans-serif';
      c.fillText('AZÚCAR', x, h * 0.3 + 26);
    }
  }, true);
/** Mitad de cada cara mirando de frente (la costura del cilindro queda detrás) */
const frontFacing = (t: THREE.Texture, offset: number) => {
  const c = t.clone();
  c.offset.x = offset;
  c.needsUpdate = true;
  return c;
};

const waterLabelTexture = () =>
  canvasTexture('water-label', 512, 128, (c, w, h) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#2f80c9';
    c.beginPath();
    c.moveTo(0, h); c.lineTo(80, 50); c.lineTo(140, 90); c.lineTo(210, 30); c.lineTo(300, h); c.closePath();
    c.fill();
    c.fillStyle = '#9fd3f5';
    c.beginPath(); c.moveTo(200, h); c.lineTo(300, 60); c.lineTo(380, 100); c.lineTo(440, 55); c.lineTo(w, h); c.closePath(); c.fill();
    c.fillStyle = '#123e66';
    c.font = 'bold 54px Arial, sans-serif';
    c.textAlign = 'center';
    c.fillText('AGUA', w / 2, 50);
    c.font = '20px Arial, sans-serif';
    c.fillText('mineral natural', w / 2, 74);
  }, true);

const appleTexture = () =>
  canvasTexture('apple', 256, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#c9d86a');
    g.addColorStop(0.25, '#d9442e');
    g.addColorStop(0.7, '#b51f1f');
    g.addColorStop(1, '#8e1717');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // vetas verticales típicas de la piel
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * w;
      c.strokeStyle = Math.random() < 0.6 ? 'rgba(255,210,120,0.12)' : 'rgba(90,10,10,0.14)';
      c.lineWidth = 1 + Math.random() * 2;
      c.beginPath(); c.moveTo(x, h * (0.1 + Math.random() * 0.3)); c.lineTo(x + (Math.random() - 0.5) * 6, h * (0.5 + Math.random() * 0.5)); c.stroke();
    }
    for (let i = 0; i < 160; i++) {
      c.fillStyle = 'rgba(255,240,200,0.35)';
      c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
  }, true);

const bookCoverTexture = () =>
  canvasTexture('book', 512, 640, (c, w, h) => {
    c.fillStyle = '#6b2a1a';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d4a94a';
    c.lineWidth = 8;
    c.strokeRect(28, 28, w - 56, h - 56);
    c.lineWidth = 2;
    c.strokeRect(44, 44, w - 88, h - 88);
    c.fillStyle = '#e9c46a';
    c.textAlign = 'center';
    c.font = 'bold 46px Georgia, serif';
    c.fillText('TEXTURA', w / 2, 170);
    c.font = 'italic 30px Georgia, serif';
    c.fillText('del sistema nervioso', w / 2, 220);
    c.fillText('del hombre', w / 2, 258);
    c.font = '26px Georgia, serif';
    c.fillText('S. Ramón y Cajal', w / 2, h - 120);
    // neurona dorada
    c.strokeStyle = '#e9c46a';
    c.lineWidth = 3;
    const cx = w / 2, cy = 380;
    c.beginPath(); c.moveTo(cx, cy - 10); c.lineTo(cx - 12, cy + 12); c.lineTo(cx + 12, cy + 12); c.closePath(); c.fillStyle = '#e9c46a'; c.fill();
    for (const [dx, dy] of [[0, -70], [-50, -40], [50, -45], [-40, 40], [45, 45]]) { c.beginPath(); c.moveTo(cx, cy); c.quadraticCurveTo(cx + dx * 0.4, cy + dy * 0.7, cx + dx, cy + dy); c.stroke(); }
  });

/** Torno a partir de pares (radio, altura) */
const lathe = (pts: [number, number][], segs = 40) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);

// ── Toxinas ───────────────────────────────────────────────────────────────

/** Cigarrillo encendido con brasa que late y humo que sube */
export function buildCigarette(): Prop {
  const g = new THREE.Group();
  const cig = new THREE.Group();
  const R = 0.085;
  const paper = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.86, 24, 1, true), new THREE.MeshStandardMaterial({ map: paperTexture(), roughness: 0.85 }));
  paper.position.y = 0.13;
  const filter = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.3, 24), new THREE.MeshStandardMaterial({ map: corkTexture(), roughness: 0.7 }));
  filter.position.y = -0.45;
  const ash = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.96, R, 0.08, 24), new THREE.MeshStandardMaterial({ color: 0x8b8b88, roughness: 1 }));
  ash.position.y = 0.6;
  const emberMat = new THREE.MeshStandardMaterial({ color: 0x3a0d00, emissive: 0xff4a10, emissiveIntensity: 2, roughness: 0.6 });
  const ember = new THREE.Mesh(new THREE.SphereGeometry(R * 0.95, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), emberMat);
  ember.position.y = 0.64;
  ember.scale.y = 0.6;
  cig.add(paper, filter, ash, ember);
  cig.rotation.z = -1.05; // casi tumbado, con la brasa arriba
  cig.position.y = 0.55;
  g.add(cig);
  g.scale.setScalar(1.5); // en el parque se ve pequeño: algo más grande que en la vida real

  // humo: sprites que nacen en la brasa, suben, crecen y se desvanecen
  const smokeMat = () => new THREE.SpriteMaterial({ map: smokeTexture(), transparent: true, depthWrite: false, opacity: 0 });
  const puffs = Array.from({ length: 7 }, (_, i) => {
    const s = new THREE.Sprite(smokeMat());
    g.add(s);
    return { s, phase: i / 7 };
  });
  const tip = new THREE.Vector3();
  return {
    object: g,
    tick: (t) => {
      emberMat.emissiveIntensity = 1.6 + Math.sin(t * 5) * 0.5 + Math.sin(t * 13) * 0.2;
      ember.getWorldPosition(tip);
      g.worldToLocal(tip);
      for (const p of puffs) {
        const k = (t * 0.45 + p.phase) % 1;
        p.s.position.set(tip.x + Math.sin(t * 1.3 + p.phase * 9) * 0.18 * k, tip.y + 0.1 + k * 1.3, tip.z + Math.cos(t + p.phase * 7) * 0.12 * k);
        const sc = 0.18 + k * 0.7;
        p.s.scale.set(sc, sc, 1);
        (p.s.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.55;
      }
    },
  };
}

/** Botellín de cerveza de vidrio marrón con etiqueta y chapa */
export function buildBeerBottle(): Prop {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x5a2a08, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.93, specularIntensity: 1 });
  const body = new THREE.Mesh(
    lathe([[0, 0], [0.2, 0], [0.235, 0.02], [0.245, 0.06], [0.245, 0.56], [0.235, 0.62], [0.19, 0.72], [0.12, 0.82], [0.088, 0.9], [0.082, 1.1], [0.092, 1.12], [0.092, 1.16], [0.07, 1.17], [0, 1.17]]),
    glass,
  );
  // cerveza dentro (se ve a través del cristal)
  const beer = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.62, 28), new THREE.MeshStandardMaterial({ color: 0xd08a12, emissive: 0x6a3a00, emissiveIntensity: 0.3, roughness: 0.3, transparent: true, opacity: 0.55 }));
  beer.position.y = 0.34;
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.249, 0.249, 0.3, 40, 1, true), new THREE.MeshStandardMaterial({ map: frontFacing(beerLabelTexture(), 0.5), roughness: 0.75 }));
  label.position.y = 0.32;
  const foil = new THREE.Mesh(new THREE.CylinderGeometry(0.094, 0.11, 0.14, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xc8a24a, metalness: 0.9, roughness: 0.3 }));
  foil.position.y = 1.05;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.104, 0.05, 21), new THREE.MeshStandardMaterial({ color: 0xd9b54a, metalness: 0.95, roughness: 0.25 }));
  cap.position.y = 1.19;
  g.add(beer, body, label, foil, cap);
  g.scale.setScalar(1.3);
  return { object: g };
}

/** Lata de refresco de cola genérica, con anilla */
export function buildSodaCan(): Prop {
  const g = new THREE.Group();
  const alu = new THREE.MeshStandardMaterial({ color: 0xd7dade, metalness: 0.95, roughness: 0.22 });
  const shell = new THREE.Mesh(
    lathe([[0, 0.02], [0.17, 0], [0.22, 0.02], [0.255, 0.07], [0.26, 0.1], [0.26, 0.86], [0.24, 0.93], [0.215, 0.965], [0.215, 0.99], [0.2, 0.995], [0.19, 0.975], [0, 0.975]]),
    alu,
  );
  const painted = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2615, 0.2615, 0.74, 48, 1, true),
    new THREE.MeshStandardMaterial({ map: frontFacing(sodaTexture(), 0.25), metalness: 0.55, roughness: 0.28 }),
  );
  painted.position.y = 0.48;
  const tab = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 20), alu);
  tab.rotation.x = Math.PI / 2;
  tab.scale.set(1, 1.6, 1);
  tab.position.set(0, 0.985, 0.05);
  const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 10), alu);
  rivet.position.set(0, 0.985, 0);
  const opening = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 }));
  opening.rotation.x = -Math.PI / 2;
  opening.position.set(0, 0.977, -0.1);
  g.add(shell, painted, tab, rivet, opening);
  g.scale.setScalar(1.3);
  return { object: g };
}

// ── Hábitos sanos ─────────────────────────────────────────────────────────

/** Botella de agua de plástico transparente con tapón azul */
export function buildWaterBottle(): Prop {
  const g = new THREE.Group();
  const pts: [number, number][] = [[0, 0], [0.19, 0], [0.215, 0.03]];
  // anillos del plástico
  for (let i = 0; i < 7; i++) {
    const y = 0.08 + i * 0.09;
    pts.push([0.22, y], [0.205, y + 0.045]);
  }
  pts.push([0.22, 0.72], [0.18, 0.82], [0.1, 0.92], [0.075, 0.98], [0.075, 1.02], [0, 1.02]);
  const plastic = new THREE.MeshPhysicalMaterial({ color: 0xcfeeff, roughness: 0.05, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false });
  const bottle = new THREE.Mesh(lathe(pts, 36), plastic);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.195, 0.7, 28), new THREE.MeshStandardMaterial({ color: 0x3f9fe0, emissive: 0x0f5d94, emissiveIntensity: 0.35, transparent: true, opacity: 0.8, roughness: 0.1 }));
  water.position.y = 0.38;
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.218, 0.218, 0.2, 36, 1, true), new THREE.MeshStandardMaterial({ map: waterLabelTexture(), roughness: 0.6 }));
  label.position.y = 0.45;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.09, 24), new THREE.MeshStandardMaterial({ color: 0x1e6fd9, roughness: 0.45 }));
  cap.position.y = 1.06;
  g.add(water, label, bottle, cap);
  g.scale.setScalar(1.15);
  return { object: g };
}

/** Manzana roja con rabito y hoja */
export function buildApple(): Prop {
  const g = new THREE.Group();
  const prof: [number, number][] = [[0, 0.06], [0.1, 0.02], [0.22, 0.03], [0.33, 0.12], [0.39, 0.27], [0.4, 0.42], [0.36, 0.56], [0.26, 0.65], [0.13, 0.66], [0.05, 0.6], [0, 0.57]];
  const apple = new THREE.Mesh(lathe(prof, 48), new THREE.MeshPhysicalMaterial({ map: appleTexture(), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
  const stemCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.57, 0), new THREE.Vector3(0.02, 0.72, 0), new THREE.Vector3(0.07, 0.8, 0.01));
  const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 8, 0.018, 6), new THREE.MeshStandardMaterial({ color: 0x5a3b1e, roughness: 0.9 }));
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.09, 0.06, 0.2, 0);
  leafShape.quadraticCurveTo(0.09, -0.06, 0, 0);
  const leaf = new THREE.Mesh(new THREE.ShapeGeometry(leafShape, 8), new THREE.MeshStandardMaterial({ color: 0x3f9b3a, roughness: 0.5, side: THREE.DoubleSide }));
  leaf.position.set(0.05, 0.74, 0);
  leaf.rotation.set(0.4, 0.3, 0.5);
  g.add(apple, stem, leaf);
  g.position.y = 0.3;
  g.scale.setScalar(1.25);
  return { object: g };
}

/** Dos nueces con la cáscara arrugada */
export function buildWalnuts(): Prop {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.22, 40, 30);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    // arrugas + la costura central de la cáscara
    const wr = Math.sin(n.x * 18 + Math.sin(n.y * 9) * 2) * Math.sin(n.y * 16 + n.z * 7) * 0.018;
    const seam = Math.exp(-Math.pow(n.z * 9, 2)) * 0.03;
    v.addScaledVector(n, wr + seam);
    v.y *= 1.12;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0xb98a55, roughness: 0.85 });
  const a = new THREE.Mesh(geo, mat);
  a.position.set(-0.17, 0.62, 0);
  a.rotation.set(0.3, 0, 0.2);
  const b = new THREE.Mesh(geo, mat);
  b.position.set(0.18, 0.55, 0.08);
  b.rotation.set(-0.2, 1.2, -0.3);
  g.add(a, b);
  g.scale.setScalar(1.3);
  return { object: g };
}

/** El libro de Cajal, con su título en la portada */
export function buildBook(): Prop {
  const g = new THREE.Group();
  const cover = new THREE.MeshStandardMaterial({ color: 0x6b2a1a, roughness: 0.6 });
  const front = new THREE.MeshStandardMaterial({ map: bookCoverTexture(), roughness: 0.55, emissive: 0x2a0d05, emissiveIntensity: 0.4 });
  const pagesMat = new THREE.MeshStandardMaterial({ color: 0xf3e6c4, roughness: 0.9 });
  // caja: +x, -x, +y (portada), -y, +z, -z
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 0.78), [pagesMat, cover, front, cover, pagesMat, pagesMat]);
  book.position.y = 0.72;
  book.rotation.set(1.1, 0.25, 0);
  g.add(book);
  return { object: g };
}
