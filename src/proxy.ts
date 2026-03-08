import { NextRequest, NextResponse } from "next/server";

export const proxy = ((request: NextRequest) => {
    const token = request.cookies.get("token")?.value;
    const path = request.nextUrl.pathname;
    if(path === '/' && token) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    } else if(path === '/' && !token) {
        return NextResponse.redirect(new URL('/login', request.url));
    } else if ((path === '/login' || path === '/register') && token) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    } else if ((path.startsWith('/dashboard') || path.startsWith('/research')) && !token) {
        return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
});

export const config = {
    matcher: ["/", "/login", "/register", "/dashboard", "/research/:path*"],
};