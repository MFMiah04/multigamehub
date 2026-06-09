export const questions = [
  "What's the best pizza topping?",
  "Name a popular social media platform",
  "What's the best movie snack?",
  "Name a red fruit",
  "What's a popular breakfast food?",
  "Name a sport played with a ball",
  "What's something you find in a bedroom?",
  "Name a famous city",
  "What's a common pet?",
  "Name a type of weather",
  "What's something cold?",
  "Name a day of the week people love",
  "What's something hot?",
  "Name a popular car brand",
  "What's a common pizza chain?",
  "Name something you wear on your feet",
  "What's a popular video game?",
  "Name a type of tree",
  "What's something green?",
  "Name a Disney movie",
  "What's a popular candy?",
  "Name a superhero",
  "What's something you drink in the morning?",
  "Name a musical instrument",
  "What's a common household chore?",
  "Name a type of bird",
  "What's something blue?",
  "Name a popular phone brand",
  "What's a type of cheese?",
  "Name a flavor of ice cream",
  "What's something you find at the beach?",
  "Name a popular streaming service",
  "What's a type of pasta?",
  "Name a famous singer",
  "What's something sweet?",
  "Name a school subject",
  "What's a popular fast food restaurant?",
  "Name a type of flower",
  "What's something scary?",
  "Name a planet",
  "What's a popular board game?",
  "Name an animal with stripes",
  "What's something round?",
  "Name a popular coffee chain",
  "What's a type of bread?",
  "Name a room in a house",
  "What's something you find in a kitchen?",
  "Name a popular app",
  "What's a type of dance?",
  "Name a country in Europe"
];

/**
 * Get a random question, avoiding used ones if possible
 * @param {Array<string>} usedQuestions - Array of already used questions
 * @returns {string} Random question
 */
export function getRandomQuestion(usedQuestions = []) {
  const availableQuestions = questions.filter(q => !usedQuestions.includes(q));

  // If all questions used, reset and use any
  if (availableQuestions.length === 0) {
    return questions[Math.floor(Math.random() * questions.length)];
  }

  return availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
}
