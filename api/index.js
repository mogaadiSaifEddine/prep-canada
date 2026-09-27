// Vercel function: every /api/* request is rewritten here (see vercel.json).
import handler from '../lib/app.js';

export const config = { maxDuration: 120 };
export default handler;
