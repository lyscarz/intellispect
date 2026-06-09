import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const PROTECTED_PREFIXES = ['/fleet', '/settings'];
const AUTH_ROUTES = ['/login', '/signup', '/confirm'];

export async function middleware(request: NextRequest) {
  // If Supabase isn't configured yet, skip auth handling entirely so /trackunit-debug
  // and other env-only routes continue to work during initial setup.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  const { user, response } = await updateSession(request);
  const path = request.nextUrl.pathname;

  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  const isAuthRoute = AUTH_ROUTES.some((p) => path === p || path.startsWith(`${p}/`));

  if (isProtected && !user) {
    const redirect = NextResponse.redirect(new URL('/login', request.url));
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }

  if (isAuthRoute && user) {
    const redirect = NextResponse.redirect(new URL('/fleet', request.url));
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }

  return response;
}

export const config = {
  // Run middleware on everything except static assets, the legacy debug route, and the OAuth callback.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|trackunit-debug|auth/callback).*)'],
};
