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
  
  // Try to find JSON object first (for { })
  let jsonStart = text.indexOf('{');
  let jsonEnd = text.lastIndexOf('}');
  
  // If no object found, try array (for [ ])
  if (jsonStart === -1 || jsonEnd === -1) {
    jsonStart = text.indexOf('[');
    jsonEnd = text.lastIndexOf(']');
  }
  
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

Your task: Determine the SIMPLEST, MOST DIRECT path to connect "${topicName}".

CRITICAL RULES:

1. **Prefer EXISTING nodes over creating new ones**
   - If an existing node is a good parent, USE IT directly
   - Only create intermediate nodes if truly necessary
   - Ex. If intermediate nodes would also cover a variety of other sub sub topics like BFS would go into ALgorithms then CS, not directly to CS, because there are many other Algorithms. 
2. **Make sure you are looking for related nodes**
   - Suggest related nodes that enhance understanding but are NOT direct prerequisites
   - E.g., for "Neural Networks", "Calculus" is related but not a prerequisite
   - Suggest two nodes that have a related subtopic that stem from both. Ex. Quantum Mechanics and Computer Science --> Quantum Computing
3. **When to create chains:**
   - Only when "${topicName}" is very specific and needs a clear intermediate concept
   - Example: "Convolutional Neural Networks" needs ML → AI → CS (good chain)
   - Example: "Atoms" can go directly to "Chemistry" (no chain needed)

4. **parentChain format:**
   - If connecting directly: ["existing-node-id"]
   - If chain needed: ["root-id", "Intermediate Concept", "Immediate Parent"]
   - First item MUST be an existing node ID from the list

5. **Subject categories:**
   - Atoms, Molecules, Reactions → Chemistry
   - Motion, Forces, Energy, Quantum → Physics
   - Algorithms, ML, Programming → CS
   - Calculus, Algebra, Geometry → Math

EXAMPLES OF GOOD SUGGESTIONS:

**Simple/Direct (PREFERRED):**
Input: "Quantum Mechanics"
{
  "subject": "Physics",
  "immediateParent": "phys-root",
  "parentChain": ["phys-root"],
  "related": ["Quantum Computing"],
  "reasoning": "Quantum Mechanics is a major branch of Physics, connects directly to Physics root"
}

Input: "Organic Chemistry"  
{
  "subject": "Chemistry",
  "immediateParent": "chem-root",
  "parentChain": ["chem-root"],
  "related": ["molecules"],
  "reasoning": "Organic Chemistry is a major branch of Chemistry, connects directly"
}

**Chain needed (for very specific topics):**
Input: "Backpropagation"
{
  "subject": "CS",
  "immediateParent": "neural-networks",
  "parentChain": ["cs-root", "Machine Learning", "Neural Networks"],
  "related": ["calc"],
  "reasoning": "Backpropagation is a specific technique in Neural Networks, which is part of ML under CS. Requires calculus knowledge."
}

Input: "LSTM Networks"
{
  "subject": "CS",
  "immediateParent": "neural-networks",
  "parentChain": ["neural-networks"],
  "related": [],
  "reasoning": "LSTM is a type of neural network. Neural Networks already exists, so connect directly to it."
}

Respond with valid JSON:
{
  "subject": "category",
  "immediateParent": "slug-format",
  "parentChain": ["existing-id-or-chain"],
  "related": ["existing-id"],
  "reasoning": "explanation of why this is the simplest path"
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

  // Generate subtopics for Intra Mode
  generateSubtopics: async (
    topicName: string,
    existingNodes: Array<{ id: string; label: string; subject: string }>
  ): Promise<{
    subtopics: Array<{
      label: string;
      subject: string;
      description: string;
      relatedNodeIds: string[];
    }>;
    reasoning: string;
  }> => {
    console.log(`\n🔍 Generating subtopics for: "${topicName}"`);
    
    const nodesList = existingNodes
      .map(n => `- ${n.label} (${n.subject}, id: ${n.id})`)
      .join('\n');

    const prompt = `You are an expert knowledge structure designer. A user wants to explore "${topicName}" in depth and learn its subtopics.

EXISTING TOPICS IN THE KNOWLEDGE BASE:
${nodesList}

Your task: Generate 3-5 detailed subtopics of "${topicName}" that break down this concept into digestible learning units. For each subtopic:
1. Give it a clear, specific name
2. Assign the appropriate subject category
3. Provide a brief description
4. Identify 0-2 existing topics that are RELATED (not parent/child, but conceptually connected) to this subtopic

OUTPUT FORMAT:
Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "subtopics": [
    {
      "label": "subtopic name",
      "subject": "subject category",
      "description": "brief explanation of what this subtopic covers",
      "relatedNodeIds": ["existing-id-1", "existing-id-2"]
    }
  ],
  "reasoning": "why these subtopics were chosen for ${topicName}"
}

RULES:
- Subtopic names should be 2-4 words (e.g., "Linear Transformations", "Neural Network Architecture")
- Subject categories: Math, CS, Physics, Biology, Chemistry, Engineering, Economics, Psychology, Sociology, Philosophy, History, Literature, Art, Music, Language, Other
- relatedNodeIds should only contain IDs that actually exist in the list above
- Keep descriptions concise (1 sentence)
- All subtopics should be CONCEPTUALLY UNDER "${topicName}", not parent topics`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-001',
      contents: prompt,
    });

    const jsonText = await extractJSON(response);
    const parsed = JSON.parse(jsonText);
    
    console.log('✅ PARSED SUBTOPICS:', JSON.stringify(parsed, null, 2));
    return parsed;
  },
};
