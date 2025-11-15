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
      border: `3px solid ${subjectColors[node.subject] || subjectColors.Other}`,
      borderRadius: '16px',
      padding: '10px 18px',
      fontSize: '15px',
      fontWeight: '600',
      width: 160,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      transition: 'all 0.3s ease',
    },
  })), [tree.nodes]);

  const initialEdges: Edge[] = useMemo(() => tree.edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    type: 'bezier',
    animated: edge.type === 'prereq',
    label: edge.type,
    labelStyle: { fill: '#666', fontWeight: 600, fontSize: '11px' },
    labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
    style: { 
      stroke: edge.type === 'prereq' ? '#3b82f6' : '#10b981',
      strokeWidth: 2.5,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: edge.type === 'prereq' ? '#3b82f6' : '#10b981',
      width: 20,
      height: 20,
    },
  })), [tree.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when tree changes
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

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
        return d.id.includes('-root') ? 50 : 300;
      }).strength((d: any) => {
        return d.id.includes('-root') ? 0.8 : 0.1;
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
