# MultigameHub

Party games to play together on phones or computers. Make a character, then one person hosts a room and everyone joins with a 4-letter code (or the invite link / QR code), and you play together in the same room or on a call.

**Live:** https://multigame-hub.web.app

## Games
- **Spyfall**: everyone knows the location except the spy. Ask questions, find the spy.
- **Imposter**: everyone knows the secret word except the imposter, who only gets a hint.
- **Fakin' It**: the overseer writes two questions; the faker secretly answers the other one.
- **Herd Mentality**: answer the same as the majority to score. Don't get stuck with the pink cow.
- **One Word** (2+ players): a team game. Everyone writes a one-word clue for the guesser, but matching clues get cancelled.
- **Fake Answer**: write a believable fake answer to a strange true fact, then try to spot the real one.
- **Spectrum** (2+ players): the psychic gives a clue for a secret spot between two extremes; everyone else slides to guess it.
- **Word Sync** (2+ players): everyone writes a word at once, then keeps linking the last words until everyone writes the same one.
- **Number Climb** (2+ players): everyone gets secret numbers from 1 to 100 and has to play them all in order, lowest to highest, without talking.

## Tech
Vite, [lit-html](https://lit.dev/docs/libraries/standalone-templates/) for rendering, Firebase Realtime Database, Firebase anonymous auth and Firebase Hosting.

Each player signs in anonymously, so refreshing or losing signal drops you straight back into your room. If the host disconnects for more than 15 seconds, the next player takes over as host.

## Running locally

```bash
npm install
npm run emulators   # local Firebase auth + database (needs Java)
npm run dev:emu     # in a second terminal, then open http://localhost:5173
```

In emulator mode each browser tab is a separate player, so you can test a whole game in one browser. `npm run dev` runs against the real Firebase project instead.

## Deploying

```bash
npm run deploy      # builds, then deploys hosting and database.rules.json
```

Anonymous sign-in must be enabled in the Firebase console (Authentication → Sign-in method).

## Adding a game
1. Create `src/games/<your-game>.js` exporting an object with `id`, `name`, `color`, `players`, `blurb`, `rules`, `defaults()`, `settingsView()`, `canStart()`, `start()`, `tick()` and `view()`. The existing games are good templates, and `src/games/common.js` has shared voting, results and timer helpers.
2. Add it to the list in `src/games/index.js`.
