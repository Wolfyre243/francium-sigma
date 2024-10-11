// Import icons
import { GithubIcon, UploadIcon } from "../../components/svg_icons";

export default function Sidebar() {
    return(
        <div className="flex flex-col gap-3 py-5 px-2 w-fit bg-secondary">
            <a href="/dashboard">
                <GithubIcon width={50} height={50} hexColor="#FFFFFF" />
            </a>
            
            <div className="h-full flex flex-col items-center py-4">
                <a href="/dashboard/upload">
                    <UploadIcon width={30} height={30} hexColor="#FFFFFF" />
                </a>
            </div>
        </div>
    );
}