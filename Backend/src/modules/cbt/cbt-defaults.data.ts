import type { CbtCategory, CbtDifficulty } from '../../generated/prisma/enums';

/**
 * The default TGManager practice bank that ships with every school.
 *
 * IMPORTANT: these are original practice questions written in the *style* of
 * each examination body. They are NOT official WAEC, NECO or JAMB past
 * questions, and they are not sourced from those bodies' portals. Every item
 * is stored with `source = TGMANAGER` so the UI can label it honestly.
 *
 * Schools may add their own questions (category `MOCK` by default), import
 * licensed papers via CSV, or replace these entirely — nothing here is hidden
 * from editing.
 */

export interface SeedQuestion {
  /** Subject name as configured on the school (falls back if missing). */
  subject: string;
  topic: string;
  difficulty: CbtDifficulty;
  text: string;
  options: string[];
  /** Index of the correct option inside `options`. */
  correct: number;
  explanation: string;
}

export interface SeedCategoryPlan {
  category: CbtCategory;
  /** PRACTICE reveals answers after submission; MOCK withholds them. */
  mode: 'PRACTICE' | 'MOCK';
  title: string;
  description: string;
  instructions: string;
  passMark: number;
  showCorrectAnswers: boolean;
  maxAttempts: number;
  questions: SeedQuestion[];
}

