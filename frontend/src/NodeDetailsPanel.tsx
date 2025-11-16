import { useState, useEffect } from 'react';
import type { ConceptNode, Subject } from './App';
import './NodeDetailsPanel.css';

interface WikipediaInfo {
  title: string;
  summary: string;
  url: string;
  image?: string;
}
interface ArxivPaper {
  title: string;
  summary: string;
  pdfUrl: string;
  authors: string[];
  published?: string;
}
interface YouTubeVideo {
  title: string;
  description: string;
  videoId: string;
  thumbnail: string;
  channelTitle: string;
}
interface ConceptData {
  wikipedia: WikipediaInfo | null;
  arxiv: ArxivPaper[];
  youtube: YouTubeVideo[];
}

interface NodeDetailsPanelProps {
  nodeId: string | null;
  tree: { nodes: ConceptNode[]; edges: any[] };
  onClose: () => void;
  onUpdate: () => void;
}

function truncateTitle(title: string): string {
  const pipeIndex = title.indexOf('|');
  const base = pipeIndex !== -1 ? title.slice(0, pipeIndex) : title;
  return base.length > 45 ? base.slice(0, 42) + '...' : base;
}

export default function NodeDetailsPanel({ nodeId, tree, onClose, onUpdate }: NodeDetailsPanelProps) {
  const [node, setNode] = useState<ConceptNode | null>(null);
  const [masteryScore, setMasteryScore] = useState<number | null>(null);
  const [masteryLoading, setMasteryLoading] = useState(false);
  const [resourceInfo, setResourceInfo] = useState<ConceptData | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [arxivLoading, setArxivLoading] = useState(false);
  const [arxivError, setArxivError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [intraModeLoading, setIntraModeLoading] = useState(false);
  const [intraModeError, setIntraModeError] = useState<string | null>(null);
  const [bridgeLoading, setBridgeLoading] = useState<{ [key: string]: boolean }>({});
  const [bridgedPairs, setBridgedPairs] = useState<Set<string>>(new Set());
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [panelOpenTime, setPanelOpenTime] = useState<number | null>(null);
  const [showContentModal, setShowContentModal] = useState(false);
  const [contentType, setContentType] = useState<'article' | 'video' | null>(null);
  const userId = 'default-user'; // TODO: Replace with actual user ID from auth

  console.log(`[Panel] Render - nodeId: ${nodeId}, hasNode: ${node ? node.label : 'no'}, tree.nodes.length: ${tree.nodes.length}`);

  // Track time spent on panel
  useEffect(() => {
    if (!nodeId || !node) return;

    // Mark when panel opens
    setPanelOpenTime(Date.now());

    // Cleanup when panel closes
    return () => {
      if (panelOpenTime) {
        const timeSpent = Math.floor((Date.now() - panelOpenTime) / 1000);
        logInteraction('visit', timeSpent);
      }
      setPanelOpenTime(null);
    };
  }, [nodeId, node]);

  // Log interaction to backend
  const logInteraction = async (interactionType: string, durationSeconds?: number, metadata?: any) => {
    if (!node) return;
    try {
      await fetch('/api/mastery/log-interaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          nodeId: node.id,
          interactionType,
          durationSeconds,
          metadata: metadata || { timestamp: new Date().toISOString() },
        }),
      });
      console.log(`[Mastery] Logged: ${interactionType} for ${node.label}`);
    } catch (err) {
      console.error('[Mastery] Failed to log interaction:', err);
    }
  };

  // Handle external link clicks
  const handleLinkClick = (type: 'article' | 'video') => {
    console.log(`[Content Modal] Link clicked: ${type}`);
    setContentType(type);
    
    // Use a timeout to ensure state is set and modal can check contentType
    setTimeout(() => {
      console.log(`[Content Modal] Setting up focus listener for ${type}`);
      const focusHandler = () => {
        console.log(`[Content Modal] Window focused, contentType: ${type}`);
        setShowContentModal(true);
      };
      window.addEventListener('focus', focusHandler, { once: true });
    }, 100);
  };

  const handleContentModalResponse = async (response: 'not_really' | 'sort_of' | 'yes' | 'well') => {
    // Close modal immediately
    setShowContentModal(false);
    
    const interactionType = contentType === 'article' ? 'read_article' : 'watch_video';
    
    // Map understanding level to confidence levels
    let confidence = 'low';
    if (response === 'sort_of') {
      confidence = 'medium';
    } else if (response === 'yes') {
      confidence = 'high';
    } else if (response === 'well') {
      confidence = 'very_high';
    }

    const metadata = { 
      response, 
      confidence, 
      contentType,
      timestamp: new Date().toISOString() 
    };

    console.log(`[Mastery] Logging ${interactionType} with response: ${response} (${confidence})`);
    
    // Log interaction in background
    logInteraction(interactionType, undefined, metadata);
    
    // Clear content type
    setContentType(null);
  };

  useEffect(() => {
    if (!nodeId) {
      console.log(`[Panel] No nodeId, clearing node`);
      setNode(null);
      return;
    }
    
    const foundNode = tree.nodes.find(n => n.id === nodeId);
    if (foundNode) {
      console.log(`[Panel] ✅ Found node:`, foundNode.label);
      setNode(foundNode);
      
      // Fetch mastery score for this node (with timeout fallback)
      setMasteryLoading(true);
      const timeoutId = setTimeout(() => {
        console.warn('[Mastery] Fetch timeout, using default score');
        setMasteryScore(0);
        setMasteryLoading(false);
      }, 5000);
      
      fetch(`/api/mastery/score/${userId}/${foundNode.id}`)
        .then(res => res.json())
        .then(data => {
          clearTimeout(timeoutId);
          console.log(`[Mastery] Fetched score for ${foundNode.label}:`, data);
          setMasteryScore(data.masteryScore || 0);
          setMasteryLoading(false);
        })
        .catch(err => {
          clearTimeout(timeoutId);
          console.error('[Mastery] Failed to fetch score:', err);
          setMasteryScore(0);
          setMasteryLoading(false);
        });
    } else {
      console.warn(`[Panel] ❌ Node not found: ${nodeId}`);
      setNode(null);
    }
  }, [nodeId, tree]);

  useEffect(() => {
    if (!node) {
      setResourceInfo(null);
      return;
    }
    const concept = encodeURIComponent(node.label);

    setInfoLoading(true);
    setInfoError(null);
    setArxivLoading(true);
    setArxivError(null);

    // Ensure resourceInfo object exists so arXiv can merge into it even if wiki/yt fails
    setResourceInfo({ wikipedia: null, youtube: [], arxiv: [] });

    // Fetch Wikipedia + YouTube first
    fetch(`/api/concept/${concept}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then(data => {
        setResourceInfo(prev => ({
          ...(prev || { wikipedia: null, youtube: [], arxiv: [] }),
          wikipedia: data.wikipedia,
          youtube: data.youtube,
        }));
      })
      .catch(err => setInfoError('Failed to fetch Wikipedia/YouTube: ' + err.message))
      .finally(() => setInfoLoading(false));

    // Fetch arXiv separately and keep loading after wiki/youtube done
    fetch(`/api/concept/arxiv/${concept}`)
      .then(res => {
        if (!res.ok) throw new Error(`ArXiv HTTP ${res.status}`);
        return res.json();
      })
      .then(arxivData => {
        console.log('arXiv Data received:', arxivData); // debug log
        setResourceInfo(prev => ({ ...(prev || { wikipedia: null, youtube: [], arxiv: [] }), arxiv: arxivData }));
      })
      .catch(err => {
        setArxivError('Failed to fetch arXiv: ' + err.message);
      })
      .finally(() => {
        setArxivLoading(false);
      });
  }, [node]);

  if (!nodeId || !node) return null;

  const prerequisites = (tree.edges || [])
    .filter(e => e.to === nodeId && e.type === 'prereq')
    .map(e => tree.nodes.find(n => n.id === e.from))
    .filter(Boolean);
  const relatedNodes = (tree.edges || [])
    .filter(e => (e.from === nodeId || e.to === nodeId) && e.type === 'related')
    .map(e => tree.nodes.find(n => n.id === (e.from === nodeId ? e.to : e.from)))
    .filter(Boolean);
  const children = (tree.edges || [])
    .filter(e => e.from === nodeId && e.type === 'prereq')
    .map(e => tree.nodes.find(n => n.id === e.to))
    .filter(Boolean);

  // Debug logs in render
  console.log('resourceInfo.arxiv', resourceInfo?.arxiv);
  console.log('arxivLoading', arxivLoading);
  console.log('arxivError', arxivError);

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />

      <div className="node-details-panel" style={{ width: expanded ? '600px' : '400px', transition: 'width 0.3s ease' }}>

        {/* Header */}
        <div className="panel-header">
          <div>
            <h2>{node.label}</h2>
            <span
              className="subject-badge"
              style={{
                backgroundColor: `${getSubjectColor(node.subject)}20`,
                color: getSubjectColor(node.subject),
              }}
            >
              {node.subject}
            </span>
          </div>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="panel-content">
          <section className="panel-section">
            <h3>Mastery Level</h3>
            {masteryLoading ? (
              <div style={{ fontSize: '14px', color: '#6b7280' }}>Loading mastery...</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                    {Array.from({ length: 6 }).map((_, i) => {
                      const targetMastery = (i + 1) * (100 / 6);
                      const isFilled = (masteryScore || 0) >= targetMastery;
                      return (
                        <div
                          key={i}
                          onClick={async () => {
                            console.log(`[Mastery] Setting to ${targetMastery.toFixed(0)}%`);
                            setMasteryScore(targetMastery);
                            
                            // Log interaction based on level
                            const interactionType = i >= 5 ? 'already_familiar' : 'read_article';
                            await logInteraction(interactionType, 0);
                            console.log(`[Mastery] ✅ Set to ${targetMastery.toFixed(0)}%`);
                            
                            // Recalculate on backend
                            fetch(`/api/mastery/score/${userId}/${node.id}`);
                          }}
                          style={{
                            flex: 1,
                            height: '32px',
                            backgroundColor: isFilled ? '#667eea' : '#e5e7eb',
                            borderRadius: '6px',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                          }}
                          title={`Set to ${targetMastery.toFixed(0)}%`}
                          onMouseEnter={(e) => {
                            if (!isFilled) {
                              e.currentTarget.style.backgroundColor = '#d1d5db';
                            } else {
                              e.currentTarget.style.backgroundColor = '#5a67d8';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isFilled) {
                              e.currentTarget.style.backgroundColor = '#e5e7eb';
                            } else {
                              e.currentTarget.style.backgroundColor = '#667eea';
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                  <div style={{ 
                    fontSize: '18px', 
                    fontWeight: '700', 
                    color: '#667eea',
                    minWidth: '60px',
                    textAlign: 'right'
                  }}>
                    {Math.round(masteryScore || 0)}%
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Intra Mode Button */}
          <section className="panel-section">
            <button
              onClick={async () => {
                if (!node) return;
                setIntraModeLoading(true);
                setIntraModeError(null);
                try {
                  const response = await fetch('/api/ai/generate-subtopics', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ topicName: node.label }),
                  });
                  if (!response.ok) throw new Error('Failed to generate subtopics');
                  const data = await response.json();
                  console.log('✅ Generated subtopics:', data);
                  
                  // Create nodes and edges for each subtopic
                  for (const subtopic of data.subtopics) {
                    const subtopicId = subtopic.label.toLowerCase().replace(/\s+/g, '-');
                    
                    // Create the subtopic node with current node as parent
                    const createRes = await fetch('/api/tree/nodes', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        label: subtopic.label,
                        subject: subtopic.subject,
                        parents: [node.id],
                        masteryLevel: 'none'
                      }),
                    });
                    
                    if (createRes.ok) {
                      console.log(`✅ Created subtopic: ${subtopic.label}`);
                      
                      // Create related edges
                      for (const relatedId of subtopic.relatedNodeIds) {
                        await fetch('/api/tree/edges', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            from: subtopicId,
                            to: relatedId,
                            type: 'related'
                          }),
                        }).catch(err => console.error('Failed to create edge:', err));
                      }
                    }
                  }
                  
                  onUpdate(); // Refresh the tree
                } catch (err) {
                  setIntraModeError(err instanceof Error ? err.message : 'Failed to enter Intra Mode');
                } finally {
                  setIntraModeLoading(false);
                }
              }}
              disabled={intraModeLoading}
              style={{
                width: '100%',
                padding: '12px',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: intraModeLoading ? 'not-allowed' : 'pointer',
                opacity: intraModeLoading ? 0.6 : 1,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!intraModeLoading) {
                  e.currentTarget.style.background = '#5a67d8';
                }
              }}
              onMouseLeave={(e) => {
                if (!intraModeLoading) {
                  e.currentTarget.style.background = '#667eea';
                }
              }}
            >
              {intraModeLoading ? '🔍 Diving in...' : '🔍 Intra Mode'}
            </button>
            {intraModeError && <p style={{ color: 'crimson', marginTop: '8px', fontSize: '12px' }}>{intraModeError}</p>}
          </section>

          {prerequisites.length > 0 && (
            <section className="panel-section">
              <h3>Prerequisites ({prerequisites.length})</h3>
              <div className="node-list">
                {prerequisites.map(prereq => (
                  prereq && (
                    <div key={prereq.id} className="node-item">
                      <span className="node-dot" style={{ backgroundColor: getSubjectColor(prereq.subject) }} />
                      {prereq.label}
                    </div>
                  )
                ))}
              </div>
            </section>
          )}

          {relatedNodes.length > 0 && (
            <section className="panel-section">
              <h3>Related Topics ({relatedNodes.length})</h3>
              <div className="node-list">
                {relatedNodes.map(related => {
                  if (!related) return null;
                  
                  // Create unique pair ID (sorted to ensure consistency)
                  const pairId = [node.id, related.id].sort().join('-');
                  const isBridged = bridgedPairs.has(pairId);
                  
                  // Check if bridge already exists in tree
                  const existingBridge = tree.edges.some(edge => {
                    const edgeNodes = [edge.from, edge.to].sort();
                    const pairNodes = [node.id, related.id].sort();
                    return edge.type === 'prereq' && 
                           edgeNodes[0] === pairNodes[0] && 
                           edgeNodes[1] === pairNodes[1];
                  });
                  
                  const isDisabled = isBridged || existingBridge || bridgeLoading[related.id];
                  
                  return (
                    <div key={related.id} style={{ marginBottom: '12px' }}>
                      <div className="node-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="node-dot" style={{ backgroundColor: getSubjectColor(related.subject) }} />
                          {related.label}
                        </div>
                        <button
                          onClick={async () => {
                            if (!node || isDisabled) return;
                            setBridgeLoading(prev => ({ ...prev, [related.id]: true }));
                            setBridgeError(null);
                            try {
                              // Generate bridge topic using AI
                              const response = await fetch('/api/ai/generate-bridge-topic', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  topic1: node.label, 
                                  topic2: related.label 
                                }),
                              });
                              if (!response.ok) throw new Error('Failed to generate bridge topic');
                              const bridgeData = await response.json();
                              console.log('✅ Generated bridge topic:', bridgeData);
                              
                              // Create the bridge node
                              const createRes = await fetch('/api/tree/nodes', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  label: bridgeData.label,
                                  subject: bridgeData.subject,
                                  parents: [node.id, related.id],
                                  masteryLevel: 'none'
                                }),
                              });
                              
                              if (createRes.ok) {
                                console.log(`✅ Created bridge topic: ${bridgeData.label}`);
                                // Mark this pair as bridged
                                setBridgedPairs(prev => new Set([...prev, pairId]));
                                onUpdate(); // Refresh the tree
                              }
                            } catch (err) {
                              setBridgeError(err instanceof Error ? err.message : 'Failed to create bridge topic');
                              console.error('Bridge topic error:', err);
                            } finally {
                              setBridgeLoading(prev => ({ ...prev, [related.id]: false }));
                            }
                          }}
                          disabled={isDisabled}
                          style={{
                            padding: '4px 12px',
                            background: isDisabled ? '#d1d5db' : '#8b5cf6',
                            color: isDisabled ? '#9ca3af' : 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            opacity: isDisabled ? 0.5 : 1,
                          }}
                          title={isBridged || existingBridge ? 'Bridge already created' : `Generate a bridge topic combining ${node.label} and ${related.label}`}
                        >
                          {bridgeLoading[related.id] ? '🌉...' : (isBridged || existingBridge ? '✓ Bridged' : '🌉 Bridge')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {bridgeError && <p style={{ color: 'crimson', marginTop: '8px', fontSize: '12px' }}>{bridgeError}</p>}
            </section>
          )}

          {children.length > 0 && (
            <section className="panel-section">
              <h3>Unlocks ({children.length})</h3>
              <div className="node-list">
                {children.map(child => (
                  child && (
                    <div key={child.id} className="node-item">
                      <span className="node-dot" style={{ backgroundColor: getSubjectColor(child.subject) }} />
                      {child.label}
                    </div>
                  )
                ))}
              </div>
            </section>
          )}

          {/* Educational Resources Section */}
          <section className="panel-section">
            <h3>Learn More</h3>
            {infoLoading && <div>Loading Wikipedia and YouTube resources...</div>}
            {infoError && <div style={{ color: 'crimson' }}>{infoError}</div>}
            {resourceInfo && (
              <>
                {resourceInfo.wikipedia && (
                  <div className="source-block">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <h4 style={{ margin: 0 }}>{resourceInfo.wikipedia.title}</h4>
                      {(resourceInfo.wikipedia as any).isAiGenerated && (
                        <span style={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600',
                        }}>
                          🤖 AI
                        </span>
                      )}
                    </div>
                    {resourceInfo.wikipedia.image && (
                      <img
                        src={resourceInfo.wikipedia.image}
                        alt="Thumbnail"
                        style={{ maxWidth: 150, borderRadius: 8, marginBottom: 8 }}
                      />
                    )}
                    <p>{resourceInfo.wikipedia.summary}</p>
                    {resourceInfo.wikipedia.url && (
                      <a 
                        href={resourceInfo.wikipedia.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={() => handleLinkClick('article')}
                      >
                        Read on Wikipedia
                      </a>
                    )}
                  </div>
                )}

                {resourceInfo.youtube.length > 0 && (
                  <div className="source-block">
                    <h4>Video Tutorials</h4>
                    <div className="video-list">
                      {resourceInfo.youtube.map(video => (
                        <div key={video.videoId} className="video-card">
                          <a
                            href={`https://youtube.com/watch?v=${video.videoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleLinkClick('video')}
                            style={{ textDecoration: 'none', color: 'inherit' }}
                          >
                            <img
                              src={video.thumbnail}
                              alt={video.title}
                              style={{ width: '200px', height: '112px', objectFit: 'cover', borderRadius: 6 }}
                            />
                            <div
                              style={{
                                marginTop: 8,
                                fontWeight: 600,
                                fontSize: '0.9em',
                                lineHeight: 1.2,
                                whiteSpace: 'normal',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: 200,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                              }}
                              title={video.title}
                            >
                              {truncateTitle(video.title)}
                            </div>
                            <div style={{ fontSize: '0.8em', color: '#666', marginTop: 4 }}>{video.channelTitle}</div>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {arxivLoading && <div>Loading arXiv papers...</div>}
                {arxivError && <div style={{ color: 'crimson' }}>{arxivError}</div>}
                {!arxivLoading && !arxivError && resourceInfo?.arxiv && resourceInfo.arxiv.length > 0 && (
                  <div className="source-block" style={{ marginTop: 10 }}>
                    <details>
                      <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '1em', color: '#111827' }}>
                        Further Exploration (arXiv)
                      </summary>
                      <ul style={{ listStyle: 'none', paddingLeft: 0, marginTop: 8 }}>
                        {resourceInfo.arxiv.map(paper => (
                          <li key={paper.title} style={{ marginBottom: 16 }}>
                            <strong>{paper.title}</strong>
                            <br />
                            <em style={{ fontSize: '0.9em' }}>{paper.authors.join(', ')}</em>
                            <br />
                            <span style={{ color: '#6b7280', fontSize: '0.85em' }}>{paper.published?.slice(0, 10)}</span>
                            <br />
                            <p style={{ fontSize: '0.9em', marginTop: 4, color: '#1f2937' }}>{paper.summary.slice(0, 150)}...</p>
                            {paper.pdfUrl && (
                              <a 
                                href={paper.pdfUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                onClick={() => handleLinkClick('article')}
                              >
                                View PDF
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                )}
                {!arxivLoading && !arxivError && resourceInfo?.arxiv && resourceInfo.arxiv.length === 0 && (
                  <p style={{ fontStyle: 'italic', color: '#6b7280' }}>
                    No arXiv papers found for this concept.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </div>
      {/* Expand/Shrink toggle button */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        style={{
          position: 'fixed',
          right: expanded ? '600px' : '400px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '32px',
          height: '60px',
          background: '#f3f4f6',
          border: '1px solid #e5e7eb',
          borderRadius: '0px 0 0 4px',
          color: '#374151',
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: 'pointer',
          zIndex: 1001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'right 0.3s ease, background 0.2s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#e5e7eb')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#f3f4f6')}
        aria-label={expanded ? 'Shrink panel' : 'Expand panel'}
      >
        {expanded ? '>>' : '<<'}
      </button>

      {/* Content Modal */}
      {showContentModal && (
        <>
          <div 
            className="modal-backdrop" 
            onClick={() => setShowContentModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 2000,
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)',
              zIndex: 2001,
              maxWidth: '420px',
              width: '90%',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '18px', fontWeight: '600', color: '#111827' }}>
              How well did you understand it?
            </h3>
            <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '24px', margin: 0 }}>
              This helps us track your learning progress accurately.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                onClick={() => handleContentModalResponse('not_really')}
                style={{
                  padding: '12px 16px',
                  background: '#fee2e2',
                  color: '#991b1b',
                  border: '1px solid #fca5a5',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fecaca';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fee2e2';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                ✗ Not Really
              </button>
              <button
                onClick={() => handleContentModalResponse('sort_of')}
                style={{
                  padding: '12px 16px',
                  background: '#fef08a',
                  color: '#92400e',
                  border: '1px solid #fcd34d',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fde047';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fef08a';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                ~ Sort Of
              </button>
              <button
                onClick={() => handleContentModalResponse('yes')}
                style={{
                  padding: '12px 16px',
                  background: '#d1fae5',
                  color: '#065f46',
                  border: '1px solid #6ee7b7',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#a7f3d0';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#d1fae5';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                ✓ Good
              </button>
              <button
                onClick={() => handleContentModalResponse('well')}
                style={{
                  padding: '12px 16px',
                  background: '#dbeafe',
                  color: '#0c4a6e',
                  border: '1px solid #7dd3fc',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#bfdbfe';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#dbeafe';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                ⭐ Very Well
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}


function getSubjectColor(subject: Subject): string {
  const colors: Record<string, string> = {
    Math: '#3b82f6',
    CS: '#8b5cf6',
    Physics: '#06b6d4',
    Biology: '#10b981',
    Chemistry: '#f59e0b',
    Engineering: '#ef4444',
    History: '#ec4899',
    Other: '#6b7280',
  };
  return colors[subject] || colors.Other;
}
