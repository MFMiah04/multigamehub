import spyfall from './spyfall.js';
import imposter from './imposter.js';
import fakinIt from './fakin-it.js';
import herdMentality from './herd-mentality.js';
import oneWord from './one-word.js';
import fakeAnswer from './fake-answer.js';
import spectrum from './spectrum.js';

// To add a game: create a module with the same shape and list it here.
export const gameList = [spyfall, imposter, fakinIt, herdMentality, oneWord, fakeAnswer, spectrum];
export const games = Object.fromEntries(gameList.map(g => [g.id, g]));
