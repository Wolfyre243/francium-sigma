import { Links, Meta, Outlet, Scripts } from "@remix-run/react";

// Import icons
import { GithubIcon, UploadIcon } from "../../components/svg_icons";

export default function Layout() {
    return (
        <main className="h-screen w-screen flex flex-row">
            {/* Sidebar // TODO: turn into component */}
            <div className="flex flex-col gap-3 py-5 px-2 w-fit bg-emerald-200">
                <GithubIcon width={50} height={50} hexColor="#000000" />
                <div className="h-full flex flex-col items-center py-4">
                    <UploadIcon width={30} height={30} hexColor="#000000" />
                </div>
            </div>
            <div className="flex flex-col w-full">
                <div className="h-fit w-full flex flex-row items-center p-4 text-white">
                    <h1 className="text-4xl p-3">Francium Dashboard</h1>
                </div>
                <Outlet/>
            </div>
        </main>
    );
}