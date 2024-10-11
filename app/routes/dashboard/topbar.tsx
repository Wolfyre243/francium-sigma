// Import version
import packageJSON from "../../../package.json";
const version = packageJSON.version;

export default function TopBar() {
    return(
        <div className="h-fit w-full flex flex-row items-center px-5 py-4 text-white">
            <div className="flex flex-row items-baseline">
                <h1 className="text-4xl p-3">Francium Dashboard</h1>
                <p className="bg-blue-600 rounded-xl px-3">v{version}</p>
            </div>
        </div>
    );
}