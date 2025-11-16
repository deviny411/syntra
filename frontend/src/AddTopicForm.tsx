import { useState } from 'react';
import type { Subject } from './App';

interface AddTopicFormProps {
  onTopicAdded: () => void;
}

interface ChainSuggestion {
  subject: Subject;
  immediateParent: string;
  parentChain: string[];
  related?: string[];
  reasoning: string;
}

// Helper to capitalize
function toTitleCase(str: string): string {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export default function AddTopicForm({ onTopicAdded }: AddTopicFormProps) {
  const [label, setLabel] = useState('');
  const [isFamiliar, setIsFamiliar] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createNodeChain = async (chainSuggestion: ChainSuggestion, finalTopic: string) => {
    console.log('🔗 Creating chain:', chainSuggestion);
    
    const { parentChain, subject } = chainSuggestion;
    const createdNodes: string[] = [];
    
    // Create nodes from the chain, starting from root to leaf
    for (let i = parentChain.length - 1; i >= 0; i--) {
      const conceptName = toTitleCase(parentChain[i]);
      const conceptId = parentChain[i].toLowerCase().replace(/\s+/g, '-');
      
      console.log(`  📍 Processing [${i}]: ${conceptName} (${conceptId})`);
      
      // Check if this node already exists
      const existingCheck = await fetch('http://localhost:4000/api/tree');
      const tree = await existingCheck.json();
      const exists = tree.nodes.some((n: any) => n.id === conceptId);
      
      if (exists) {
        console.log(`    ✓ Already exists: ${conceptName}`);
        continue;
      }
      
      // Determine parent
      let parentId: string;
      if (i === 0) {
        parentId = 'syntra';
        console.log(`    ⚠️  No parent found, using syntra`);
      } else {
        parentId = parentChain[i - 1].toLowerCase().replace(/\s+/g, '-');
        console.log(`    ➕ Creating ${conceptName} with parent: ${parentId}`);
      }

      // Create the node
      const createResponse = await fetch('http://localhost:4000/api/tree/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: conceptName,
          subject: subject,
          parents: [parentId],
          masteryLevel: 'none'
        }),
      });
      
      console.log(`    📡 Node creation response:`, createResponse.status);
      
      if (createResponse.ok) {
        createdNodes.push(conceptId);
        
        // Find and add related nodes for this parent concept
        console.log(`    🔍 Finding related for ${conceptName}...`);
        try {
          const relatedResponse = await fetch('http://localhost:4000/api/ai/find-related', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conceptName }),
          });
          
          if (relatedResponse.ok) {
            const relatedIds: string[] = await relatedResponse.json();
            console.log(`    🔗 Found related:`, relatedIds);
            
            // Create related edges
            for (const relatedId of relatedIds) {
              await fetch('http://localhost:4000/api/tree/edges', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  from: conceptId,
                  to: relatedId,
                  type: 'related'
                }),
              }).catch(err => console.error('Failed to add related edge:', err));
            }
          }
        } catch (err) {
          console.log(`    ⚠️  Could not find related for ${conceptName}`);
        }
      }
    }

    // Finally, add the actual topic the user wanted
    const capitalizedTopic = toTitleCase(finalTopic);
    const masteryLevel = isFamiliar ? 'familiar' : 'none';
    
    console.log(`  🎯 Adding final topic: ${capitalizedTopic} with parent: ${chainSuggestion.immediateParent} (mastery: ${masteryLevel})`);
    
    const nodeResponse = await fetch('http://localhost:4000/api/tree/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: capitalizedTopic,
        subject: subject,
        parents: [chainSuggestion.immediateParent],
        masteryLevel: masteryLevel
      }),
    });
    
    console.log(`  📡 Final node creation response:`, nodeResponse.status);
    
    // If user marked as familiar, log that interaction to Snowflake for mastery tracking
    if (isFamiliar && nodeResponse.ok) {
      const nodeId = finalTopic.toLowerCase().replace(/\s+/g, '-');
      console.log(`  🔄 Logging already_familiar for ${capitalizedTopic}...`);
      try {
        const masteryResponse = await fetch('http://localhost:4000/api/mastery/log-interaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'default-user',
            nodeId: nodeId,
            interactionType: 'already_familiar',
            durationSeconds: 0,
            metadata: { timestamp: new Date().toISOString(), source: 'new_topic_creation' }
          }),
        });
        console.log(`  📡 Mastery logging response:`, masteryResponse.status);
        if (!masteryResponse.ok) {
          const errorText = await masteryResponse.text();
          console.error(`  ⚠️  Mastery logging failed:`, errorText);
        } else {
          console.log(`  ✅ Logged already_familiar for ${capitalizedTopic}`);
        }
      } catch (err) {
        console.error(`  ⚠️  Failed to log already_familiar:`, err);
      }
    }
    
    // Add related edges for final topic
    if (chainSuggestion.related && chainSuggestion.related.length > 0) {
      const nodeId = finalTopic.toLowerCase().replace(/\s+/g, '-');
      for (const relatedId of chainSuggestion.related) {
        await fetch('http://localhost:4000/api/tree/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: nodeId,
            to: relatedId,
            type: 'related'
          }),
        }).catch(err => console.error('Failed to add related edge:', err));
      }
    }

    return nodeResponse;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!label.trim()) {
      setError('Topic name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Get AI chain suggestion
      const suggestionResponse = await fetch('http://localhost:4000/api/ai/suggest-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicName: label }),
      });

      if (!suggestionResponse.ok) throw new Error('Failed to get AI suggestion');

      const suggestion: ChainSuggestion = await suggestionResponse.json();

      // Create the chain of nodes
      const nodeResponse = await createNodeChain(suggestion, label);
      
      if (!nodeResponse.ok) throw new Error('Failed to add topic');

      console.log('✅ All nodes and edges created!');
      
      // Small delay to ensure backend has processed everything
      await new Promise(resolve => setTimeout(resolve, 100));

      setLabel('');
      setIsFamiliar(false);
      onTopicAdded();
      
      console.log('🔄 Refresh triggered');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add topic');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="add-topic-form">
      <input
        type="text"
        placeholder="Type a topic..."
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        disabled={isSubmitting}
        className="form-input"
      />

      <div className="familiar-toggle-container">
        <span className="toggle-label">I'm already familiar with this</span>
        <button
          type="button"
          role="switch"
          aria-checked={isFamiliar}
          onClick={() => setIsFamiliar(!isFamiliar)}
          disabled={isSubmitting}
          className={`toggle-switch ${isFamiliar ? 'active' : ''}`}
        >
          <span className="toggle-slider" />
        </button>
      </div>

      <button type="submit" disabled={isSubmitting} className="form-button">
        {isSubmitting ? '🤖 Building chain...' : '+ Add Topic'}
      </button>
      
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
