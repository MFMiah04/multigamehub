// Example names for the "Your name" field. One is picked each time the page loads.
const COMMON = [
  'Oliver', 'Amelia', 'Harry', 'Olivia', 'George', 'Isla', 'Jack', 'Ava', 'Noah', 'Emily',
  'Charlie', 'Sophie', 'Jacob', 'Grace', 'Alfie', 'Lily', 'Freddie', 'Freya', 'Oscar', 'Ella',
  'Leo', 'Mia', 'Archie', 'Evie', 'Henry', 'Poppy', 'Theo', 'Ruby', 'Joshua', 'Daisy',
  'Thomas', 'Chloe', 'James', 'Jessica', 'William', 'Sienna', 'Max', 'Isabelle', 'Lucas', 'Phoebe',
  'Ethan', 'Millie', 'Arthur', 'Matilda', 'Finley', 'Rosie', 'Samuel', 'Imogen', 'Daniel', 'Holly',
  'Joseph', 'Harriet', 'Alexander', 'Lucy', 'Edward', 'Eleanor', 'Toby', 'Megan', 'Reuben', 'Abigail',
  'Dylan', 'Scarlett', 'Ben', 'Hannah', 'Callum', 'Zara', 'Ryan', 'Florence', 'Liam', 'Amber',
  'Connor', 'Lauren', 'Kieran', 'Bethany', 'Rhys', 'Niamh', 'Owen', 'Ffion', 'Euan', 'Eilidh',
  'Jamie', 'Katie', 'Sam', 'Ellie', 'Tom', 'Becky', 'Dan', 'Gemma', 'Luke', 'Jade',
  'Adam', 'Leah', 'Aaron', 'Naomi', 'Elliot', 'Molly', 'Zain', 'Aisha', 'Yusuf', 'Maryam',
  'Ibrahim', 'Amira', 'Rohan', 'Priya', 'Arjun', 'Anika', 'Hamza', 'Layla', 'Kofi', 'Ama',
  'Gareth', 'Siobhan', 'Nigel', 'Brenda', 'Darren', 'Tracey', 'Craig', 'Sharon', 'Gavin', 'Kerry',
];

// Little easter eggs: each of these has a 1% chance of showing up.
const RARE = ['Fahim', 'Nuha', 'Jubair', 'Shafin', 'Kevin', 'Maruf', 'Arafat', 'Mo', 'Dorif', 'Agamul', 'Bodrul'];
const RARE_CHANCE = 0.01;

const pickFrom = list => list[Math.floor(Math.random() * list.length)];

export function randomPlaceholderName() {
  return Math.random() < RARE.length * RARE_CHANCE ? pickFrom(RARE) : pickFrom(COMMON);
}
