export function cn(...inputs: (string | undefined | null | false | Record<string, boolean>)[]): string {
  return inputs
    .flatMap((input) => {
      if (typeof input === 'string') return input.split(' ');
      if (input && typeof input === 'object') {
        return Object.entries(input)
          .filter(([, value]) => value)
          .map(([key]) => key);
      }
      return [];
    })
    .filter(Boolean)
    .join(' ');
}