const WAEC: SeedQuestion[] = [
  // Mathematics
  {
    subject: 'Mathematics',
    topic: 'Algebra',
    difficulty: 'EASY',
    text: 'Simplify: 3(2x − 4) + 5.',
    options: ['6x − 7', '6x + 1', '6x − 12', '6x + 17'],
    correct: 0,
    explanation: '3(2x − 4) = 6x − 12; adding 5 gives 6x − 7.',
  },
  {
    subject: 'Mathematics',
    topic: 'Geometry',
    difficulty: 'MEDIUM',
    text: 'The angles of a quadrilateral are 80°, 95°, 100° and x°. Find x.',
    options: ['75°', '85°', '95°', '105°'],
    correct: 1,
    explanation: 'Angles of a quadrilateral sum to 360°. 80 + 95 + 100 = 275, so x = 85°.',
  },
  {
    subject: 'Mathematics',
    topic: 'Number and Numeration',
    difficulty: 'EASY',
    text: 'Express 0.25 as a fraction in its lowest terms.',
    options: ['1/4', '1/2', '2/5', '1/5'],
    correct: 0,
    explanation: '0.25 = 25/100, which reduces to 1/4.',
  },
  {
    subject: 'Mathematics',
    topic: 'Statistics',
    difficulty: 'MEDIUM',
    text: 'Find the median of the numbers 4, 7, 9, 11, 15, 20.',
    options: ['9', '10', '11', '12'],
    correct: 1,
    explanation: 'With six ordered values the median is the mean of the 3rd and 4th: (9 + 11) ÷ 2 = 10.',
  },
  {
    subject: 'Mathematics',
    topic: 'Algebra',
    difficulty: 'HARD',
    text: 'If x² − 5x + 6 = 0, find the sum of the roots.',
    options: ['5', '6', '−5', '−6'],
    correct: 0,
    explanation: 'For ax² + bx + c = 0 the sum of roots is −b/a = 5.',
  },
  // English Language
  {
    subject: 'English Language',
    topic: 'Grammar',
    difficulty: 'EASY',
    text: 'Choose the option that best completes the sentence: Neither the teacher nor the students ____ present.',
    options: ['is', 'are', 'was', 'be'],
    correct: 1,
    explanation: 'With “neither … nor” the verb agrees with the nearer subject (“students”), so “are” is correct.',
  },
  {
    subject: 'English Language',
    topic: 'Vocabulary',
    difficulty: 'MEDIUM',
    text: 'Choose the word that is nearest in meaning to “diligent”.',
    options: ['lazy', 'hardworking', 'careless', 'weak'],
    correct: 1,
    explanation: '“Diligent” means showing careful, persistent effort — nearest in meaning to “hardworking”.',
  },
  {
    subject: 'English Language',
    topic: 'Punctuation',
    difficulty: 'EASY',
    text: 'Which sentence is punctuated correctly?',
    options: ["He said, 'I will come.'", "He said 'I will come'.", "he said, 'I will come.'", "He said, 'i will come.'"],
    correct: 0,
    explanation: 'A direct quotation is set off by a comma and begins with a capital letter inside the quotes.',
  },
  {
    subject: 'English Language',
    topic: 'Vocabulary',
    difficulty: 'MEDIUM',
    text: 'Choose the option opposite in meaning to “scarce”.',
    options: ['rare', 'plentiful', 'costly', 'small'],
    correct: 1,
    explanation: '“Scarce” means in short supply; its opposite is “plentiful”.',
  },
  {
    subject: 'English Language',
    topic: 'Grammar',
    difficulty: 'HARD',
    text: 'Choose the correct option: The ____ of the two books are torn.',
    options: ['covers', 'cover', "covers'", "cover's"],
    correct: 0,
    explanation: 'The plural subject “covers” agrees with the plural verb “are”.',
  },
  // Physics
  {
    subject: 'Physics',
    topic: 'Measurement',
    difficulty: 'EASY',
    text: 'Which of the following is a vector quantity?',
    options: ['Speed', 'Mass', 'Force', 'Temperature'],
    correct: 2,
    explanation: 'Force has both magnitude and direction, so it is a vector quantity.',
  },
  {
    subject: 'Physics',
    topic: 'Motion',
    difficulty: 'MEDIUM',
    text: 'A body covers 60 m in 5 s. Calculate its average speed.',
    options: ['12 m/s', '300 m/s', '65 m/s', '0.08 m/s'],
    correct: 0,
    explanation: 'Average speed = distance ÷ time = 60 ÷ 5 = 12 m/s.',
  },
  {
    subject: 'Physics',
    topic: 'Electricity',
    difficulty: 'HARD',
    text: 'A current of 2 A flows through a wire when 12 V is applied across it. Find its resistance.',
    options: ['24 Ω', '6 Ω', '10 Ω', '14 Ω'],
    correct: 1,
    explanation: 'From Ohm’s law R = V ÷ I = 12 ÷ 2 = 6 Ω.',
  },
  // Chemistry
  {
    subject: 'Chemistry',
    topic: 'Atomic Structure',
    difficulty: 'EASY',
    text: 'What is the atomic number of carbon?',
    options: ['6', '12', '14', '8'],
    correct: 0,
    explanation: 'Carbon has 6 protons, so its atomic number is 6.',
  },
  {
    subject: 'Chemistry',
    topic: 'Gases',
    difficulty: 'MEDIUM',
    text: 'Which gas turns limewater milky?',
    options: ['Oxygen', 'Hydrogen', 'Carbon dioxide', 'Nitrogen'],
    correct: 2,
    explanation: 'Carbon dioxide reacts with limewater to form insoluble calcium carbonate, turning it milky.',
  },
  {
    subject: 'Chemistry',
    topic: 'Mole Concept',
    difficulty: 'HARD',
    text: 'How many moles are present in 36 g of water? (H₂O = 18 g/mol)',
    options: ['0.5 mol', '1 mol', '2 mol', '3 mol'],
    correct: 2,
    explanation: 'Moles = mass ÷ molar mass = 36 ÷ 18 = 2 mol.',
  },
  // Biology
  {
    subject: 'Biology',
    topic: 'Plant Biology',
    difficulty: 'EASY',
    text: 'The part of a plant that absorbs water and mineral salts is the ____.',
    options: ['leaf', 'stem', 'root', 'flower'],
    correct: 2,
    explanation: 'Root hairs absorb water and dissolved mineral salts from the soil.',
  },
  {
    subject: 'Biology',
    topic: 'Circulatory System',
    difficulty: 'MEDIUM',
    text: 'Which blood vessel carries oxygenated blood from the lungs to the heart?',
    options: ['Pulmonary artery', 'Pulmonary vein', 'Aorta', 'Vena cava'],
    correct: 1,
    explanation: 'The pulmonary vein is the only vein that carries oxygenated blood — from the lungs to the heart.',
  },
  // Economics
  {
    subject: 'Economics',
    topic: 'Basic Concepts',
    difficulty: 'EASY',
    text: 'The fundamental economic problem facing every society is ____.',
    options: ['inflation', 'scarcity', 'unemployment', 'taxation'],
    correct: 1,
    explanation: 'Scarcity — unlimited wants against limited resources — is the basic economic problem.',
  },
  {
    subject: 'Economics',
    topic: 'Demand and Supply',
    difficulty: 'MEDIUM',
    text: 'Demand for a commodity is said to be elastic when the coefficient of elasticity is ____.',
    options: ['equal to zero', 'greater than one', 'less than one', 'equal to one'],
    correct: 1,
    explanation: 'Elastic demand has a coefficient greater than one: quantity responds more than proportionately to price.',
  },
  // Civic Education
  {
    subject: 'Civic Education',
    topic: 'Citizenship',
    difficulty: 'EASY',
    text: 'Which of the following is a civic responsibility of a citizen?',
    options: ['Paying taxes', 'Violating laws', 'Evading tax', 'Ignoring elections'],
    correct: 0,
    explanation: 'Paying taxes is a civic duty that funds public services.',
  },
];

