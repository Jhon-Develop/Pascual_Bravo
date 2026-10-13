import { Router } from 'express';
import { fxQuoteQuerySchema } from '@pazito/contracts';
import { asyncHandler } from '../../shared/http/async-handler.js';
import { requireAuth } from '../../shared/http/auth.middleware.js';
import { isValidCurrency } from '../../shared/validation/currency.js';
import { badRequest } from '../../shared/errors/app-error.js';
import { getFxQuote } from '../../infrastructure/fx/fx.service.js';

export const fxRouter = Router();

/** Quotes are indicative only. The returned rate/source/asOf must be stored with each expense. */
fxRouter.get('/rate', requireAuth, asyncHandler(async (req, res) => {
  const query = fxQuoteQuerySchema.parse(req.query);
  if (!isValidCurrency(query.from) || !isValidCurrency(query.to)) throw badRequest('Código de moneda ISO 4217 no soportado', 'INVALID_CURRENCY');
  const quote = await getFxQuote(query.from, query.to, query.manualRate);
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ from: query.from, to: query.to, rate: quote.rate, source: quote.source, asOf: quote.asOf.toISOString(), indicative: true });
}));
