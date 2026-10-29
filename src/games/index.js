import spyfall from './spyfall.js';
import imposter from './imposter.js';
import fakinIt from './fakin-it.js';
import herdMentality from './herd-mentality.js';
import oneWord from './one-word.js';
import fakeAnswer from './fake-answer.js';
import spectrum from './spectrum.js';
import wordSync from './word-sync.js';
import numberClimb from './number-climb.js';
import insider from './insider.js';
import avalon from './avalon.js';
import sketch from './sketch.js';
import doodleImposter from './doodle-imposter.js';
import drawGuess from './draw-guess.js';
import drawOff from './draw-off.js';
import animation from './animation.js';
import complementary from './complementary.js';
import battleship from './battleship.js';
import dotsBoxes from './dots-boxes.js';
import chainPop from './chain-pop.js';

// To add a game: create a module with the same shape and list it here.
export const gameList = [spyfall, imposter, fakinIt, herdMentality, oneWord, fakeAnswer, spectrum, wordSync, numberClimb, insider, avalon, drawGuess, drawOff, animation, complementary, doodleImposter, sketch, battleship, dotsBoxes, chainPop];
export const games = Object.fromEntries(gameList.map(g => [g.id, g]));
