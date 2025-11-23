import React, { useState, useMemo, useEffect } from 'react';
import { Circle, Target, Star, X } from 'lucide-react';
import { wellnessFirebaseService } from '../services/wellnessFirebaseService';

// Default sample data for demonstration
const defaultResponses: Record<string, string> = {
  "EMPIRICAL_SPIRITUAL_0": "I value clarity, peace, ease, consideration, security",
  "EMPIRICAL_SPIRITUAL_1": "Do things that count, Prioritize quality time with loved ones, truth-seek, self-improvement",
  "EMPIRICAL_SPIRITUAL_2": "Constantly learning, improving myself, being present for important people in my life",
  "EMPIRICAL_PRACTICAL_0": "20+ years in product development, healthcare, wellness, AI",
  "EMPIRICAL_PRACTICAL_1": "Tana PKM, AI, Cursor. I try to learn, synthesize, apply as much knowledge and insight as I can",
  "EMPIRICAL_PRACTICAL_2": "Learn, Think, Do, Measure, repeat",
  "EMPIRICAL_RELATIONAL_0": "15yrs long-term relationship with Sally (girlfriend and mother of 1 daughter). 2 daughters (Ella and Sasha from prior marriage with Dom), 2 step-daughters (Colette and Allison - Sally's daughters from prior marriage with Will). Mom, 89, lives in Maryland with her brother. I have one older brother, Sean (60) and one older sister, Jenny (57).",
  "EMPIRICAL_RELATIONAL_1": "Day to day, it's Sally and Ivy as the other girls at off at college. I have many close cousins in Maryland. My best friend Brett is nearby. My childhood friends, Jon, Drew and Frank live far away, but we text frequently.",
  "EMPIRICAL_RELATIONAL_2": "These days it's mostly text messages, but I make a point to see them in person yearly. I go to Maryland a few times a year to see my mom and cousins.",
  "EMPIRICAL_MENTAL_0": "No history of mental illness. Pretty good,I think I have a high degree of resilience.",
  "EMPIRICAL_MENTAL_1": "I tend to take deep breaths to calm myself and focus on addressing what i can control.",
  "EMPIRICAL_MENTAL_2": "I like to synthesize what i learn into what I already know or think and see what new ideas or thoughts come out of that",
  "EMPIRICAL_PHYSICAL_0": "Weight 169, A1C 5.7. Prediabetes.",
  "EMPIRICAL_PHYSICAL_1": "strength training 3-5 days a week. no cario besides light walking.",
  "EMPIRICAL_PHYSICAL_2": "mostly low-carb, high-protein diet. sleeping 5-7 hours per night",
  "EMPIRICAL_BEHAVIORAL_0": "coffee and deep thinking / work in the early morning (5-7am) breakfast with Sally (one-egg, cream cheese, smoked salmon, keto biscuit, sriracha) work until 11:30am lunch coffee after lunch work until 3:30pm snack (decaf coffee and a sweet) workout / help with Ivy, stuff at home until dinner time wind-down routine starts with shower around 9pm bedtime by 10pm",
  "EMPIRICAL_BEHAVIORAL_1": "learning, sythesizing, organizing, watching movies and spending time with family",
  "EMPIRICAL_BEHAVIORAL_2": "learning, sythesizing, organizing, watching movies and spending time with family",
  "EMPIRICAL_FINANCIAL_0": "$5M+ total assets. ($3.2M liquid, $1.8M in real estate)",
  "EMPIRICAL_FINANCIAL_1": "Recently retired. $120k left to pay for Sasha's college. $60k/yr household expenses. $25k/yr Ivy's educational expenses",
  "EMPIRICAL_FINANCIAL_2": "Mostly self-manage. $1M under financial advisor",
  "SITUATIONAL_SPIRITUAL_0": "Just left my job after 8 years after achieving pinnacle of product career (CPO). Who am I without that work anchoring me?",
  "SITUATIONAL_SPIRITUAL_1": "Nothing major, seem durable_",
  "SITUATIONAL_SPIRITUAL_2": "More inward reflection using AI as a therapist",
  "SITUATIONAL_PRACTICAL_0": "Major change. Left company after 8 years. Was Chief Product Officer. Kind of retiring, but I think of it as re-factoring/re-desiging",
  "SITUATIONAL_PRACTICAL_1": "Using all the same ones, but trying to do so in a more synthesized/integrated way",
  "SITUATIONAL_PRACTICAL_2": "Re-designing my life!",
  "SITUATIONAL_RELATIONAL_0": "Thankfully, very few. All of them are relatively strong. I wish I could talk with Ella more often. Ivy is 12 going on 13 so it's just giving her space for strong and big feelings.",
  "SITUATIONAL_RELATIONAL_1": "Would like to find ways to rebase my Vida work relationships into post-work friendships or stay connected with them",
  "SITUATIONAL_RELATIONAL_2": "Would like to connect more with the SF AI community",
  "SITUATIONAL_MENTAL_0": "Big life transition from focus on achievement to focus on fulfillment",
  "SITUATIONAL_MENTAL_1": "I'm sure there is a bunch of underlying stress, anxiety and mood changes from the big transition, I'm not totally aware of them all",
  "SITUATIONAL_MENTAL_2": "Nothing new at the moment",
  "SITUATIONAL_PHYSICAL_0": "Nothing specific.",
  "SITUATIONAL_PHYSICAL_1": "Had a frozen shoulder that is much better; just need to keep regularly stretching so it doesn't tighten up.",
  "SITUATIONAL_PHYSICAL_2": "Just be diligent to what I'm already doing",
  "SITUATIONAL_BEHAVIORAL_0": "Cut out the high-carb snacking, especially while watching TV/Movies",
  "SITUATIONAL_BEHAVIORAL_1": "None",
  "SITUATIONAL_BEHAVIORAL_2": "None",
  "SITUATIONAL_FINANCIAL_0": "Loss of recurring paycheck. Severance package will cover me through Feb of next year",
  "SITUATIONAL_FINANCIAL_1": "Electronics upgrade year - my iphone, daughters laptop",
  "SITUATIONAL_FINANCIAL_2": "Reduce unnecessary spending, especially recurring or large purchases",
  "ASPIRATIONAL_SPIRITUAL_0": "Achieve my goals of ease, clarity, peace, contentment",
  "ASPIRATIONAL_SPIRITUAL_1": "Leverage my skills, experience, interests with helping to improve myself, my loved ones and others (especially adolescents)",
  "ASPIRATIONAL_SPIRITUAL_2": "That others say and think of me the way my team did when I left Vida. Just immense gratitude for being a leader, honest, caring about them and supporting them as individuals.",
  "ASPIRATIONAL_PRACTICAL_0": "Create an entire viable company as 1 person with an AI workforce that generates $50k/yr in profit",
  "ASPIRATIONAL_PRACTICAL_1": "Mostly me and AI as my company, but with a lot of human interactions for knowledge sharing and comparing notes with others trying to do the same.",
  "ASPIRATIONAL_PRACTICAL_2": "Something that takes all of my experience, skills, knowledge and interests and turns it into something useful, valuable and sustainable so that my life is spent both improving myself and generating greater wealth to support my loved ones.",
  "ASPIRATIONAL_RELATIONAL_0": "Focus on immediate relationships with Sally and Ivy",
  "ASPIRATIONAL_RELATIONAL_1": "Want Sally to see me as her trusted and loved life partner. Essentially as I view her. Want to continue to deepen my relationship with Ivy, best support her as she goes through adolescense. Share and hope she wants to receive my insights, learnings and knowedge. Just enjoy quality time with her.",
  "ASPIRATIONAL_RELATIONAL_2": "That they felt I had a positive impact in their lives and I inspired them to be better people",
  "ASPIRATIONAL_MENTAL_0": "Continue on my path",
  "ASPIRATIONAL_MENTAL_1": "Solid system and framework for integrating and applying or making it real. Inisghts to actions.",
  "ASPIRATIONAL_MENTAL_2": "Cultivate regulating emotions and mindful awareness",
  "ASPIRATIONAL_PHYSICAL_0": "Bodyfat < 15%, add 10lb lean muscle mass. A1C < 5.7.",
  "ASPIRATIONAL_PHYSICAL_1": "no pain, aesthetically pleasing, functional for my interests (surf, snowboard, workout, help around house, parent and ultimately as a grand-parent)",
  "ASPIRATIONAL_PHYSICAL_2": "All. Greater balance and overall strength.",
  "ASPIRATIONAL_BEHAVIORAL_0": "Maybe socialize more with friends. Now that not working, don't want to become socially isolated or overly rely on Sally as my social outlet.",
  "ASPIRATIONAL_BEHAVIORAL_1": "Working on my 1 person company AI project.",
  "ASPIRATIONAL_BEHAVIORAL_2": "Learn, apply, create, make money",
  "ASPIRATIONAL_FINANCIAL_0": "Financial independence, retire early (FIRE). I think I'm there, but I need to kind of live to belive it. Part of me is still nervous that I need more, more, more.",
  "ASPIRATIONAL_FINANCIAL_1": "Enable me to live without thinking or worrying about it",
  "ASPIRATIONAL_FINANCIAL_2": "Would like to leave ~$2m / child in assets"
};

