import type { SplitType, SplitInput } from '@pazito/contracts';
import { badRequest, unprocessable } from '../../shared/errors/app-error.js';
import { decimalToBasisPoints } from '../../shared/validation/currency.js';

export type CalculatedShare = { userId: string; amountMinor: bigint; percentageBasisPoints: number | null };

export function calculateShares(totalMinor: bigint, splitType: SplitType, input: SplitInput[]): CalculatedShare[] {
  if (totalMinor <= 0n) throw badRequest('El total del gasto debe ser mayor a cero', 'INVALID_AMOUNT');
  if (input.length < 1 || input.length > 100) throw badRequest('Se requieren entre 1 y 100 participantes', 'INVALID_SPLIT');
  const sorted = [...input].sort((a, b) => a.userId.localeCompare(b.userId));
  if (new Set(sorted.map(s => s.userId)).size !== sorted.length) throw badRequest('No repitas participantes', 'INVALID_SPLIT');
  if (splitType === 'equal') {
    const count = BigInt(sorted.length); const quotient = totalMinor / count; const remainder = totalMinor % count;
    return sorted.map((entry, index) => ({ userId: entry.userId, amountMinor: quotient + (BigInt(index) < remainder ? 1n : 0n), percentageBasisPoints: null }));
  }
  if (splitType === 'custom') {
    const shares = sorted.map(entry => {
      if (!Number.isSafeInteger(entry.amountMinor) || (entry.amountMinor ?? -1) < 0) throw badRequest('Cada participación personalizada debe tener amountMinor no negativo', 'INVALID_SPLIT');
      return { userId: entry.userId, amountMinor: BigInt(entry.amountMinor!), percentageBasisPoints: null };
    });
    if (shares.reduce((sum, item) => sum + item.amountMinor, 0n) !== totalMinor) throw unprocessable('La suma de las participaciones debe coincidir exactamente con el gasto', 'SPLIT_TOTAL_MISMATCH');
    return shares;
  }
  const basisPoints = sorted.map(entry => {
    if (entry.percentage === undefined) throw badRequest('Cada participante requiere un porcentaje', 'INVALID_SPLIT');
    return { userId: entry.userId, basisPoints: decimalToBasisPoints(entry.percentage) };
  });
  if (basisPoints.reduce((sum, item) => sum + item.basisPoints, 0) !== 10_000) throw unprocessable('Los porcentajes deben sumar exactamente 100%', 'SPLIT_PERCENTAGE_MISMATCH');
  const pieces = basisPoints.map(entry => {
    const numerator = totalMinor * BigInt(entry.basisPoints);
    return { userId: entry.userId, amountMinor: numerator / 10_000n, remainder: numerator % 10_000n, percentageBasisPoints: entry.basisPoints };
  });
  let residue = totalMinor - pieces.reduce((sum, item) => sum + item.amountMinor, 0n);
  const byLargestRemainder = [...pieces].sort((a, b) => a.remainder === b.remainder ? a.userId.localeCompare(b.userId) : (a.remainder > b.remainder ? -1 : 1));
  for (let i = 0; residue > 0n; i++, residue--) byLargestRemainder[i % byLargestRemainder.length]!.amountMinor += 1n;
  return pieces.map(({ userId, amountMinor, percentageBasisPoints }) => ({ userId, amountMinor, percentageBasisPoints }));
}
