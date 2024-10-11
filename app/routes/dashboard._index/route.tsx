// This is the index page for the dashboard route.

// Import components
import { AlyssaWidget, ExplosionCounterWidget } from "./widgets";
// import AlyssaWidget from "./alyssaWidget";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { defer, json } from "@remix-run/node";
import { useLoaderData, Await } from "@remix-run/react";
import { Suspense } from "react";

export const loader = async ({ params, } : LoaderFunctionArgs) => {
    const responsePromise = fetch(`http://localhost:3030/api/francium`, {
        method: 'POST',
        body: JSON.stringify({
            message: "wolfyre.: Hello Alyssa"
        }),
        headers: {
            "Content-Type": "application/json"
        }
    })
    .then(res => res.json())
    .then(res => res.result)
    .catch(err => {
        throw json({ greeting: "Oops, there's something wrong in my system!"})
    });

    return defer({
        greeting: responsePromise
    })
}

export default function DashboardHome() {

    const { greeting } = useLoaderData<typeof loader>();

    return (
        <section className="flex flex-col h-full w-full px-8">
            <div className="flex flex-row h-fit gap-5">
                {/* //TODO: Add widgets here */}
                <AlyssaWidget>
                    <Suspense fallback={<p>Loading...</p>}>
                        <Await resolve={greeting}>
                            { (resolvedValue: string) => <p>{resolvedValue}</p> }
                        </Await>
                    </Suspense>
                </AlyssaWidget>
                
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