interface WellnessWheelProps {
  customResponses?: Record<string, string>;
  userName?: string;
  userId?: string;
  userData?: UserData;
}

interface Dimension {
  name: string;
  color: string;
  icon: string;
  description: string;
}

interface Ring {
  name: string;
  color: string;
  radius: number;
  icon: React.ComponentType<any>;
}

interface Response {
  question: string;
  response: string;
  ring: string;
  dimension: string;
}

const dimensions: Dimension[] = [
  { name: 'SPIRITUAL', color: '#9CA3AF', icon: '🧘', description: 'Who you are and what you value' },
  { name: 'PRACTICAL', color: '#3B82F6', icon: '⚙️', description: 'How you perform' },
  { name: 'RELATIONAL', color: '#EC4899', icon: '👥', description: 'How you relate' },
  { name: 'MENTAL', color: '#8B5CF6', icon: '🧠', description: 'How you think and feel' },
  { name: 'PHYSICAL', color: '#EF4444', icon: '💪', description: 'How you care for your body' },
  { name: 'BEHAVIORAL', color: '#10B981', icon: '🎯', description: 'What you do' },
  { name: 'FINANCIAL', color: '#F59E0B', icon: '💰', description: 'What you have' }
];

const rings: Ring[] = [
  { name: 'EMPIRICAL', color: '#6B7280', radius: 220, icon: Circle },
  { name: 'SITUATIONAL', color: '#3B82F6', radius: 320, icon: Target },
  { name: 'ASPIRATIONAL', color: '#8B5CF6', radius: 420, icon: Star },
  { name: 'FRAMEWORK', color: '#059669', radius: 500, icon: Star }
];

  const WellnessWheel: React.FC<WellnessWheelProps> = ({ customResponses = {}, userName, userId, userData }) => {
    const [selectedWedge, setSelectedWedge] = useState<string | null>(null);
    const [hoveredWedge, setHoveredWedge] = useState<string | null>(null);
    const [summaries, setSummaries] = useState<Record<string, string>>({});
    const [isGeneratingSummaries, setIsGeneratingSummaries] = useState(false);


  const generateResults = useMemo(() => {
    const resultsByRing: Record<string, Record<string, Response[]>> = {
      EMPIRICAL: {},
      SITUATIONAL: {},
      ASPIRATIONAL: {},
      FRAMEWORK: {}
    };

    // Use custom responses if available, otherwise fall back to default
    const responsesToUse = Object.keys(customResponses).length > 0 ? customResponses : defaultResponses;

    rings.forEach(ring => {
      resultsByRing[ring.name] = {};
      dimensions.forEach(dim => {
        resultsByRing[ring.name][dim.name] = [];
        
        for (let i = 0; i < 3; i++) {
          const responseKey = `${ring.name}_${dim.name}_${i}`;
          const response = responsesToUse[responseKey];
          
          if (response && response.trim()) {
            resultsByRing[ring.name][dim.name].push({
              question: `Question ${i + 1}`,
              response,
              ring: ring.name,
              dimension: dim.name
            });
          }
        }
      });
    });

    return resultsByRing;
  }, [customResponses]);

  // Effect to load or generate summaries using the shared service
  useEffect(() => {
    const loadOrGenerateSummaries = async () => {
      if (!userId || !userData || Object.keys(generateResults).length === 0) {
        setSummaries({});
        return;
      }

      // First, try to load existing summaries from userData
      if (userData.summaries && Object.keys(userData.summaries).length > 0) {
        // Use existing summaries
        setSummaries(userData.summaries);
        return;
      }

      // If no existing summaries, generate new ones
      setIsGeneratingSummaries(true);
      
      try {
        // Import the service dynamically
        const { oauthVertexAIService } = await import('../services/oauth-vertex-ai');
        
        // Generate summaries for all ring/dimension combinations
        const summaryPromises: Promise<{ key: string; summary: string }>[] = [];
        
        rings.slice(0, 3).forEach((ring, ringIndex) => {
          dimensions.forEach((dimension) => {
            const responses = generateResults[ring.name][dimension.name];
            if (responses && responses.length > 0) {
              const request = {
                responses: responses.map(r => ({
                  question: r.question,
                  response: r.response,
                  ring: r.ring,
                  dimension: r.dimension
                })),
                ringName: ring.name,
                dimensionName: dimension.name,
                maxLength: ringIndex === 0 ? 80 : ringIndex === 1 ? 100 : 120
              };
              
              summaryPromises.push(
                oauthVertexAIService.summarizeWellnessResponses(request)
                  .then(result => ({
                    key: `${ring.name}_${dimension.name}`,
                    summary: result.summary
                  }))
              );
            }
          });
        });
        
        // Wait for all summaries to complete
        const results = await Promise.all(summaryPromises);
        
        // Update state with all summaries
        const newSummaries: Record<string, string> = {};
        results.forEach(({ key, summary }) => {
          newSummaries[key] = summary;
        });
        
        setSummaries(newSummaries);

        // Save summaries to user data
        if (userData) {
          const updatedUserData = {
            ...userData,
            summaries: newSummaries,
            lastUpdated: new Date().toISOString()
          };
          await wellnessFirebaseService.saveUser(updatedUserData);
        }
        
      } catch (error) {
        console.error('Error generating summaries:', error);
      } finally {
        setIsGeneratingSummaries(false);
      }
    };
    
    loadOrGenerateSummaries();
  }, [generateResults, userId, userData]);

  const createCurvedWrappedText = (text: string, startAngle: number, endAngle: number, radius: number, maxWidth: number, ringIndex: number = 2, dimensionName?: string): React.ReactNode => {
    // First split by newlines, then by words
    const newlineSplit = text.split('\n');
    const lines: string[] = [];
    
    // Adjust font size based on ring index for better readability
    const fontSize = ringIndex === 0 ? 11 : ringIndex === 1 ? 12 : ringIndex === 2 ? 14 : 14;
    
    // Calculate the actual arc length available for text
    const arcAngle = endAngle - startAngle;
    const arcLength = (radius * arcAngle * Math.PI) / 180;
    const availableWidth = arcLength * 0.65; // Use 65% of the arc length to give more margin from outer border
    
    // Process each newline-separated section
    newlineSplit.forEach(section => {
      if (section.trim() === '') {
        lines.push(''); // Empty line for spacing
        return;
      }
      
      const words = section.split(' ');
      let currentLine = '';
      
      // Split text into lines that fit within the available arc width
      words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = testLine.length * fontSize * 0.6; // Approximate character width
        
        if (testWidth > availableWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });
      
      if (currentLine) {
        lines.push(currentLine);
      }
    });
    
    // Create curved text paths for each line
    const lineSpacing = fontSize + 2; // Adjust spacing based on font size
    const totalHeight = lines.length * lineSpacing;
    const startOffset = -totalHeight / 2 + lineSpacing / 2;
    
    return lines.map((line, index) => {
      // Reverse the line order so first line appears at the top
      const reversedIndex = lines.length - 1 - index;
      const lineRadius = radius + startOffset + reversedIndex * lineSpacing;
      const pathId = `curvedPath-${Math.random()}`;
      
      // Create a path that ensures text flows in the correct direction
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
      
      const x1 = 600 + lineRadius * Math.cos(startRad);
      const y1 = 600 + lineRadius * Math.sin(startRad);
      const x2 = 600 + lineRadius * Math.cos(endRad);
      const y2 = 600 + lineRadius * Math.sin(endRad);
      
      const pathData = `M ${x1} ${y1} A ${lineRadius} ${lineRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
      
      return (
        <g key={index}>
          <defs>
            <path
              id={pathId}
              d={pathData}
              fill="none"
            />
          </defs>
          <text>
            <textPath
              href={`#${pathId}`}
              startOffset="15%"
              textAnchor="start"
              fill="white"
              fontSize={fontSize}
              fontWeight="bold"
              spacing="auto"
            >
              {line}
            </textPath>
          </text>
        </g>
      );
    });
  };

  const renderWedge = (ring: Ring, dimension: Dimension, ringIndex: number, dimIndex: number) => {
    const startAngle = (dimIndex * 360) / dimensions.length - 90;
    const endAngle = ((dimIndex + 1) * 360) / dimensions.length - 90;
    
    const innerRadius = ringIndex === 0 ? 50 : rings[ringIndex - 1].radius;
    const outerRadius = ring.radius;
    
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = 600 + innerRadius * Math.cos(startRad);
    const y1 = 600 + innerRadius * Math.sin(startRad);
    const x2 = 600 + outerRadius * Math.cos(startRad);
    const y2 = 600 + outerRadius * Math.sin(startRad);
    const x3 = 600 + outerRadius * Math.cos(endRad);
    const y3 = 600 + outerRadius * Math.sin(endRad);
    const x4 = 600 + innerRadius * Math.cos(endRad);
    const y4 = 600 + innerRadius * Math.sin(endRad);
    
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    
    const pathData = [
      `M ${x1} ${y1}`,
      `L ${x2} ${y2}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x3} ${y3}`,
      `L ${x4} ${y4}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1} ${y1}`,
      'Z'
    ].join(' ');

    const hasContent = generateResults[ring.name][dimension.name].length > 0;
    const wedgeId = `${ring.name}-${dimension.name}`;
    const isHovered = hoveredWedge === wedgeId;

    // Get the summary from our state, or use a placeholder
    const summary = summaries[`${ring.name}_${dimension.name}`] || (isGeneratingSummaries ? 'Generating...' : 'No summary available');

    const textRadius = innerRadius + (outerRadius - innerRadius) * 0.6;

    // Calculate text width for wrapping
    const wedgeWidth = (outerRadius - innerRadius) * Math.sin((endAngle - startAngle) * Math.PI / 360);
    const maxTextWidth = wedgeWidth * 0.7; // Leave more margin

    return (
      <g key={wedgeId}>
        <path
          d={pathData}
          fill={hasContent ? dimension.color : '#F3F4F6'}
          stroke="white"
          strokeWidth="2"
          opacity={hasContent ? (isHovered ? 1 : 0.8) : 0.3}
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => setHoveredWedge(wedgeId)}
          onMouseLeave={() => setHoveredWedge(null)}
          onClick={() => setSelectedWedge(wedgeId)}
        />
        
        {hasContent && (
          <g>
            {/* Apply curved text to all rings */}
            {createCurvedWrappedText(summary, startAngle, endAngle, textRadius, maxTextWidth, ringIndex, dimension.name)}
          </g>
        )}
      </g>
    );
  };

  const createFrameworkWedge = (dimension: Dimension, dimIndex: number) => {
    const startAngle = (dimIndex * 360) / dimensions.length - 90;
    const endAngle = ((dimIndex + 1) * 360) / dimensions.length - 90;
    
    const innerRadius = 420; // ASPIRATIONAL ring radius
    const outerRadius = 500; // FRAMEWORK ring radius
    
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = 600 + innerRadius * Math.cos(startRad);
    const y1 = 600 + innerRadius * Math.sin(startRad);
    const x2 = 600 + outerRadius * Math.cos(startRad);
    const y2 = 600 + outerRadius * Math.sin(startRad);
    const x3 = 600 + outerRadius * Math.cos(endRad);
    const y3 = 600 + outerRadius * Math.sin(endRad);
    const x4 = 600 + innerRadius * Math.cos(endRad);
    const y4 = 600 + innerRadius * Math.sin(endRad);
    
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    
    const pathData = [
      `M ${x1} ${y1}`,
      `L ${x2} ${y2}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x3} ${y3}`,
      `L ${x4} ${y4}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1} ${y1}`,
      'Z'
    ].join(' ');

    const textRadius = innerRadius + (outerRadius - innerRadius) * 0.6;
    const frameworkText = `${dimension.name}\n${dimension.description}`;

    return (
      <g key={`framework-${dimension.name}`}>
        <path
          d={pathData}
          fill={dimension.color}
          stroke="white"
          strokeWidth="2"
          opacity="0.9"
        />
        {createCurvedWrappedText(frameworkText, startAngle, endAngle, textRadius, 200, 3, dimension.name)}
      </g>
    );
  };

  const renderModal = () => {
    if (!selectedWedge) return null;
    
    const [ringName, dimensionName] = selectedWedge.split('-');
    const ring = rings.find(r => r.name === ringName);
    const dimension = dimensions.find(d => d.name === dimensionName);
    
    if (!ring || !dimension) return null;
    
    const responses = generateResults[ringName][dimensionName];

    const summary = summaries[`${ringName}_${dimensionName}`] || 'No summary available';

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div 
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: dimension.color }}
                />
                <h3 className="text-xl font-bold text-gray-800">
                  {ring.name} - {dimension.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedWedge(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            
            {/* Summary Section */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-lg font-semibold text-gray-700 mb-2">Summary</h4>
              <p className="text-gray-800 leading-relaxed">{summary}</p>
            </div>
            
            {/* Full Responses Section */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-gray-700 mb-3">Full Responses</h4>
              {responses.map((item, idx) => (
                <div key={idx} className="border-l-4 pl-4" style={{ borderColor: dimension.color }}>
                  <div className="text-sm text-gray-600 mb-1 italic">
                    {item.question}
                  </div>
                  <div className="text-gray-800 leading-relaxed">
                    {item.response}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 text-center">
          <h2 className="text-2xl font-bold text-gray-800">Your Wellness Wheel</h2>
          <p className="text-gray-600 text-sm">
            A three-dimensional view of your life design landscape
          </p>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="relative w-[1000px] h-[1000px] mx-auto">
            <svg viewBox="0 0 1200 1200" className="w-full h-full">
              {rings.map((ring, ringIdx) => (
                <circle
                  key={ring.name}
                  cx="600"
                  cy="600"
                  r={ring.radius}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth="2"
                  opacity="0.3"
                />
              ))}
              
              {rings.slice(0, 3).map((ring, ringIndex) =>
                dimensions.map((dimension, dimIndex) =>
                  renderWedge(ring, dimension, ringIndex, dimIndex)
                )
              )}

              {/* Framework ring with dimension labels and descriptions */}
              {dimensions.map((dimension, dimIndex) =>
                createFrameworkWedge(dimension, dimIndex)
              )}

              {rings.map((ring, idx) => (
                <text
                  key={`ring-label-${ring.name}`}
                  x="600"
                  y={600 - ring.radius - 10}
                  fontSize="12"
                  fontWeight="bold"
                  fill={ring.color}
                  textAnchor="middle"
                >
                  {ring.name}
                </text>
              ))}
              
              {/* User name in center */}
              <circle cx="600" cy="600" r="50" fill="white" stroke="#E5E7EB" strokeWidth="2"/>
              {userName ? (
                <text
                  x="600"
                  y="600"
                  fontSize="16"
                  fontWeight="bold"
                  fill="#374151"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {userName}
                </text>
              ) : (
                <text
                  x="600"
                  y="600"
                  fontSize="14"
                  fontWeight="normal"
                  fill="#6B7280"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  Your Name
                </text>
              )}
            </svg>
          </div>
        </div>



        {renderModal()}
      </div>
    </div>
  );
};

export default WellnessWheel;
