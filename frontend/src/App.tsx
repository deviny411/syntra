import { useEffect, useState } from "react";
import KnowledgeGraph from "./KnowledgeGraph";
import AddTopicForm from "./AddTopicForm";
import NodeDetailsPanel from "./NodeDetailsPanel";
import "./App.css";

// 👇 Add 'export' to all these
export type Subject =
  | "Math"
  | "CS"
  | "Physics"
  | "Biology"
  | "Chemistry"
  | "Engineering"
  | "Economics"
  | "Psychology"
  | "Sociology"
  | "Philosophy"
  | "History"
  | "Literature"
  | "Art"
  | "Music"
  | "Language"
  | "Other";

export type MasteryLevel = "none" | "seen" | "familiar" | "mastered";

export interface ConceptNode {
  id: string;
  label: string;
  subject: Subject;
  masteryLevel: MasteryLevel;
  parents?: string[];
  tags?: string[];
}

export interface ConceptEdge {
  id: string;
  from: string;
  to: string;
  type: "prereq" | "related" | "merge";
}

export interface KnowledgeTree {
  nodes: ConceptNode[];
  edges: ConceptEdge[];
}

function App() {
  const [tree, setTree] = useState<KnowledgeTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const userId = 'default-user';

  const fetchTree = () => {
    console.log('🔄 Fetching tree...');
    fetch("http://localhost:4000/api/tree")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch tree");
        return res.json();
      })
      .then((data: KnowledgeTree) => {
        console.log('✅ Tree fetched:', data.nodes.length, 'nodes,', data.edges.length, 'edges');
        setTree(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching tree:", err);
        setError(err.message);
        setLoading(false);
      });
  };

  const fetchRecommendations = async () => {
    setRecsLoading(true);
    setShowRecommendations(true);
    try {
      const res = await fetch(`/api/mastery/recommendations/${userId}?currentNodeId=${selectedNodeId || ''}`);
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
      setRecommendations([]);
    } finally {
      setRecsLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, []);

  if (loading) return <div className="loading">Loading Syntra tree...</div>;
  if (error) return <div className="loading">Error: {error}</div>;
  if (!tree) return <div className="loading">No tree data</div>;

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>🌲 Syntra</h1>
        </div>

        <div className="sidebar-section">
          <h3>📊 Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{tree.nodes.length}</div>
              <div className="stat-label">Concepts</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{tree.edges.length}</div>
              <div className="stat-label">Connections</div>
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <h3>➕ Add New Topic</h3>
          <AddTopicForm onTopicAdded={fetchTree} />
        </div>

        <div className="sidebar-section">
          <h3>🎯 AI Recommendations</h3>
          <button
            onClick={fetchRecommendations}
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Get Learning Suggestions
          </button>
        </div>

        <div className="sidebar-footer">
          <p>💡 Click nodes to view details</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <KnowledgeGraph 
          tree={tree} 
          onNodeSelect={setSelectedNodeId}
        />
      </main>

      {/* Details Panel */}
      <NodeDetailsPanel
        nodeId={selectedNodeId}
        tree={tree}
        onClose={() => {
          console.log('[App] Closing panel');
          setSelectedNodeId(null);
        }}
        onUpdate={fetchTree}
      />

      {/* Recommendations Modal */}
      {showRecommendations && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowRecommendations(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#111827' }}>🎯 AI Learning Recommendations</h2>
              <button
                onClick={() => setShowRecommendations(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#6b7280' }}
              >
                ✕
              </button>
            </div>

            {recsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#374151' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
                <div>Analyzing your mastery data with Snowflake Cortex AI...</div>
              </div>
            ) : recommendations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#374151' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
                <div>Learn a few topics first, then I'll suggest what to learn next!</div>
              </div>
            ) : (
              <div>
                <p style={{ color: '#374151', marginBottom: '24px', fontSize: '14px' }}>
                  Based on your mastery scores, here are personalized recommendations:
                </p>
                {recommendations.map((rec, index) => (
                  <div
                    key={index}
                    style={{
                      background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
                      borderRadius: '12px',
                      padding: '20px',
                      marginBottom: '16px',
                      border: '2px solid #667eea30',
                    }}
                  >
                    <h3 style={{ margin: '0 0 12px 0', color: '#667eea', fontSize: '18px', fontWeight: '600' }}>
                      {index + 1}. {rec.topic}
                    </h3>
                    <p style={{ margin: '0 0 12px 0', color: '#374151', lineHeight: 1.6 }}>
                      {rec.reason}
                    </p>
                    {rec.connections && rec.connections.length > 0 && (
                      <div style={{ fontSize: '13px', color: '#374151' }}>
                        <strong>Builds on:</strong> {rec.connections.join(', ')}
                      </div>
                    )}
                    {rec.targetMastery && (
                      <div style={{ fontSize: '13px', color: '#667eea', marginTop: '8px', fontWeight: '600' }}>
                        🎯 Target: {rec.targetMastery}% mastery
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
