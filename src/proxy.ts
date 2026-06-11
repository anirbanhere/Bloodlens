import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  // Allow Railway healthcheck probe through without auth
  if (request.nextUrl.pathname === '/api/health') {
    return NextResponse.next()
  }

  const authHeader = request.headers.get('authorization')

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(' ')
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
      const [username, ...rest] = decoded.split(':')
      const password = rest.join(':')

      const expectedUser = process.env.BASIC_AUTH_USERNAME
      const expectedPass = process.env.BASIC_AUTH_PASSWORD

      if (expectedUser && expectedPass && username === expectedUser && password === expectedPass) {
        return NextResponse.next()
      }
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Health Tracker"',
    },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
