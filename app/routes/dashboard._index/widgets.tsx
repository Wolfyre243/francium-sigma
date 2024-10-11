// This file contains the widgets for the home page of the dashboard.
import type { LoaderFunctionArgs } from "@remix-run/node";
import { defer } from "@remix-run/node";
import { Suspense, useState, useEffect } from "react";
import { Await, useLoaderData } from "@remix-run/react";

// const getGreeting = async () => {
//     const greetingPromise = fetch(`http://localhost:3030/api/francium`, {
//         method: 'POST',
//         body: JSON.stringify({
//             message: "Hello Alyssa :>"
//         }),
//         headers: {
//             "Content-Type": "application/json"
//         }
//     })
//     .then((res) => res.json())
//     .then((res) => res.result);
// }

export function AlyssaWidget({ children } : {children: React.ReactNode }) {
    // const [greeting, setGreeting] = useState("Alyssa is taking a nap...");

    // useEffect(() => {
    //     fetchGreeting().then(res => {
    //         setGreeting(res);
    //     })
    // }, []);

    return (
        <div className="bg-tertiary text-primary flex flex-col justify-center rounded-xl px-4 py-3 w-1/3">
            <div className="mb-2 py-1 border-primary border-b-2">
                <h1 className="text-2xl">Alyssa:</h1>
            </div>
            <div>
                { children }
            </div>
        </div>
    );
};

export function ExplosionCounterWidget() {
    return (
        <div className="bg-accent flex flex-col justify-center gap-2 rounded-xl px-4 py-2 max-w-3xl">
            <h1 className="text-3xl">Days since last explosion:</h1>
            <p className="text-6xl">0</p>
        </div>
    );
}