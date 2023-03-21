export const IS_DEPLOYMENT = location.hostname !== "localhost" && location.hostname !== "127.0.0.1";
export const SERVER_URL = IS_DEPLOYMENT ? 'https://scanner2022.glitch.me' : ""; // use Glitch server in deployment, otherwise use local server

export async function GET(url) {
    return await fetch(SERVER_URL + url, { headers: { idtoken: sessionStorage.getItem('idtoken') } });
}

export async function POST(url, data) {
    return await fetch(SERVER_URL + url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            idtoken: sessionStorage.getItem('idtoken')
        },
        body: JSON.stringify(data)
    });
}