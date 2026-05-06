import { simulateGames } from "../src/game/simulator";

const games = Number(process.argv[2] ?? 500);
const seed = Number(process.argv[3] ?? 123456);
const summary = simulateGames(games, seed);

console.log(JSON.stringify(summary, null, 2));