const NECO: SeedQuestion[] = [
  // Mathematics
  {
    subject: 'Mathematics',
    topic: 'Percentages',
    difficulty: 'EASY',
    text: 'Evaluate 15% of 200.',
    options: ['15', '20', '30', '45'],
    correct: 2,
    explanation: '15% of 200 = 0.15 × 200 = 30.',
  },
  {
    subject: 'Mathematics',
    topic: 'Algebra',
    difficulty: 'MEDIUM',
    text: 'Solve for x: 5x − 3 = 2x + 9.',
    options: ['2', '3', '4', '6'],
    correct: 2,
    explanation: '5x − 2x = 9 + 3 ⇒ 3x = 12 ⇒ x = 4.',
  },
  {
    subject: 'Mathematics',
    topic: 'Commercial Arithmetic',
    difficulty: 'EASY',
    text: 'Find the simple interest on ₦20,000 for 2 years at 5% per annum.',
    options: ['₦1,000', '₦2,000', '₦2,500', '₦4,000'],
    correct: 1,
    explanation: 'I = (P × R × T) ÷ 100 = (20,000 × 5 × 2) ÷ 100 = ₦2,000.',
  },
  {
    subject: 'Mathematics',
    topic: 'Geometry',
    difficulty: 'MEDIUM',
    text: 'Find the area of a circle of radius 7 cm. (Take π = 22/7)',
    options: ['154 cm²', '144 cm²', '132 cm²', '176 cm²'],
    correct: 0,
    explanation: 'Area = πr² = (22/7) × 7 × 7 = 154 cm².',
  },
  {
    subject: 'Mathematics',
    topic: 'Indices',
    difficulty: 'HARD',
    text: 'If 2ⁿ = 32, find the value of n.',
    options: ['4', '5', '6', '8'],
    correct: 1,
    explanation: '32 = 2⁵, so n = 5.',
  },
  // English Language
  {
    subject: 'English Language',
    topic: 'Grammar',
    difficulty: 'EASY',
    text: 'Choose the option that best completes the sentence: The boys ____ playing football now.',
    options: ['is', 'are', 'was', 'be'],
    correct: 1,
    explanation: '“The boys” is plural, so the plural verb “are” is correct.',
  },
  {
    subject: 'English Language',
    topic: 'Vocabulary',
    difficulty: 'MEDIUM',
    text: 'Choose the word that is nearest in meaning to “commence”.',
    options: ['end', 'begin', 'stop', 'continue'],
    correct: 1,
    explanation: '“Commence” means to begin.',
  },
  {
    subject: 'English Language',
    topic: 'Spelling',
    difficulty: 'EASY',
    text: 'Choose the correctly spelt word.',
    options: ['recieve', 'receive', 'receeve', 'riceive'],
    correct: 1,
    explanation: 'The correct spelling is “receive” — remember “i before e except after c”.',
  },
  {
    subject: 'English Language',
    topic: 'Vocabulary',
    difficulty: 'MEDIUM',
    text: 'Choose the option opposite in meaning to “ancient”.',
    options: ['old', 'modern', 'historic', 'aged'],
    correct: 1,
    explanation: '“Ancient” means very old; its opposite is “modern”.',
  },
  {
    subject: 'English Language',
    topic: 'Grammar',
    difficulty: 'HARD',
    text: 'Choose the correct reported form: He said, “I am tired.”',
    options: [
      'He said that he was tired.',
      'He said that I am tired.',
      'He said he is tired.',
      'He says he was tired.',
    ],
    correct: 0,
    explanation: 'In reported speech the present tense “am” shifts back to “was” and the pronoun changes to “he”.',
  },
  // Physics
  {
    subject: 'Physics',
    topic: 'Electricity',
    difficulty: 'EASY',
    text: 'The SI unit of electric current is the ____.',
    options: ['volt', 'ampere', 'watt', 'ohm'],
    correct: 1,
    explanation: 'Electric current is measured in amperes (A).',
  },
  {
    subject: 'Physics',
    topic: 'Energy',
    difficulty: 'MEDIUM',
    text: 'Which of the following is a renewable source of energy?',
    options: ['Coal', 'Solar', 'Natural gas', 'Diesel'],
    correct: 1,
    explanation: 'Solar energy is naturally replenished, unlike fossil fuels.',
  },
  {
    subject: 'Physics',
    topic: 'Motion',
    difficulty: 'HARD',
    text: 'A car accelerates from rest to 20 m/s in 5 s. Find its acceleration.',
    options: ['2 m/s²', '4 m/s²', '5 m/s²', '100 m/s²'],
    correct: 1,
    explanation: 'Acceleration = change in velocity ÷ time = 20 ÷ 5 = 4 m/s².',
  },
  // Chemistry
  {
    subject: 'Chemistry',
    topic: 'Atomic Structure',
    difficulty: 'EASY',
    text: 'The chemical symbol for sodium is ____.',
    options: ['So', 'S', 'Na', 'N'],
    correct: 2,
    explanation: 'Sodium takes its symbol (Na) from its Latin name, natrium.',
  },
  {
    subject: 'Chemistry',
    topic: 'Acids and Bases',
    difficulty: 'MEDIUM',
    text: 'A solution with a pH of 3 is ____.',
    options: ['acidic', 'neutral', 'basic', 'alkaline'],
    correct: 0,
    explanation: 'A pH below 7 is acidic; pH 7 is neutral and above 7 is basic.',
  },
  {
    subject: 'Chemistry',
    topic: 'Periodic Table',
    difficulty: 'HARD',
    text: 'Which of the following is a noble gas?',
    options: ['Chlorine', 'Argon', 'Oxygen', 'Nitrogen'],
    correct: 1,
    explanation: 'Argon belongs to Group 18, the noble gases.',
  },
  // Biology
  {
    subject: 'Biology',
    topic: 'Plant Biology',
    difficulty: 'EASY',
    text: 'The green pigment in plants that traps light energy is ____.',
    options: ['chlorophyll', 'haemoglobin', 'melanin', 'carotene'],
    correct: 0,
    explanation: 'Chlorophyll absorbs light energy for photosynthesis.',
  },
  {
    subject: 'Biology',
    topic: 'Circulatory System',
    difficulty: 'MEDIUM',
    text: 'Which organ pumps blood round the body?',
    options: ['Lungs', 'Heart', 'Kidney', 'Liver'],
    correct: 1,
    explanation: 'The heart is a muscular pump that circulates blood.',
  },
  // Economics
  {
    subject: 'Economics',
    topic: 'Factors of Production',
    difficulty: 'EASY',
    text: 'The reward for land as a factor of production is ____.',
    options: ['rent', 'wages', 'interest', 'profit'],
    correct: 0,
    explanation: 'Land earns rent; labour earns wages, capital earns interest and enterprise earns profit.',
  },
  {
    subject: 'Economics',
    topic: 'Demand and Supply',
    difficulty: 'MEDIUM',
    text: 'When supply exceeds demand, the price of a commodity tends to ____.',
    options: ['rise', 'fall', 'remain constant', 'double'],
    correct: 1,
    explanation: 'A surplus pushes prices down until supply and demand balance.',
  },
];

