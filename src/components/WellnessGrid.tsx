import React, { useState, useMemo, useEffect } from 'react';
import { Circle, Target, Star, X, Edit3, Check } from 'lucide-react';
import { summaryStorageService, UserData } from '../services/summaryStorage';

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

interface WellnessGridProps {
  customResponses?: Record<string, string>;
  userName?: string;
  userId?: string | null;
  userData?: UserData | null;
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
  icon: React.ComponentType<any>;
  description: string;
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
  { name: 'EMPIRICAL', color: '#6B7280', icon: Circle, description: 'Current state and facts' },
  { name: 'SITUATIONAL', color: '#3B82F6', icon: Target, description: 'Changes and current circumstances' },
  { name: 'ASPIRATIONAL', color: '#8B5CF6', icon: Star, description: 'Goals and future vision' }
];

const WellnessGrid: React.FC<WellnessGridProps> = ({ 
  customResponses = {}, 
  userName, 
  userId, 
  userData 
}) => {
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [isGeneratingSummaries, setIsGeneratingSummaries] = useState(false);

  const generateResults = useMemo(() => {
    const resultsByRing: Record<string, Record<string, Response[]>> = {
      EMPIRICAL: {},
      SITUATIONAL: {},
      ASPIRATIONAL: {}
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

  // Load summaries from storage or generate new ones
  useEffect(() => {
    const loadOrGenerateSummaries = async () => {
      if (!userId || Object.keys(generateResults).length === 0) return;
      
      // First, try to load existing summaries from storage
      const userSummaries = summaryStorageService.getUserSummaries(userId);
      
      if (userSummaries && Object.keys(userSummaries.summaries).length > 0) {
        // Load existing summaries
        setSummaries(userSummaries.summaries);
        return;
      }
      
      // If no summaries exist, generate new ones
      setIsGeneratingSummaries(true);
      
      try {
        // Import the service dynamically
        const { oauthVertexAIService } = await import('../services/oauth-vertex-ai');
        
        // Generate summaries for all ring/dimension combinations
        const summaryPromises: Promise<{ key: string; summary: string }>[] = [];
        
        rings.forEach((ring, ringIndex) => {
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
        
        // Save to storage
        if (userName) {
          summaryStorageService.saveUserSummaries({
            userId,
            userName,
            summaries: newSummaries,
            lastUpdated: new Date().toISOString(),
            isEdited: false
          });
        }
      } catch (error) {
        console.error('Error generating summaries:', error);
      } finally {
        setIsGeneratingSummaries(false);
      }
    };
    
    loadOrGenerateSummaries();
  }, [generateResults, userId, userName]);

  const handleEditSummary = (ringDimension: string, currentSummary: string) => {
    setEditingCell(ringDimension);
    setEditingText(currentSummary);
  };

  const handleSaveEdit = () => {
    if (editingCell && userId) {
      const newSummaries = { ...summaries, [editingCell]: editingText };
      setSummaries(newSummaries);
      
      // Save to storage
      summaryStorageService.updateSummary(userId, editingCell, editingText);
      
      setEditingCell(null);
      setEditingText('');
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditingText('');
  };

  const renderGridCell = (ring: Ring, dimension: Dimension) => {
    const cellId = `${ring.name}-${dimension.name}`;
    const ringDimension = `${ring.name}_${dimension.name}`;
    const hasContent = generateResults[ring.name][dimension.name].length > 0;
    const isHovered = hoveredCell === cellId;
    const isEditing = editingCell === ringDimension;
    const summary = summaries[ringDimension] || (isGeneratingSummaries ? 'Generating...' : 'Loading...');

    return (
      <div
        key={cellId}
        className={`
          relative p-2 border-2 rounded-lg transition-all duration-200 cursor-pointer min-h-[160px] print:min-h-[100px] print:border-gray-400 print:p-1
          ${hasContent 
            ? `bg-gradient-to-br ${isHovered ? 'shadow-lg scale-105' : 'shadow-md'} print:shadow-none print:scale-100`
            : 'bg-gray-50 border-gray-200 print:bg-gray-100'
          }
        `}
        style={{
          backgroundColor: hasContent ? dimension.color : undefined,
          borderColor: hasContent ? dimension.color : '#E5E7EB',
          opacity: hasContent ? (isHovered ? 1 : 0.8) : 0.3
        }}
        onMouseEnter={() => setHoveredCell(cellId)}
        onMouseLeave={() => setHoveredCell(null)}
        onClick={() => !isEditing && setSelectedCell(cellId)}
      >
        {/* Ring indicator in top-left corner */}
        <div className="absolute top-1 left-1 print:top-0.5 print:left-0.5">
          <ring.icon 
            size={10} 
            className="text-white drop-shadow-sm print:text-gray-600 print:w-3 print:h-3"
            style={{ color: ring.color }}
          />
        </div>

        {/* Edit button in top-right corner */}
        {hasContent && !isEditing && userId && (
          <div className="absolute top-1 right-1 print:hidden z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEditSummary(ringDimension, summary);
              }}
              className="p-1 bg-black bg-opacity-30 hover:bg-opacity-50 rounded text-white transition-colors shadow-sm"
            >
              <Edit3 size={8} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="mt-2 h-full flex flex-col print:mt-1">
          {hasContent ? (
            <div className="text-white flex-1 print:text-white">
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="w-full h-24 p-2 text-xs bg-white text-gray-900 rounded border-0 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={handleSaveEdit}
                      className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                    >
                      <Check size={10} />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-medium leading-tight overflow-y-auto print:text-xs print:leading-tight print:font-normal print:text-white text-left whitespace-pre-line">
                  {summary}
                </p>
              )}
            </div>
          ) : (
            <div className="text-gray-400 text-xs italic flex items-start justify-start h-full print:text-white p-1">
              No data available
            </div>
          )}
        </div>

        {/* Hover effect overlay - hidden when printing */}
        {isHovered && hasContent && !isEditing && (
          <div className="absolute inset-0 bg-black bg-opacity-10 rounded-lg flex items-center justify-center print:hidden z-0">
            <span className="text-white text-xs font-medium bg-black bg-opacity-50 px-2 py-1 rounded-full">
              Click for details
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderModal = () => {
    if (!selectedCell) return null;
    
    const [ringName, dimensionName] = selectedCell.split('-');
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
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: dimension.color }}
                >
                  <ring.icon size={16} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">
                  {ring.name} - {dimension.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
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
    <div className="bg-gray-50 py-2 px-4 print:py-1 print:px-0 print:bg-white">
      <div className="max-w-7xl mx-auto print:max-w-none">
        <div className="bg-white rounded-lg p-4 shadow-sm border print:shadow-none print:border print:border-gray-300 print:p-2">
          {/* Grid Header with Dimensions */}
          <div className="grid grid-cols-8 gap-2 mb-2 print:gap-1 print:mb-1">
            <div className="flex flex-col items-center justify-center p-2 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg border-2 border-gray-200 print:bg-gray-100 print:border-gray-400 print:p-1">
              {userName ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold mb-1 shadow-lg print:bg-gray-600 print:shadow-none print:w-8 print:h-8 print:text-xs">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-xs font-bold text-gray-800 text-center print:text-gray-900 print:text-xs">
                    {userName}
                  </div>
                  <div className="text-xs text-gray-600 text-center print:text-gray-700 print:text-xs">
                    Profile
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-500 text-sm font-bold mb-1 print:bg-gray-400 print:w-8 print:h-8 print:text-xs">
                    ?
                  </div>
                  <div className="text-xs font-bold text-gray-600 text-center print:text-gray-800 print:text-xs">
                    Your Name
                  </div>
                  <div className="text-xs text-gray-500 text-center print:text-gray-600 print:text-xs">
                    Complete Assessment
                  </div>
                </>
              )}
            </div>
            {dimensions.map((dimension) => (
              <div 
                key={dimension.name}
                className="text-center p-2 rounded-lg print:border print:border-gray-400 print:p-1"
                style={{ backgroundColor: dimension.color, color: 'white' }}
              >
                <div className="text-base mb-1 print:text-sm">{dimension.icon}</div>
                <div className="text-xs font-bold print:text-xs">{dimension.name}</div>
                <div className="text-xs opacity-90 mt-1 print:text-xs print:opacity-100 print:mt-0">{dimension.description}</div>
              </div>
            ))}
          </div>

          {/* Grid Body with Rings and Data */}
          <div className="space-y-1 print:space-y-0.5">
            {rings.slice().reverse().map((ring, ringIndex) => (
              <div key={ring.name} className="grid grid-cols-8 gap-2 print:gap-1">
                {/* Ring Label */}
                <div 
                  className="flex items-center justify-center min-h-[160px] p-2 rounded-lg text-center print:min-h-[100px] print:border print:border-gray-400 print:p-1"
                  style={{ 
                    backgroundColor: ring.color,
                    color: 'white'
                  }}
                >
                  <div>
                    <ring.icon size={18} className="mx-auto mb-1 print:mb-0 print:w-4 print:h-4" />
                    <div className="text-xs font-bold print:text-xs">{ring.name}</div>
                    <div className="text-xs opacity-90 mt-1 print:text-xs print:opacity-100 print:mt-0">{ring.description}</div>
                  </div>
                </div>

                {/* Data Cells for this Ring */}
                {dimensions.map((dimension) => 
                  renderGridCell(ring, dimension)
                )}
              </div>
            ))}
          </div>
        </div>


        {renderModal()}
      </div>
    </div>
  );
};

export default WellnessGrid;
