import type { LoaderFunctionArgs } from "@remix-run/node";
import { defer, json } from "@remix-run/node";
import { Suspense, useState } from "react";
import { Await, useLoaderData } from "@remix-run/react";

export const loader = async ({ params }: LoaderFunctionArgs) => {
    const greeting = fetch(`http://localhost:3030/api/francium`, {
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
    .then((res) => res.result);

    return defer({
        greeting
    });
}

export default function AlyssaWidget() {
    const { greeting } = useLoaderData<typeof loader>();

    return (
        <div className="bg-tertiary text-primary flex flex-col justify-center rounded-xl px-4 py-3 max-w-3xl">
            <div className="mb-2 py-1 border-primary border-b-2">
                <h1 className="text-2xl">Alyssa:</h1>
            </div>
            {/* // TODO: Turn this into a fetch request, and fetch a new response every time the user loads in */}
            <Suspense fallback={ <p>Generating...</p> }>
                <Await resolve={greeting}>
                    {(greeting) => <p>{greeting}</p>}
                </Await>
            </Suspense>
        </div>
    );
};