const JAMB: SeedQuestion[] = [
  // Mathematics
  {
    subject: 'Mathematics',
    topic: 'Algebra',
    difficulty: 'EASY',
    text: 'Solve for x: 2x + 5 = 17.',
    options: ['4', '6', '11', '22'],
    correct: 1,
    explanation: 'Subtract 5 (2x = 12), then divide by 2 to get x = 6.',
  },
  {
    subject: 'Mathematics',
    topic: 'Algebra',
    difficulty: 'MEDIUM',
    text: 'If 3(x − 2) = 9, what is the value of x?',
    options: ['3', '5', '7', '9'],
    correct: 1,
    explanation: 'Divide by 3 (x − 2 = 3), then add 2 to get x = 5.',
  },
  {
    subject: 'Mathematics',
    topic: 'Number and Numeration',
    difficulty: 'EASY',
    text: 'What is the least common multiple (LCM) of 4 and 6?',
    options: ['10', '12', '18', '24'],
    correct: 1,
    explanation: 'Multiples of 4: 4, 8, 12, … and of 6: 6, 12, … so the LCM is 12.',
  },
  {
    subject: 'Mathematics',
    topic: 'Geometry',
    difficulty: 'MEDIUM',
    text: 'The angles of a triangle are in the ratio 1 : 2 : 3. What is the largest angle?',
    options: ['30°', '60°', '90°', '120°'],
    correct: 2,
    explanation: 'The ratios sum to 6 parts over 180°, so one part is 30° and the largest is 3 × 30° = 90°.',
  },
  {
    subject: 'Mathematics',
    topic: 'Number and Numeration',
    difficulty: 'HARD',
    text: 'Express 0.45 as a fraction in its lowest terms.',
    options: ['45/100', '9/20', '4/5', '5/9'],
    correct: 1,
    explanation: '0.45 = 45/100; dividing both parts by 5 gives 9/20.',
  },
  {
    subject: 'Mathematics',
    topic: 'Statistics',
    difficulty: 'MEDIUM',
    text: 'Find the mean of 2, 4, 6, 8 and 10.',
    options: ['5', '6', '7', '8'],
    correct: 1,
    explanation: 'The sum is 30 and there are 5 numbers, so the mean is 30 ÷ 5 = 6.',
  },
  // English Language
  {
    subject: 'English Language',
    topic: 'Vocabulary',
    difficulty: 'EASY',
    text: 'Choose the word that is nearest in meaning to “abundant”.',
    options: ['scarce', 'plentiful', 'few', 'rare'],
    correct: 1,
    explanation: '“Abundant” means existing in large quantities — “plentiful”.',
  },
  {
    subject: 'English Language',
    topic: 'Grammar',
    difficulty: 'MEDIUM',
    text: 'Choose the option that best completes the sentence: She has been living here ____ 2015.',
    options: ['for', 'since', 'from', 'during'],
    correct: 1,
    explanation: '“Since” is used with a specific point in time for actions continuing to the present.',
  },
  {
    subject: 'English Language',
    topic: 'Grammar',
    difficulty: 'EASY',
    text: 'Choose the correct plural form of “criterion”.',
    options: ['criterions', 'criteria', 'criterias', 'criterion'],
    correct: 1,
    explanation: '“Criterion” is a Greek loanword; its plural is “criteria”.',
  },
  {
    subject: 'English Language',
    topic: 'Vocabulary',
    difficulty: 'MEDIUM',
    text: 'Choose the option opposite in meaning to “frugal”.',
    options: ['thrifty', 'wasteful', 'careful', 'modest'],
    correct: 1,
    explanation: '“Frugal” means economical; its opposite is “wasteful”.',
  },
  // Physics
  {
    subject: 'Physics',
    topic: 'Measurement',
    difficulty: 'EASY',
    text: 'The unit of force in the SI system is the ____.',
    options: ['joule', 'newton', 'watt', 'pascal'],
    correct: 1,
    explanation: 'Force is measured in newtons (N).',
  },
  {
    subject: 'Physics',
    topic: 'Electricity',
    difficulty: 'MEDIUM',
    text: 'Which of the following is a good conductor of electricity?',
    options: ['Rubber', 'Copper', 'Plastic', 'Wood'],
    correct: 1,
    explanation: 'Copper is a metal with free electrons, making it an excellent conductor.',
  },
  {
    subject: 'Physics',
    topic: 'Motion',
    difficulty: 'HARD',
    text: 'A body of mass 5 kg is acted on by a force of 20 N. Find its acceleration.',
    options: ['4 m/s²', '100 m/s²', '0.25 m/s²', '25 m/s²'],
    correct: 0,
    explanation: 'From F = ma, a = F ÷ m = 20 ÷ 5 = 4 m/s².',
  },
  // Chemistry
  {
    subject: 'Chemistry',
    topic: 'Chemical Bonding',
    difficulty: 'EASY',
    text: 'What is the chemical symbol for water?',
    options: ['HO', 'H₂O', 'O₂', 'CO₂'],
    correct: 1,
    explanation: 'A water molecule has two hydrogen atoms and one oxygen atom: H₂O.',
  },
  {
    subject: 'Chemistry',
    topic: 'Periodic Table',
    difficulty: 'MEDIUM',
    text: 'Which of the following is an alkali metal?',
    options: ['Calcium', 'Sodium', 'Iron', 'Zinc'],
    correct: 1,
    explanation: 'Sodium belongs to Group 1, the alkali metals.',
  },
  {
    subject: 'Chemistry',
    topic: 'Atomic Structure',
    difficulty: 'HARD',
    text: 'The number of electrons in a neutral oxygen atom (atomic number 8) is ____.',
    options: ['6', '8', '16', '2'],
    correct: 1,
    explanation: 'A neutral atom has as many electrons as protons, so oxygen has 8 electrons.',
  },
  // Biology
  {
    subject: 'Biology',
    topic: 'Plant Biology',
    difficulty: 'EASY',
    text: 'The process by which green plants make their own food is called ____.',
    options: ['respiration', 'photosynthesis', 'transpiration', 'digestion'],
    correct: 1,
    explanation: 'Photosynthesis uses sunlight, water and carbon dioxide to make glucose in plants.',
  },
  {
    subject: 'Biology',
    topic: 'Living Things',
    difficulty: 'MEDIUM',
    text: 'Which of the following is NOT a characteristic of living things?',
    options: ['Respiration', 'Reproduction', 'Rusting', 'Growth'],
    correct: 2,
    explanation: 'Rusting is a chemical change in metals, not a characteristic of living things.',
  },
  // Economics
  {
    subject: 'Economics',
    topic: 'Basic Concepts',
    difficulty: 'EASY',
    text: 'The study of how scarce resources are allocated is called ____.',
    options: ['economics', 'geography', 'history', 'civics'],
    correct: 0,
    explanation: 'Economics studies the allocation of scarce resources among competing wants.',
  },
  {
    subject: 'Economics',
    topic: 'Market Structure',
    difficulty: 'MEDIUM',
    text: 'A market with a single seller is called a ____.',
    options: ['monopoly', 'oligopoly', 'duopoly', 'perfect market'],
    correct: 0,
    explanation: 'A monopoly exists when one firm supplies the entire market.',
  },
  // Civic Education
  {
    subject: 'Civic Education',
    topic: 'Citizenship',
    difficulty: 'EASY',
    text: 'Which of the following is a civic responsibility of a citizen?',
    options: ['Paying taxes', 'Violating laws', 'Evading tax', 'Ignoring elections'],
    correct: 0,
    explanation: 'Paying taxes is a civic duty that funds public services.',
  },
];

