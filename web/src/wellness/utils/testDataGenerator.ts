// Test data generator for wellness assessment
// This provides realistic sample responses for demonstration purposes

export const generateTestData = (userName: string = 'User'): Record<string, string> => {
  return {
    // SPIRITUAL
    "SPIRITUAL_empirical": `I value authenticity, compassion, and personal growth. I believe in treating others with kindness and finding meaning in everyday moments. My faith in humanity and the power of positive change guides my decisions.`,
    "SPIRITUAL_situational": `I'm currently questioning my career path and wondering if I'm making the impact I want in the world. Feeling a bit disconnected from my spiritual practices lately, but trying to reconnect through meditation and nature walks.`,
    "SPIRITUAL_aspirational": `I want to become someone who inspires others through my actions, not just words. I hope to find deeper peace and contentment, and leave a legacy of helping people discover their own potential.`,

    // PRACTICAL
    "PRACTICAL_empirical": `I have strong analytical skills and 8 years of experience in project management. I'm good at organizing complex information and leading teams through challenging situations. I use tools like Notion, Slack, and various project management software daily.`,
    "PRACTICAL_situational": `I'm learning new software for data analysis and trying to improve my public speaking skills. My company is going through restructuring, so I'm adapting to new processes and team dynamics.`,
    "PRACTICAL_aspirational": `I want to become an expert in data-driven decision making and eventually start my own consulting business. I'd love to master advanced Excel, learn Python, and develop leadership skills that inspire confidence.`,

    // RELATIONAL
    "RELATIONAL_empirical": `I have a close relationship with my partner of 5 years, and we're planning to get married next year. I'm very close with my parents and have 3 best friends I've known since college. I have a good relationship with most of my colleagues.`,
    "RELATIONAL_situational": `My partner and I are discussing moving to a new city for my job, which is creating some tension. I'm also trying to reconnect with an old friend I had a falling out with. Work relationships are changing due to the restructuring.`,
    "RELATIONAL_aspirational": `I want to be a more patient and understanding partner, and improve my communication skills in all relationships. I hope to build a strong network of professional contacts and become someone others can rely on for support.`,

    // MENTAL
    "MENTAL_empirical": `I generally feel optimistic and motivated, though I do experience occasional anxiety about work deadlines. I'm pretty good at managing stress through exercise and talking things out with friends. I tend to overthink decisions sometimes.`,
    "MENTAL_situational": `I'm feeling more stressed than usual due to the job uncertainty and relationship changes. Sometimes I have trouble sleeping because my mind races with all the decisions I need to make. I'm working on mindfulness techniques.`,
    "MENTAL_aspirational": `I want to develop better emotional regulation and reduce my tendency to worry. I'd love to feel more confident in my decisions and develop a stronger sense of inner peace. I want to be more present in daily life.`,

    // PHYSICAL
    "PHYSICAL_empirical": `I'm generally healthy with no major medical issues. I exercise 3-4 times a week (mostly cardio and some strength training). I try to eat balanced meals but sometimes skip breakfast when I'm rushed. I get about 7 hours of sleep most nights.`,
    "PHYSICAL_situational": `I've been dealing with some lower back pain from sitting at my desk too much. I'm trying to improve my posture and take more movement breaks. I also want to cut back on my coffee consumption (currently 3-4 cups per day).`,
    "PHYSICAL_aspirational": `I want to build more strength and flexibility, maybe try yoga or pilates. I'd love to run a 5K race and develop better eating habits. I want to feel more energetic throughout the day and improve my overall fitness level.`,

    // BEHAVIORAL
    "BEHAVIORAL_empirical": `I usually wake up at 7 AM, check emails first thing, work until lunch, take a 30-minute break, work until 6 PM, then exercise or spend time with my partner. I have a habit of checking my phone too frequently and sometimes procrastinate on difficult tasks.`,
    "BEHAVIORAL_situational": `I'm trying to establish a morning routine that includes meditation and planning my day. I'm working on reducing my social media usage and being more intentional about how I spend my free time. I'm also trying to read more books.`,
    "BEHAVIORAL_aspirational": `I want to develop a consistent morning routine that sets me up for success. I'd love to read 2 books per month, practice gratitude daily, and become more organized with my time. I want to be someone who follows through on commitments.`,

    // FINANCIAL
    "FINANCIAL_empirical": `I have a stable job with a good salary and contribute 15% to my 401k. I have about $25k in savings and $15k in student loan debt. I live within my means but could be better about tracking my spending. I have a good credit score.`,
    "FINANCIAL_situational": `I'm saving for a down payment on a house and trying to pay off my student loans faster. The job uncertainty is making me more cautious about big purchases. I'm also considering starting a side hustle for extra income.`,
    "FINANCIAL_aspirational": `I want to be completely debt-free within 3 years and have 6 months of emergency savings. I'd love to start investing more aggressively and eventually achieve financial independence. I want to be someone who makes smart financial decisions.`
  };
};

// Generate a random name for demo purposes
export const generateRandomName = (): string => {
  const names = [
    'Alex', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Morgan', 'Quinn', 'Avery', 'Blake', 'Cameron',
    'Drew', 'Emery', 'Finley', 'Gray', 'Harper', 'Indigo', 'Jamie', 'Kendall', 'Logan', 'Mason'
  ];
  return names[Math.floor(Math.random() * names.length)];
};
