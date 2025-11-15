import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY not found in environment variables');
}

const ai = new GoogleGenAI({ apiKey });

interface SuggestionResponse {
  subject: string;
  parents: string[];
  related?: string[];
  reasoning: string;
}

interface ChainSuggestion {
  subject: string;
  immediateParent: string;
  parentChain: string[];
  related?: string[];
  reasoning: string;
}

async function extractJSON(apiResponse: any): Promise<string> {
  let text = '';
  
  if (typeof apiResponse.text === 'function') {
    text = await apiResponse.text();
  } else if (typeof apiResponse.text === 'string') {
    text = apiResponse.text;
  } else {
    throw new Error('Could not extract text from API response');
  }
  
  text = text.trim();
  console.log('\n🤖 RAW AI RESPONSE:', text);
  
  const codeBlockPattern = /``````/g;
  text = text.replace(codeBlockPattern, '');
  text = text.trim();
  
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  
  if (jsonStart === -1 || jsonEnd === -1) {
    console.error('❌ No JSON found in response:', text);
    throw new Error('No valid JSON found in AI response');
  }
  
  const jsonText = text.substring(jsonStart, jsonEnd + 1);
  console.log('📦 EXTRACTED JSON:', jsonText);
  
  return jsonText;
}

// Helper to capitalize first letter of each word
function toTitleCase(str: string): string {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export const geminiService = {
  // Find related concepts for a given topic
  findRelated: async (
    conceptName: string,
    existingNodes: Array<{ id: string; label: string; subject: string }>
  ): Promise<string[]> => {
    const nodesList = existingNodes
      .filter(n => n.id !== 'syntra')
      .map(n => `- ${n.label} (${n.subject}, id: ${n.id})`)
      .join('\n');

    const prompt = `Given the concept "${conceptName}" and the following existing topics, suggest 0-3 related topics that connect to "${conceptName}" but are NOT direct prerequisites.

Existing topics:
${nodesList}

Respond with ONLY a JSON array of IDs (use exact IDs from the list):
["id1", "id2"]

If no good related topics exist, return empty array: []`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-001',
        contents: prompt,
      });

      const jsonText = await extractJSON(response);
      return JSON.parse(jsonText);
    } catch (err) {
      console.error('❌ Failed to find related for', conceptName);
      return [];
    }
  },

  suggestWithChain: async (
    topicName: string,
    existingNodes: Array<{ id: string; label: string; subject: string }>
  ): Promise<ChainSuggestion> => {
    console.log(`\n🔍 Creating chain for: "${topicName}"`);
    
    const nodesList = existingNodes
      .filter(n => n.id !== 'syntra')
      .map(n => `- ${n.label} (${n.subject}, id: ${n.id})`)
      .join('\n');

    console.log('📋 Existing nodes:', existingNodes.length);

    const prompt = `You are helping organize a knowledge graph. A user wants to add: "${topicName}".

EXISTING topics in the graph:
${nodesList}

Your task: Build a LOGICAL prerequisite chain for "${topicName}".

CRITICAL INSTRUCTIONS:
1. Determine the CORRECT subject based on what "${topicName}" truly is:
   - Atoms, Molecules, Elements, Compounds → Chemistry
   - Motion, Forces, Energy, Waves → Physics
   - Algorithms, Programming, AI → CS
   - Calculus, Algebra, Geometry → Math
   
2. parentChain MUST start with an EXISTING node from the list above (like "chem-root", "phys-root", "cs-root")

3. parentChain format: [EXISTING_ROOT, "New Parent", "Immediate Parent"]
   - First item MUST be an existing node ID from the list
   - Last item is the immediate parent of "${topicName}"
   - Middle items are concepts that bridge them
   - Use Title Case for new concepts (e.g., "Machine Learning" not "machine learning")

4. immediateParent is the slug version of the last item in parentChain

5. Only suggest related topics using exact IDs from the existing list

CORRECT EXAMPLES:

For "atoms" (Chemistry):
{
  "subject": "Chemistry",
  "immediateParent": "matter",
  "parentChain": ["chem-root", "Matter"],
  "related": [],
  "reasoning": "Atoms are fundamental to Chemistry, studied under Matter"
}

For "quantum mechanics" (Physics):
{
  "subject": "Physics",
  "immediateParent": "modern-physics",
  "parentChain": ["phys-root", "Modern Physics"],
  "related": [],
  "reasoning": "Quantum Mechanics is a branch of Modern Physics"
}

For "computer vision" (CS):
{
  "subject": "CS",
  "immediateParent": "machine-learning",
  "parentChain": ["cs-root", "Artificial Intelligence", "Machine Learning"],
  "related": ["lin-alg"],
  "reasoning": "Computer Vision uses ML techniques, which is part of AI under CS"
}

Respond with valid JSON:
{
  "subject": "Chemistry",
  "immediateParent": "slug-format",
  "parentChain": ["existing-root-id", "Title Case Concept"],
  "related": [],
  "reasoning": "brief explanation"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-001',
      contents: prompt,
    });

    const jsonText = await extractJSON(response);
    
    try {
      const parsed = JSON.parse(jsonText);
      console.log('✅ PARSED SUGGESTION:', JSON.stringify(parsed, null, 2));
      
      // Auto-capitalize the parentChain items
      if (parsed.parentChain) {
        parsed.parentChain = parsed.parentChain.map((item: string) => {
          // Don't capitalize IDs like "chem-root"
          if (item.includes('-')) return item;
          return toTitleCase(item);
        });
      }
      
      return parsed;
    } catch (err) {
      console.error('❌ Failed to parse JSON:', jsonText);
      throw new Error('Invalid JSON from AI');
    }
  },

  suggestParentAndCategory: async (
    topicName: string,
    existingNodes: Array<{ id: string; label: string; subject: string }>
  ): Promise<SuggestionResponse> => {
    const nodesList = existingNodes
      .filter(n => n.id !== 'syntra')
      .map(n => `- ${n.label} (${n.subject}, id: ${n.id})`)
      .join('\n');

    const prompt = `You are helping organize a knowledge graph. A user wants to add "${topicName}".

Existing topics: ${nodesList}

Respond ONLY with valid JSON:
{
  "subject": "category",
  "parents": ["parent-id"],
  "related": [],
  "reasoning": "explanation"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-001',
      contents: prompt,
    });

    const jsonText = await extractJSON(response);
    return JSON.parse(jsonText);
  },
};