const MOCK: SeedQuestion[] = [
  // Basic Science
  {
    subject: 'Basic Science',
    topic: 'Living Things',
    difficulty: 'EASY',
    text: 'Which of the following is NOT a characteristic of living things?',
    options: ['Respiration', 'Reproduction', 'Rusting', 'Growth'],
    correct: 2,
    explanation: 'Rusting is a chemical change in metals, not a characteristic of living things.',
  },
  {
    subject: 'Basic Science',
    topic: 'Living Things',
    difficulty: 'MEDIUM',
    text: 'The process by which green plants make their own food is called ____.',
    options: ['respiration', 'photosynthesis', 'transpiration', 'digestion'],
    correct: 1,
    explanation: 'Photosynthesis uses sunlight, water and carbon dioxide to make glucose in plants.',
  },
  {
    subject: 'Basic Science',
    topic: 'Matter',
    difficulty: 'EASY',
    text: 'Which state of matter has a definite volume but no definite shape?',
    options: ['Solid', 'Liquid', 'Gas', 'Plasma'],
    correct: 1,
    explanation: 'A liquid keeps a definite volume but takes the shape of its container.',
  },
  {
    subject: 'Basic Science',
    topic: 'Matter',
    difficulty: 'MEDIUM',
    text: 'What is the chemical symbol for water?',
    options: ['HO', 'H₂O', 'O₂', 'CO₂'],
    correct: 1,
    explanation: 'A water molecule contains two hydrogen atoms and one oxygen atom: H₂O.',
  },
  {
    subject: 'Basic Science',
    topic: 'Energy',
    difficulty: 'HARD',
    text: 'Which of the following is a renewable source of energy?',
    options: ['Coal', 'Crude oil', 'Solar', 'Natural gas'],
    correct: 2,
    explanation: 'Solar energy is naturally replenished, unlike fossil fuels such as coal and oil.',
  },
  {
    subject: 'Basic Science',
    topic: 'Measurement',
    difficulty: 'EASY',
    text: 'The instrument used to measure temperature is a ____.',
    options: ['barometer', 'thermometer', 'hygrometer', 'ammeter'],
    correct: 1,
    explanation: 'A thermometer measures temperature.',
  },
  {
    subject: 'Basic Science',
    topic: 'Force',
    difficulty: 'MEDIUM',
    text: 'The force that pulls objects towards the centre of the earth is called ____.',
    options: ['friction', 'magnetism', 'gravity', 'tension'],
    correct: 2,
    explanation: 'Gravity is the attractive force between the earth and objects near it.',
  },
  // Mathematics
  {
    subject: 'Mathematics',
    topic: 'Percentages',
    difficulty: 'EASY',
    text: 'What is 25% of 80?',
    options: ['20', '25', '30', '40'],
    correct: 0,
    explanation: '25% of 80 = 0.25 × 80 = 20.',
  },
  {
    subject: 'Mathematics',
    topic: 'Algebra',
    difficulty: 'MEDIUM',
    text: 'If a = 3 and b = 4, find a² + b².',
    options: ['7', '12', '25', '49'],
    correct: 2,
    explanation: 'a² + b² = 9 + 16 = 25.',
  },
  {
    subject: 'Mathematics',
    topic: 'Geometry',
    difficulty: 'EASY',
    text: 'The perimeter of a square of side 6 cm is ____.',
    options: ['12 cm', '24 cm', '36 cm', '6 cm'],
    correct: 1,
    explanation: 'Perimeter of a square = 4 × side = 4 × 6 = 24 cm.',
  },
  // English Language
  {
    subject: 'English Language',
    topic: 'Grammar',
    difficulty: 'EASY',
    text: 'Choose the correct option: She ____ to school every day.',
    options: ['go', 'goes', 'going', 'gone'],
    correct: 1,
    explanation: 'A singular third-person subject (“she”) takes “goes”.',
  },
  {
    subject: 'English Language',
    topic: 'Vocabulary',
    difficulty: 'MEDIUM',
    text: 'Choose the word that is nearest in meaning to “happy”.',
    options: ['sad', 'glad', 'angry', 'tired'],
    correct: 1,
    explanation: '“Glad” is nearest in meaning to “happy”.',
  },
  {
    subject: 'English Language',
    topic: 'Parts of Speech',
    difficulty: 'EASY',
    text: 'Which of the following words is a noun?',
    options: ['quickly', 'beautiful', 'teacher', 'run'],
    correct: 2,
    explanation: '“Teacher” names a person, so it is a noun.',
  },
  // Civic Education
  {
    subject: 'Civic Education',
    topic: 'Government',
    difficulty: 'EASY',
    text: 'The head of a state government in Nigeria is the ____.',
    options: ['President', 'Governor', 'Senator', 'Chief Judge'],
    correct: 1,
    explanation: 'A state is led by a Governor; the President leads the federation.',
  },
  {
    subject: 'Civic Education',
    topic: 'Citizenship',
    difficulty: 'MEDIUM',
    text: 'Which of the following is a duty of a good citizen?',
    options: ['Obeying laws', 'Breaking laws', 'Littering the environment', 'Evading tax'],
    correct: 0,
    explanation: 'Obeying the law is a fundamental duty of every citizen.',
  },
];

