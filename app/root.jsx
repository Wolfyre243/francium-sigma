import {
    Links,
    Meta,
    Outlet,
    Scripts,
} from "@remix-run/react";
  
export default function App() {
    return (
    <html>
        <head>
            <link
                rel="icon"
                href="data:image/x-icon;base64,AA"
            />
            <Meta />
            <Links />
        </head>
        <body>
            <h1>Hello world!</h1>
            <h2>I gotta add tailwind here</h2>
            <p>This is a Remix app.</p>
            <p>I love remix!!!</p>
            <Outlet />

            <Scripts />
        </body>
    </html>
    );
}