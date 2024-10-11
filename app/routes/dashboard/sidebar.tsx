// Import icons
import { GithubIcon, UploadIcon } from "../../components/svg_icons";

export default function Sidebar() {
    return(
        <div className="flex flex-col gap-3 py-5 px-2 w-fit bg-secondary">
            <GithubIcon width={50} height={50} hexColor="#FFFFFF" />
            <div className="h-full flex flex-col items-center py-4">
                <UploadIcon width={30} height={30} hexColor="#FFFFFF" />
            </div>
        </div>
    );
}