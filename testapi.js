import readline from 'readline-sync';

while (true) {

    const input = readline.question("You\n>> ");

    const data = await fetch("http://host.docker.internal:3030/francium", {
        method: "POST",
        body: JSON.stringify({
            message: input
        }),
        headers: {
            "Content-Type": "application/json"
        }
    })
    
    const dataJSON = await data.json();
    
    console.log(dataJSON.result);
}

// const data = await fetch("http://localhost:3030/francium/pgvector", {
//     method: "GET",
//     headers: {
//         "Content-Type": "application/json"
//     }
// });

// const dataJSON = await data.json();

// console.log(dataJSON[0].pageContent);