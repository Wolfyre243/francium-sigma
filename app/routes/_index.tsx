import { GithubIcon, APIIcon } from "../components/svg_icons";

export default function Home() {
    return (
        <div className="h-screen w-full flex flex-col justify-center items-center text-center text-white">
            <div className="mb-5 w-fit">
                <h1 className="text-6xl">Project Francium</h1>
                <p className="mt-4 text-lg">Have you seen stars shatter?</p>
            </div>

            <div className="flex flex-row gap-3 mb-5 w-fit">
                <a href="https://github.com/Wolfyre243/Project-Francium" target="blank" className="flex flex-row w-fit gap-2 items-center justify-center bg-black px-5 py-3 rounded-xl">
                    <GithubIcon width={30} height={30} hexColor="#ffffff" />
                    <p className="text-lg">Github</p>
                </a>
                <a className="flex flex-row w-fit gap-2 items-center justify-center bg-black px-5 py-3 rounded-xl">
                    <APIIcon width={25} height={25} hexColor="#ffffff" />
                    <p className="text-lg">API</p>
                </a>
            </div>

            <a href="/dashboard" className="bg-emerald-600 px-5 py-3 rounded-xl shadow hover:shadow-[0_0_20px_5px_rgba(125,125,125,0.2)] transition-all duration-300">
                <p>The time is now.</p>
            </a>

        </div>
    );
}