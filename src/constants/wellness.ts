// Shared constants for wellness wheel assessment and visualization

export const categories = [
  {
    name: 'SPIRITUAL',
    description: 'Your values, beliefs, and what gives your life meaning',
    color: '#9CA3AF',
    icon: '🧘'
  },
  {
    name: 'PRACTICAL',
    description: 'Your skills, work, and how you get things done',
    color: '#3B82F6',
    icon: '⚙️'
  },
  {
    name: 'RELATIONAL',
    description: 'Your relationships with family, friends, and community',
    color: '#EC4899',
    icon: '👥'
  },
  {
    name: 'MENTAL',
    description: 'Your thoughts, emotions, and mental wellbeing',
    color: '#8B5CF6',
    icon: '🧠'
  },
  {
    name: 'PHYSICAL',
    description: 'Your health, fitness, and how you care for your body',
    color: '#EF4444',
    icon: '💪'
  },
  {
    name: 'BEHAVIORAL',
    description: 'Your daily habits, routines, and how you spend your time',
    color: '#10B981',
    icon: '🎯'
  },
  {
    name: 'FINANCIAL',
    description: 'Your money, resources, and financial situation',
    color: '#F59E0B',
    icon: '💰'
  }
];

export const rings = [
  { name: 'EMPIRICAL', color: '#6B7280', radius: 180, description: 'Current state and facts' },
  { name: 'SITUATIONAL', color: '#3B82F6', radius: 300, description: 'Changes and current circumstances' },
  { name: 'ASPIRATIONAL', color: '#8B5CF6', radius: 460, description: 'Goals and future vision' }
];

export const questions = {
  SPIRITUAL: {
    empirical: {
      title: "Your Current Values & Beliefs",
      prompt: "What are the most important values that guide your life right now? What do you believe in or care deeply about?",
      placeholder: "e.g., Family comes first, honesty matters, helping others..."
    },
    situational: {
      title: "Spiritual Changes You're Going Through",
      prompt: "Are you questioning anything about your beliefs or values lately? Is your sense of purpose shifting or changing?",
      placeholder: "e.g., Wondering what I want to do with my life, feeling lost after graduation..."
    },
    aspirational: {
      title: "Your Spiritual Goals",
      prompt: "How do you want to grow spiritually? What kind of person do you hope to become? What legacy do you want to leave?",
      placeholder: "e.g., Want to be more at peace, help more people, live with less stress..."
    }
  },
  PRACTICAL: {
    empirical: {
      title: "Your Current Skills & Work",
      prompt: "What are you good at? What skills do you have? How do you currently spend your work or school time?",
      placeholder: "e.g., Good at math, creative writing, coding, managing people..."
    },
    situational: {
      title: "Work/School Changes Happening Now",
      prompt: "What's changing in your work or school life? Are you learning new things or dealing with new challenges?",
      placeholder: "e.g., Starting college, changing jobs, learning new software..."
    },
    aspirational: {
      title: "Your Career & Skill Goals",
      prompt: "What do you want to become good at? What kind of work do you want to do? What would make you feel accomplished?",
      placeholder: "e.g., Want to start my own business, become a teacher, master guitar..."
    }
  },
  RELATIONAL: {
    empirical: {
      title: "Your Current Relationships",
      prompt: "Who are the most important people in your life? How would you describe your relationships with family and friends?",
      placeholder: "e.g., Close with my mom, have 3 best friends, dating someone special..."
    },
    situational: {
      title: "Relationship Changes Right Now",
      prompt: "Are any of your relationships going through changes? New friendships, family drama, or relationship challenges?",
      placeholder: "e.g., Parents getting divorced, made new friends, having conflicts with siblings..."
    },
    aspirational: {
      title: "Your Relationship Goals",
      prompt: "How do you want your relationships to be? What kind of friend, family member, or partner do you want to become?",
      placeholder: "e.g., Want to be more supportive, find my life partner, reconnect with old friends..."
    }
  },
  MENTAL: {
    empirical: {
      title: "Your Mental State Right Now",
      prompt: "How do you generally feel mentally and emotionally? What's your typical mood and stress level?",
      placeholder: "e.g., Usually pretty happy, sometimes anxious about school, feel confident most days..."
    },
    situational: {
      title: "Mental Health Changes You're Facing",
      prompt: "Are you dealing with any stress, anxiety, sadness, or big emotions right now? What's affecting your mental health?",
      placeholder: "e.g., Stressed about college applications, sad about moving away, excited but nervous..."
    },
    aspirational: {
      title: "Your Mental Wellness Goals",
      prompt: "How do you want to feel mentally and emotionally? What would better mental health look like for you?",
      placeholder: "e.g., Want to worry less, be more confident, handle stress better..."
    }
  },
  PHYSICAL: {
    empirical: {
      title: "Your Current Physical Health",
      prompt: "How is your health right now? What does your fitness, eating, and sleep look like on a typical day?",
      placeholder: "e.g., Pretty healthy, play soccer twice a week, eat too much junk food, sleep 7 hours..."
    },
    situational: {
      title: "Physical Changes Happening Now",
      prompt: "Are you dealing with any health issues, injuries, or changes in your body? Trying to change any habits?",
      placeholder: "e.g., Recovering from knee injury, trying to eat healthier, going through growth spurt..."
    },
    aspirational: {
      title: "Your Health & Fitness Goals",
      prompt: "How do you want to feel in your body? What physical goals do you have for yourself?",
      placeholder: "e.g., Want to be stronger, run a marathon, feel more energetic, eat better..."
    }
  },
  BEHAVIORAL: {
    empirical: {
      title: "Your Current Habits & Routines",
      prompt: "What does a typical day look like for you? What habits and routines do you have (good and bad)?",
      placeholder: "e.g., Wake up at 7am, scroll phone for an hour, study after dinner, go to bed late..."
    },
    situational: {
      title: "Behavior Changes You're Working On",
      prompt: "Are you trying to change any habits right now? What behaviors are you working on or struggling with?",
      placeholder: "e.g., Trying to quit biting nails, spending less time on social media, being more organized..."
    },
    aspirational: {
      title: "Your Lifestyle Goals",
      prompt: "What habits do you want to build? How do you want to spend your time when you have complete freedom to choose?",
      placeholder: "e.g., Want to read more, exercise daily, be more organized, travel the world..."
    }
  },
  FINANCIAL: {
    empirical: {
      title: "Your Current Money Situation",
      prompt: "What's your financial situation right now? Do you earn money, have savings, or depend on others financially?",
      placeholder: "e.g., Have a part-time job, parents pay for everything, saved $500 from birthday money..."
    },
    situational: {
      title: "Money Changes Happening Now",
      prompt: "Are there any money pressures or changes in your financial life? New expenses, job changes, or financial stress?",
      placeholder: "e.g., Need to pay for college, parents lost job, got first credit card..."
    },
    aspirational: {
      title: "Your Financial Goals",
      prompt: "What are your money goals? How do you want your financial life to look in the future?",
      placeholder: "e.g., Want to be financially independent, save for a house, not worry about money..."
    }
  }
};
