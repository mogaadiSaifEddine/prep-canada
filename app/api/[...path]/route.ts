// Every /api/* request goes through one router (lib/server/app.ts), as before the Next.js port.
import { handle } from '@/lib/server/app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const HEAD = handle;
