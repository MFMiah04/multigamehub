export const questions = [
  "What's the best pizza topping?",
  "Name a popular social media platform",
  "What's the best day of the week?",
  "Name a popular sport",
  "What's the best ice cream flavor?",
  "Name a type of pet",
  "What's the best breakfast food?",
  "Name a color of the rainbow",
  "What's the best season?",
  "Name a popular movie genre",
  "What's the best fruit?",
  "Name a musical instrument",
  "What's the best superhero?",
  "Name a popular car brand",
  "What's the best holiday?",
  "Name a country you'd like to visit",
  "What's the best video game console?",
  "Name a type of weather",
  "What's the best type of music?",
  "Name a famous landmark",
  "What's the best type of bread?",
  "Name a popular TV show",
  "What's the best dessert?",
  "Name a type of tree",
  "What's the best board game?",
  "Name a popular app",
  "What's the best sandwich?",
  "Name a type of shoe",
  "What's the best beverage?",
  "Name a famous person",
  "What's the best candy?",
  "Name a type of flower",
  "What's the best fast food restaurant?",
  "Name a type of pasta",
  "What's the best exercise?",
  "Name a popular book",
  "What's the best vegetable?",
  "Name a type of bird",
  "What's the best pizza chain?",
  "Name a popular brand",
  "What's the best time of day?",
  "Name a type of fish",
  "What's the best condiment?",
  "Name a famous city",
  "What's the best chocolate bar?",
  "Name a type of cheese",
  "What's the best coffee drink?",
  "Name a popular song",
  "What's the best outdoor activity?",
  "Name a type of dance"
];

// Get a random question
export function getRandomQuestion(usedQuestions = []) {
  const availableQuestions = questions.filter(q => !usedQuestions.includes(q));

  if (availableQuestions.length === 0) {
    // If all questions used, reset
    return questions[Math.floor(Math.random() * questions.length)];
  }

  return availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
}
