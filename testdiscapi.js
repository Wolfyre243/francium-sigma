import readline from 'readline-sync';

const data = await fetch('http://localhost:3030/francium/discord-init', {
    method: "PUT",
    body: JSON.stringify({
        message: "hello",
        context: "bababa"
    }),
    headers: {
        "Content-Type": "application/json"
    }
})

const data2 = await fetch('http://localhost:3030/francium/discord-init', {
    method: "PUT",
    body: JSON.stringify({
        message: "byebye",
        context: "bibibibi"
    }),
    headers: {
        "Content-Type": "application/json"
    }
})

const dataJSON = await data.json();
console.log(dataJSON)

const dataJSON2 = await data2.json();
console.log(dataJSON2)