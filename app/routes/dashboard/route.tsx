// This is the Layout file for the /dashboard route.
// Everything here will appear on anything that has the /dashboard route.

import { Links, Meta, Outlet, Scripts } from "@remix-run/react";

// Import icons
import { GithubIcon, UploadIcon } from "../../components/svg_icons";

// Import components
import Sidebar from "./sidebar";
import TopBar from "./topbar";


export default function Layout() {
    return (
        <main className="h-screen w-screen flex flex-row">
            <Sidebar />
            <div className="flex flex-col h-full w-full">
                <TopBar />
                <Outlet />
            </div>
        </main>
    );
};