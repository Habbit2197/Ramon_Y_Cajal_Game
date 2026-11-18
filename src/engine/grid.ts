/**
 * grid.ts — Rejilla espacial uniforme con counting sort O(n), cero GC en el hot loop
 */

export class SpatialGrid {
  readonly cols: number;
  readonly rows: number;
  private cellStart: Int32Array;
  private cellCount: Int32Array;
  private items: Int32Array;
  readonly result = new Int32Array(256);
  resultLen = 0;

  constructor(
    private minX: number,
    private minZ: number,
    w: number,
    h: number,
    private cell = 2,
    maxItems = 512
  ) {
    this.cols = Math.ceil(w / cell);
    this.rows = Math.ceil(h / cell);
    this.cellStart = new Int32Array(this.cols * this.rows + 1);
    this.cellCount = new Int32Array(this.cols * this.rows);
    this.items = new Int32Array(maxItems);
  }

  private key(x: number, z: number): number {
    const cx = Math.min(this.cols - 1, Math.max(0, ((x - this.minX) / this.cell) | 0));
    const cz = Math.min(this.rows - 1, Math.max(0, ((z - this.minZ) / this.cell) | 0));
    return cz * this.cols + cx;
  }

  private currentEx: Float32Array = new Float32Array(0);
  private currentEz: Float32Array = new Float32Array(0);

  /**
   * Reconstruye la rejilla con counting sort: O(n), sin asignación de objetos.
   */
  rebuild(ex: Float32Array, ez: Float32Array, n: number) {
    this.currentEx = ex;
    this.currentEz = ez;
    if (this.items.length < n) {
      this.items = new Int32Array(Math.max(n * 2, 512));
    }
    this.cellCount.fill(0);
    for (let i = 0; i < n; i++) {
      this.cellCount[this.key(ex[i], ez[i])]++;
    }

    let acc = 0;
    for (let c = 0; c < this.cellCount.length; c++) {
      this.cellStart[c] = acc;
      acc += this.cellCount[c];
      this.cellCount[c] = 0;
    }
    this.cellStart[this.cellCount.length] = acc;

    for (let i = 0; i < n; i++) {
      const k = this.key(ex[i], ez[i]);
      this.items[this.cellStart[k] + this.cellCount[k]++] = i;
    }
  }

  /**
   * Deja en this.result los índices de las entidades en celdas que tocan el AABB.
   */
  query(x0: number, z0: number, x1: number, z1: number) {
    this.resultLen = 0;
    const a = this.key(Math.min(x0, x1), Math.min(z0, z1));
    const b = this.key(Math.max(x0, x1), Math.max(z0, z1));
    const ax = a % this.cols;
    const az = (a / this.cols) | 0;
    const bx = b % this.cols;
    const bz = (b / this.cols) | 0;

    for (let cz = az; cz <= bz; cz++) {
      for (let cx = ax; cx <= bx; cx++) {
        const c = cz * this.cols + cx;
        const end = this.cellStart[c + 1];
        for (let k = this.cellStart[c]; k < end && this.resultLen < this.result.length; k++) {
          this.result[this.resultLen++] = this.items[k];
        }
      }
    }
  }

  /**
   * Itera sobre entidades en un radio dado sin allocs
   */
  forEachInRadius(
    x: number,
    z: number,
    radius: number,
    fn: (index: number, distSq: number) => void,
    ex: Float32Array = this.currentEx,
    ez: Float32Array = this.currentEz
  ) {
    this.query(x - radius, z - radius, x + radius, z + radius);
    const rSq = radius * radius;
    for (let k = 0; k < this.resultLen; k++) {
      const idx = this.result[k];
      const dx = ex[idx] - x;
      const dz = ez[idx] - z;
      const dSq = dx * dx + dz * dz;
      if (dSq <= rSq) {
        fn(idx, dSq);
      }
    }
  }

  /**
   * Cuenta entidades a menos de un radio dado
   */
  countNear(
    x: number,
    z: number,
    radius: number,
    ex: Float32Array = this.currentEx,
    ez: Float32Array = this.currentEz
  ): number {
    this.query(x - radius, z - radius, x + radius, z + radius);
    const rSq = radius * radius;
    let count = 0;
    for (let k = 0; k < this.resultLen; k++) {
      const idx = this.result[k];
      const dx = ex[idx] - x;
      const dz = ez[idx] - z;
      if (dx * dx + dz * dz <= rSq) {
        count++;
      }
    }
    return count;
  }

  /**
   * Encuentra el índice de la entidad viva más cercana dentro del radio especificado
   * que cumpla el predicado opcional filter.
   */
  nearest(
    x: number,
    z: number,
    radius: number,
    filter?: (index: number) => boolean,
    ex: Float32Array = this.currentEx,
    ez: Float32Array = this.currentEz
  ): number {
    this.query(x - radius, z - radius, x + radius, z + radius);
    const rSq = radius * radius;
    let bestIdx = -1;
    let bestDistSq = rSq;

    for (let k = 0; k < this.resultLen; k++) {
      const idx = this.result[k];
      if (filter && !filter(idx)) continue;
      const dx = ex[idx] - x;
      const dz = ez[idx] - z;
      const dSq = dx * dx + dz * dz;
      if (dSq <= bestDistSq) {
        bestDistSq = dSq;
        bestIdx = idx;
      }
    }

    return bestIdx;
  }

  /**
   * Comprueba si existe alguna entidad dentro de un radio que cumpla el predicado
   */
  anyThreatWithin(
    x: number,
    z: number,
    radius: number,
    check: (index: number) => boolean,
    ex: Float32Array = this.currentEx,
    ez: Float32Array = this.currentEz
  ): boolean {
    this.query(x - radius, z - radius, x + radius, z + radius);
    const rSq = radius * radius;
    for (let k = 0; k < this.resultLen; k++) {
      const idx = this.result[k];
      const dx = ex[idx] - x;
      const dz = ez[idx] - z;
      if (dx * dx + dz * dz <= rSq) {
        if (check(idx)) return true;
      }
    }
    return false;
  }
}
