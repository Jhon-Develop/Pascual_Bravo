import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('joins class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('handles conditional classes', () => {
    expect(cn('base', true && 'active', false && 'hidden')).toBe('base active');
  });

  it('handles object syntax', () => {
    expect(cn({ base: true, active: true, hidden: false })).toBe('base active');
  });

  it('handles mixed arguments', () => {
    expect(cn('base', { active: true }, 'extra')).toBe('base active extra');
  });

  it('handles empty/undefined/null', () => {
    expect(cn('base', undefined, null, false, '')).toBe('base');
  });

  it('returns empty string for no args', () => {
    expect(cn()).toBe('');
  });
});