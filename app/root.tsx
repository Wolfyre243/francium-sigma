// This file is like the RootLayout of the entire application.
// The Outlet component lets us render child routes

import { Links, Meta, Outlet, Scripts } from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";

import stylesheet from "./tailwind.css?url";

export const links: LinksFunction = () => [
    { rel: "stylesheet", href: stylesheet },
];
  
export default function App() {
    return (
    <html>
        <head>
            <Meta />
            <Links />
        </head>
        <body className="bg-stone-950 font-outfit">
            <Outlet />
            <Scripts />
        </body>
    </html>
    );
}