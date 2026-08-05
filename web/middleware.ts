import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/superadmin(.*)',
  '/completar-perfil(.*)',
]);

// Solo la landing de ventas. A proposito NO se incluyen /sign-in ni /sign-up:
// durante el registro, Clerk crea la cuenta antes de verificar el correo, y si
// en algun punto de ese proceso la sesion quedara activa, este redirect sacaria
// al usuario a mitad del registro y el club no se podria crear. Esas dos
// paginas ya no se quedan en blanco (se les quito el gate de useAuth) y el
// propio componente de Clerk manda al panel a quien ya tenga sesion, guiado por
// signInForceRedirectUrl del ClerkProvider.
const isLandingRoute = createRouteMatcher(['/']);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    const { userId } = await auth();
    // Redirigir a /sign-in local en vez de dejar que Clerk use su Account Portal
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }
    return;
  }

  // El redirect del usuario ya logueado se decide aquí y no dentro de la página.
  // La sesión viaja en una cookie, así que en el servidor ya se sabe quién es
  // antes de generar nada. Cuando esta pregunta se hacía con useAuth() dentro
  // de la landing, el componente devolvía null durante el prerenderizado (en el
  // servidor isLoaded siempre es false) y el HTML salía vacío: el visitante
  // esperaba a que bajara todo el JavaScript y arrancara Clerk para ver el
  // primer píxel. De ahí venían un FCP de 4,9 s y un LCP de 8,96 s en móvil.
  if (isLandingRoute(req)) {
    const { userId } = await auth();
    if (userId) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
