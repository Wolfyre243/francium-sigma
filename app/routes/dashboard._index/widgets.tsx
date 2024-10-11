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



export function AlyssaWidget() {

    const [greeting, setGreeting] = useState("Generating...");

    const getGreeting = async  () => {
        const greeting = await fetch(`http://localhost:3030/api/francium`, {
            method: 'POST',
            body: JSON.stringify({
                message: "Hello Alyssa :>"
            }),
            headers: {
                "Content-Type": "application/json"
            }
        })
        .then((res) => res.json())
        .then((res) => {
            console.log(res)
            return res;
        })
        .then((res) => {
            setGreeting(res.result);
            console.log("Updated greeting")
        });
    
        return greeting;
    }

    useEffect(() => {
        getGreeting();
    }, []);

    window.addEventListener("unload", (event) => {
        getGreeting();
    })

    return (
        <div className="bg-tertiary text-primary flex flex-col justify-center rounded-xl px-4 py-3 max-w-3xl">
            <div className="mb-2 py-1 border-primary border-b-2">
                <h1 className="text-2xl">Alyssa:</h1>
            </div>
            {/* // TODO: Turn this into a fetch request, and fetch a new response every time the user loads in */}
            <p>{greeting}</p>
        </div>
    );
};

export function ExplosionCounterWidget() {
    return (
        <div className="bg-accent flex flex-col justify-center gap-2 rounded-xl px-4 py-2 max-w-3xl">
            <h1 className="text-3xl">Days since last explosion:</h1>
            <p className="text-6xl">2</p>
        </div>
    );
}