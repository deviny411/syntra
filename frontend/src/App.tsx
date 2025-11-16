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
          <p className="subtitle">Knowledge Forest</p>
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
    </div>
  );
}

export default App;
