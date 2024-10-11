// This is the index page for the dashboard route.

// Import components
import { AlyssaWidget, ExplosionCounterWidget } from "./widgets";
// import AlyssaWidget from "./alyssaWidget";


export default function DashboardHome() {
    return (
        <section className="flex flex-col h-full w-full px-8">
            <div className="flex flex-row h-fit gap-5">
                {/* //TODO: Add widgets here */}
                <AlyssaWidget />
                <ExplosionCounterWidget />
            </div>

            <div className="flex h-full justify-center items-center py-5 gap-5 text-white">
                <div className="w-2/3 p-3 h-full rounded-xl bg-primary">
                    Stats area
                </div>
                <div className="w-1/3 p-3 h-full rounded-xl bg-primary">
                    More stats
                </div>
            </div>

        </section>
    );
}