/** The default, per-category plan used to populate a new school. */
export const CBT_SEED_PLAN: SeedCategoryPlan[] = [
  {
    category: 'WAEC',
    mode: 'PRACTICE',
    title: 'WAEC Practice — Mixed Subjects',
    description:
      'Practice questions in the WAEC examination style, covering Mathematics, English, the sciences, Economics and Civic Education.',
    instructions: 'Practice mode: your score, the correct answers and explanations appear as soon as you submit.',
    passMark: 50,
    showCorrectAnswers: true,
    maxAttempts: 3,
    questions: WAEC,
  },
  {
    category: 'NECO',
    mode: 'PRACTICE',
    title: 'NECO Practice — Mixed Subjects',
    description:
      'Practice questions in the NECO examination style, covering Mathematics, English, the sciences and Economics.',
    instructions: 'Practice mode: your score, the correct answers and explanations appear as soon as you submit.',
    passMark: 50,
    showCorrectAnswers: true,
    maxAttempts: 3,
    questions: NECO,
  },
  {
    category: 'JAMB',
    mode: 'PRACTICE',
    title: 'JAMB Practice — Mixed Subjects',
    description:
      'Practice questions in the JAMB UTME style, covering Mathematics, English, the sciences, Economics and Civic Education.',
    instructions: 'Practice mode: your score, the correct answers and explanations appear as soon as you submit.',
    passMark: 50,
    showCorrectAnswers: true,
    maxAttempts: 3,
    questions: JAMB,
  },
  {
    category: 'MOCK',
    mode: 'MOCK',
    title: 'Mock Examination — General Paper',
    description:
      'A timed school mock examination. It ships with default questions and you can add, remove or replace them with your own.',
    instructions:
      'Answer every question. Correct answers are withheld until the school releases them. The examination submits automatically when the timer reaches zero.',
    passMark: 50,
    showCorrectAnswers: false,
    maxAttempts: 1,
    questions: MOCK,
  },
];

/** Roughly 1.5 minutes per question, floored at 10 and capped at 120. */
export function defaultDurationMinutes(questionCount: number): number {
  return Math.min(120, Math.max(10, Math.ceil(questionCount * 1.5)));
}
