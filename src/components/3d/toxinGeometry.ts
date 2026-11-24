/**
 * toxinGeometry.ts — Geometrías de las toxinas del Arcade y del Laberinto con forma reconocible:
 * cigarrillo (tabaco), botellín (alcohol), lata de refresco (azúcar) y móvil (insomnio).
 *
 * Cada una es UNA geometría con colores por vértice, para dibujar decenas de toxinas en una
 * sola llamada (InstancedMesh) con un MeshBasicMaterial({ vertexColors: true }).
 * Los colores pueden pasar de 1: el bloom del Arcade los hace brillar (la brasa, la pantalla).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type RGB = [number, number, number];

/** Pinta una geometría de un color y la deja sin índice, lista para unir */
function paint(geo: THREE.BufferGeometry, c: RGB, transform?: THREE.Matrix4): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  if (transform) g.applyMatrix4(transform);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set(c, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const at = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));

const lathe = (pts: [number, number][], segs = 16) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);

/** Termina la geometría: tumbada hacia la cámara, centrada y escalada a `size` de largo */
function finish(parts: THREE.BufferGeometry[], size: number, tilt: number, thickness = 1): THREE.BufferGeometry {
  const g = mergeGeometries(parts)!;
  g.computeBoundingBox();
  const b = g.boundingBox!;
  g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2);
  const len = b.max.y - b.min.y;
  g.scale(size / len, size / len, size / len);
  if (thickness !== 1) g.scale(thickness, 1, thickness); // más grueso: se ve mejor desde lejos
  g.rotateX(tilt);
  g.computeVertexNormals();
  return g;
}

/** Cigarrillo: papel, boquilla de corcho, ceniza y brasa brillante. Eje a lo largo de Y. */
export function cigaretteGeometry(size: number, tilt = -Math.PI / 2, thickness = 1.8): THREE.BufferGeometry {
  const r = 0.09;
  return finish(
    [
      paint(new THREE.CylinderGeometry(r, r, 0.75, 12), [1.15, 1.12, 1.05], at(0, 0.12, 0)),
      paint(new THREE.CylinderGeometry(r, r, 0.27, 12), [1.4, 0.7, 0.25], at(0, -0.39, 0)),
      paint(new THREE.CylinderGeometry(r * 0.96, r, 0.06, 12), [0.55, 0.55, 0.55], at(0, 0.52, 0)),
      paint(new THREE.SphereGeometry(r * 0.95, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), [3.2, 0.9, 0.2], at(0, 0.55, 0)),
    ],
    size,
    tilt,
    thickness,
  );
}

/** Botellín de cerveza: vidrio marrón, etiqueta crema, cuello y chapa dorados */
export function beerBottleGeometry(size: number, tilt = -1.15): THREE.BufferGeometry {
  return finish(
    [
      paint(lathe([[0, 0], [0.24, 0], [0.245, 0.06], [0.245, 0.56], [0.19, 0.72], [0.12, 0.82], [0.088, 0.9], [0.082, 1.1], [0.092, 1.16], [0, 1.16]]), [0.32, 0.12, 0.03]),
      paint(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 16, 1, true), [1.35, 1.2, 0.85], at(0, 0.32, 0)),
      paint(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 16, 1, true), [1.4, 0.25, 0.2], at(0, 0.45, 0)),
      paint(new THREE.CylinderGeometry(0.094, 0.11, 0.14, 12, 1, true), [1.6, 1.25, 0.45], at(0, 1.03, 0)),
      paint(new THREE.CylinderGeometry(0.1, 0.104, 0.05, 12), [1.8, 1.45, 0.5], at(0, 1.18, 0)),
    ],
    size,
    tilt,
  );
}

/** Lata de refresco: cuerpo rojo, franja blanca, tapa de aluminio con anilla */
export function sodaCanGeometry(size: number, tilt = -0.9): THREE.BufferGeometry {
  return finish(
    [
      paint(new THREE.CylinderGeometry(0.26, 0.26, 0.76, 16, 1, true), [1.25, 0.05, 0.06], at(0, 0.48, 0)),
      paint(new THREE.CylinderGeometry(0.263, 0.263, 0.1, 16, 1, true), [1.6, 1.6, 1.6], at(0, 0.5, 0)),
      paint(lathe([[0, 0.02], [0.2, 0], [0.26, 0.06], [0.26, 0.1]]), [1.1, 1.12, 1.15]),
      paint(lathe([[0.26, 0.86], [0.215, 0.96], [0.215, 0.99], [0, 0.99]]), [1.15, 1.18, 1.2]),
      paint(new THREE.TorusGeometry(0.06, 0.018, 6, 12), [1.3, 1.3, 1.35], at(0, 1.0, 0.04, Math.PI / 2)),
      paint(new THREE.SphereGeometry(0.09, 10, 8), [1.9, 1.55, 0.3], at(0, 0.66, 0.24)), // sello de azúcar
    ],
    size,
    tilt,
  );
}

/** Móvil con la pantalla encendida (insomnio: pantallas a deshoras) */
export function phoneGeometry(size: number, tilt = -1.2): THREE.BufferGeometry {
  return finish(
    [
      paint(new THREE.BoxGeometry(0.52, 1, 0.08), [0.25, 0.27, 0.35]),
      paint(new THREE.BoxGeometry(0.46, 0.86, 0.01), [0.9, 1.3, 2.6], at(0, 0.02, 0.045)),
      paint(new THREE.BoxGeometry(0.16, 0.03, 0.012), [0.1, 0.1, 0.12], at(0, 0.47, 0.046)),
      // notificaciones: tres tarjetas en la pantalla
      paint(new THREE.BoxGeometry(0.38, 0.12, 0.012), [2.4, 2.4, 2.6], at(0, 0.25, 0.05)),
      paint(new THREE.BoxGeometry(0.38, 0.12, 0.012), [2.2, 2.2, 2.4], at(0, 0.08, 0.05)),
      paint(new THREE.BoxGeometry(0.38, 0.12, 0.012), [2.0, 2.0, 2.2], at(0, -0.09, 0.05)),
    ],
    size,
    tilt,
  );
}
