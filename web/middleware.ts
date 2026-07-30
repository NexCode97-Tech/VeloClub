import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { CSP_DIRECTIVES } from '@/lib/csp';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/superadmin(.*)',
  '/completar-perfil(.*)',
]);

export default clerkMiddleware(
  async (auth, req) => {
    if (isProtectedRoute(req)) {
      const { userId } = await auth();
      // Redirigir a /sign-in local en vez de dejar que Clerk use su Account Portal
      if (!userId) {
        return NextResponse.redirect(new URL('/sign-in', req.url));
      }
    }
  },
  {
    // La CSP se emite aquí y no en next.config.ts porque `strict` genera un nonce
    // por petición, y con nonce el navegador ignora `'unsafe-inline'` en
    // script-src: ese era el agujero que dejaba la política anterior sin defensa
    // real ante XSS.
    contentSecurityPolicy: {
      strict: true,
      directives: CSP_DIRECTIVES,
    },
  },
);

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
