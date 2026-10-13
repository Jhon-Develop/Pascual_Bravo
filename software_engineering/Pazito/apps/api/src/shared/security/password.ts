import argon2 from 'argon2';

// OWASP minimum baseline: Argon2id, 19 MiB, 2 iterations, parallelism 1.
const options = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };
export const hashPassword = (password: string) => argon2.hash(password, options);
export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password).catch(() => false);
