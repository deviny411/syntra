import { useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceY } from 'd3-force';
import type { KnowledgeTree } from './App';

const subjectColors: Record<string, string> = {
  Math: '#3b82f6',
  CS: '#8b5cf6',
  Physics: '#06b6d4',
  Biology: '#10b981',
  Chemistry: '#f59e0b',
  Engineering: '#ef4444',
  History: '#ec4899',
  Other: '#6b7280',
};

interface KnowledgeGraphProps {
  tree: KnowledgeTree;
}

export default function KnowledgeGraph({ tree }: KnowledgeGraphProps) {
  // Create initial nodes structure
 const initialNodes: Node[] = useMemo(() => tree.nodes.map((node) => ({
  id: node.id,
  type: 'default',
  data: { 
    label: node.label
  },
  position: { x: Math.random() * 500, y: Math.random() * 500 },
  style: {
    background: 'white',
    color: '#333',
    border: node.id === 'syntra' 
      ? '4px solid #8b5cf6'  // Thicker purple border for Syntra
      : `3px solid ${subjectColors[node.subject] || subjectColors.Other}`,
    borderRadius: node.id === 'syntra' ? '20px' : '16px',
    padding: node.id === 'syntra' ? '14px 24px' : '10px 18px',
    fontSize: node.id === 'syntra' ? '18px' : '15px',  // Bigger text
    fontWeight: node.id === 'syntra' ? '700' : '600',  // Bolder
    width: node.id === 'syntra' ? 200 : 160,  // Wider
    boxShadow: node.id === 'syntra' 
      ? '0 4px 16px rgba(139, 92, 246, 0.25)'  // Purple glow
      : '0 2px 8px rgba(0,0,0,0.08)',
    transition: 'all 0.3s ease',
  },
})), [tree.nodes]);

const initialEdges: Edge[] = useMemo(() => tree.edges.map((edge) => ({
  id: edge.id,
  source: edge.from,
  target: edge.to,
  type: 'dafault',
  style: { 
    stroke: edge.type === 'related' ? '#10b981' : '#456fb9ff',  // Green for related, gray for prereq
    strokeWidth: 2,
    strokeDasharray: edge.type === 'related' ? '5,5' : undefined,  // Dashed for related
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: edge.type === 'related' ? '#10b981' : '#436399ff',
    width: 18,
    height: 18,
  },
})), [tree.edges]);



const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

// Update nodes when tree changes
useEffect(() => {
  setNodes(initialNodes);
}, [initialNodes, setNodes]);

// Update edges when tree changes  👈 ADD THIS
useEffect(() => {
  setEdges(initialEdges);
}, [initialEdges, setEdges]);

  // Force simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    const d3Links = edges.map(edge => ({
      source: edge.source,
      target: edge.target,
    }));

    const simulation = forceSimulation(nodes as any)
      .force('charge', forceManyBody().strength(-200))
      .force('center', forceCenter(400, 300))
      .force('collision', forceCollide().radius(100))
      .force('y', forceY((d: any) => {
        if (d.id === 'syntra') return 30;  // Keep Syntra at the very top
        if (d.id.includes('-root')) return 180;  // Push other roots further down
        return 350;  // Regular nodes even further
      }).strength((d: any) => {
        if (d.id === 'syntra') return 1.0;  // Maximum strength - very pinned
        if (d.id.includes('-root')) return 0.7;  // Medium strength
        return 0.05;  // Very weak - flow naturally
      }))

      .force(
        'link',
        forceLink(d3Links)
          .id((d: any) => d.id)
          .distance(150)
          .strength(0.5)
      )
      .on('tick', () => {
        setNodes((nds) =>
          nds.map((node) => {
            const simNode = simulation.nodes().find((n: any) => n.id === node.id) as any;
            if (simNode) {
              return {
                ...node,
                position: {
                  x: simNode.x,
                  y: simNode.y,
                },
              };
            }
            return node;
          })
        );
      });

    // Restart simulation with more iterations for new nodes
    simulation.alpha(1).restart();

    return () => {
      simulation.stop();
    };
  }, [nodes.length, edges, setNodes]);

  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      background: 'white',
      borderRadius: '12px', 
      overflow: 'hidden',
      border: '1px solid #e5e7eb',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        attributionPosition="bottom-right"
      >
        <Background color="#e5e7eb" gap={20} size={1} />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            const subject = tree.nodes.find(n => n.id === node.id)?.subject;
            return subject ? subjectColors[subject] : subjectColors.Other;
          }}
          style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}
          maskColor="rgba(0,0,0,0.05)"
        />
      </ReactFlow>
    </div>
  );
}
