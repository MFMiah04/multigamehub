import spyfall from './spyfall.js';
import imposter from './imposter.js';
import fakinIt from './fakin-it.js';
import herdMentality from './herd-mentality.js';

// To add a game: create a module with the same shape and list it here.
export const gameList = [spyfall, imposter, fakinIt, herdMentality];
export const games = Object.fromEntries(gameList.map(g => [g.id, g]));
