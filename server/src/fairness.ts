import { createHash, createHmac, randomBytes } from 'node:crypto';

/**
 * Commit-reveal: o hash da seed é publicado antes da rodada e a seed só é
 * revelada depois da explosão. Qualquer um pode recalcular o ponto de crash
 * e conferir que o servidor não trocou o resultado no meio do voo.
 */
export function newSeed(): string {
  return randomBytes(32).toString('hex');
}

export function hashSeed(seed: string): string {
  return createHash('sha256').update(seed).digest('hex');
}

export function crashPointFrom(seed: string): number {
  const hex = createHmac('sha256', seed).update('orbita-crash').digest('hex');
  const n = parseInt(hex.slice(0, 13), 16); // 52 bits
  const e = 2 ** 52;
  if (n % 33 === 0) return 1; // ~3% de explosão instantânea
  return Math.max(1, Math.floor((100 * e - n) / (e - n)) / 100);
}
