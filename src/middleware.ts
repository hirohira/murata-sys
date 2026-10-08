import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     * - mock/ (検討用のサンプル画面。データを持たないのでログイン不要)
     */
    '/((?!_next/static|_next/image|favicon.ico|mock/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
