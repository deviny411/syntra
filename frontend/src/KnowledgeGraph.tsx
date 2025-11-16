import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
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
  onNodeSelect?: (nodeId: string | null) => void;
}

export default function KnowledgeGraph({ tree, onNodeSelect }: KnowledgeGraphProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [highlightedEdges, setHighlightedEdges] = useState<Set<string>>(new Set());
  const [relatedEdges, setRelatedEdges] = useState<Set<string>>(new Set());
  const hasInitialFitView = useRef(false);

  // Function to find all parent nodes recursively
  const findParentChain = useCallback((nodeId: string, edges: typeof tree.edges): Set<string> => {
    const parents = new Set<string>();
    const visited = new Set<string>();
    
    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);
      parents.add(currentId);
      
      // Find all prereq edges where this node is the target (to)
      const parentEdges = edges.filter(
        edge => edge.to === currentId && edge.type === 'prereq'
      );
      
      parentEdges.forEach(edge => {
        traverse(edge.from);
      });
    };
    
    traverse(nodeId);
    return parents;
  }, []);

  // Handle node click
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    const nodeId = node.id;
    console.log(`[Graph] 🖱️ Clicked node:`, nodeId, node.data?.label);
    
    // Open details panel
    if (onNodeSelect) {
      console.log(`[Graph] Calling onNodeSelect with nodeId:`, nodeId);
      onNodeSelect(nodeId);
    } else {
      console.warn(`[Graph] ⚠️ onNodeSelect callback not provided!`);
    }
    
    if (selectedNodeId === nodeId) {
      // Clicking same node - deselect
      setSelectedNodeId(null);
      setHighlightedNodes(new Set());
      setHighlightedEdges(new Set());
      setRelatedEdges(new Set());
      return;
    }
    
    setSelectedNodeId(nodeId);
    
    // Find all nodes in parent chain
    const parentChain = findParentChain(nodeId, tree.edges);
    setHighlightedNodes(parentChain);
    
    // Find edges in parent chain
    const chainEdges = new Set<string>();
    const relatedEdgesSet = new Set<string>();
    
    tree.edges.forEach(edge => {
      if (edge.type === 'prereq' && parentChain.has(edge.from) && parentChain.has(edge.to)) {
        chainEdges.add(edge.id);
      }
      // Also highlight related edges connected to selected node
      if (edge.type === 'related' && (edge.from === nodeId || edge.to === nodeId)) {
        relatedEdgesSet.add(edge.id);
        // Add related nodes to highlighted set
        setHighlightedNodes(prev => {
          const newSet = new Set(prev);
          newSet.add(edge.from);
          newSet.add(edge.to);
          return newSet;
        });
      }
    });
    
    setHighlightedEdges(chainEdges);
    setRelatedEdges(relatedEdgesSet);
  }, [selectedNodeId, findParentChain, tree.edges, onNodeSelect]);

  // Handle background click to deselect
  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setHighlightedNodes(new Set());
    setHighlightedEdges(new Set());
    setRelatedEdges(new Set());
    if (onNodeSelect) {
      onNodeSelect(null);
    }
  }, [onNodeSelect]);

  // Create initial nodes structure with dynamic styling
  const initialNodes: Node[] = useMemo(() => tree.nodes.map((node) => {
    const isSelected = selectedNodeId === node.id;
    const isHighlighted = highlightedNodes.has(node.id);
    const shouldDim = selectedNodeId !== null && !isHighlighted;
    
    return {
      id: node.id,
      type: 'default',
      data: { 
        label: node.label
      },
      position: { x: Math.random() * 500, y: Math.random() * 500 },
      style: {
        background: node.id === 'syntra'
          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          : 'white',
        color: node.id === 'syntra' ? '#ffffff' : '#333',
        border: node.id === 'syntra' 
          ? 'none'
          : `3px solid ${subjectColors[node.subject] || subjectColors.Other}`,
        borderRadius: node.id === 'syntra' ? '24px' : '16px',
        padding: node.id === 'syntra' ? '20px 32px' : '10px 18px',
        fontSize: node.id === 'syntra' ? '24px' : '15px',
        fontWeight: node.id === 'syntra' ? '800' : '600',
        width: node.id === 'syntra' ? 220 : 160,
        boxShadow: isSelected
          ? `0 0 20px 4px ${subjectColors[node.subject] || subjectColors.Other}`
          : node.id === 'syntra' 
          ? '0 8px 32px rgba(102, 126, 234, 0.4), 0 4px 16px rgba(118, 75, 162, 0.3)'
          : '0 2px 8px rgba(0,0,0,0.08)',
        opacity: shouldDim ? 0.3 : 1,
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        letterSpacing: node.id === 'syntra' ? '1px' : 'normal',
        textTransform: node.id === 'syntra' ? 'uppercase' as const : 'none' as const,
      },
    };
  }), [tree.nodes, selectedNodeId, highlightedNodes]);

  const initialEdges: Edge[] = useMemo(() => tree.edges.map((edge) => {
    const isInChain = highlightedEdges.has(edge.id);
    const isRelated = relatedEdges.has(edge.id);
    const shouldDim = selectedNodeId !== null && !isInChain && !isRelated;
    
    return {
      id: edge.id,
      source: edge.from,
      target: edge.to,
      type: 'default',
      style: { 
        stroke: isRelated 
          ? '#10b981' 
          : isInChain
          ? '#3b82f6'
          : edge.type === 'related' ? '#10b981' : '#456fb9ff',
        strokeWidth: isInChain ? 4 : isRelated ? 3 : 2,
        strokeDasharray: edge.type === 'related' ? '5,5' : undefined,
        opacity: shouldDim ? 0.15 : 1,
        transition: 'all 0.3s ease',
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isRelated 
          ? '#10b981' 
          : isInChain
          ? '#3b82f6'
          : edge.type === 'related' ? '#10b981' : '#436399ff',
        width: isInChain ? 22 : 18,
        height: isInChain ? 22 : 18,
      },
      animated: isInChain,
    };
  }), [tree.edges, selectedNodeId, highlightedEdges, relatedEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when tree changes - preserve positions
  useEffect(() => {
    setNodes((prevNodes) => {
      return initialNodes.map((newNode) => {
        const existingNode = prevNodes.find(n => n.id === newNode.id);
        if (existingNode) {
          // Preserve position and just update style
          return {
            ...newNode,
            position: existingNode.position,
          };
        }
        return newNode;
      });
    });
  }, [initialNodes, setNodes]);

  // Update edges when tree changes
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Force simulation - runs when nodes are added
  useEffect(() => {
    if (nodes.length === 0) return;

    console.log('🎨 Running force simulation for', tree.nodes.length, 'nodes');

    // Build hierarchy map
    const nodeSubjects = new Map<string, string>();
    const nodeDepths = new Map<string, number>();
    const childrenMap = new Map<string, string[]>();
    
    tree.nodes.forEach(node => {
      nodeSubjects.set(node.id, node.subject);
      childrenMap.set(node.id, []);
    });
    
    // Calculate depth and build parent-child map
    const calculateDepth = (nodeId: string, visited = new Set<string>()): number => {
      if (visited.has(nodeId)) return 0;
      if (nodeDepths.has(nodeId)) return nodeDepths.get(nodeId)!;
      
      visited.add(nodeId);
      const node = tree.nodes.find(n => n.id === nodeId);
      if (!node || !node.parents || node.parents.length === 0) {
        nodeDepths.set(nodeId, 0);
        return 0;
      }
      
      const maxParentDepth = Math.max(...node.parents.map(p => calculateDepth(p, visited)));
      const depth = maxParentDepth + 1;
      nodeDepths.set(nodeId, depth);
      
      // Add to parent's children
      node.parents.forEach(parentId => {
        const children = childrenMap.get(parentId) || [];
        children.push(nodeId);
        childrenMap.set(parentId, children);
      });
      
      return depth;
    };
    
    tree.nodes.forEach(node => calculateDepth(node.id));

    // Calculate horizontal positions based on siblings and root
    const rootNodes = ['math-root', 'cs-root', 'hist-root', 'chem-root', 'phys-root'];
    const rootSpacing = 150;
    const startX = 400 - (rootNodes.filter(id => tree.nodes.find(n => n.id === id)).length - 1) * rootSpacing / 2;
    
    const targetPositions = new Map<string, { x: number; y: number }>();
    
    // Set Syntra position
    targetPositions.set('syntra', { x: 400, y: 80 });
    
    // Set root positions
    let rootIndex = 0;
    rootNodes.forEach(rootId => {
      if (tree.nodes.find(n => n.id === rootId)) {
        targetPositions.set(rootId, { 
          x: startX + rootIndex * rootSpacing, 
          y: 200
        });
        rootIndex++;
      }
    });
    
    // Calculate positions for all other nodes based on parent and siblings
    const calculatePosition = (nodeId: string, parentX: number, siblingIndex: number, totalSiblings: number) => {
      if (targetPositions.has(nodeId)) return targetPositions.get(nodeId)!;
      
      const depth = nodeDepths.get(nodeId) || 0;
      const y = 80 + depth * 110;
      
      // Horizontal spread based on siblings
      const spreadWidth = Math.min(200, 80 + totalSiblings * 30);
      const x = parentX - spreadWidth / 2 + (spreadWidth / (totalSiblings + 1)) * (siblingIndex + 1);
      
      targetPositions.set(nodeId, { x, y });
      return { x, y };
    };
    
    // BFS to calculate all positions
    const processNode = (nodeId: string, parentX: number) => {
      const children = childrenMap.get(nodeId) || [];
      children.forEach((childId, index) => {
        const pos = calculatePosition(childId, parentX, index, children.length);
        processNode(childId, pos.x);
      });
    };
    
    // Process from roots
    rootNodes.forEach(rootId => {
      if (tree.nodes.find(n => n.id === rootId)) {
        const rootPos = targetPositions.get(rootId)!;
        processNode(rootId, rootPos.x);
      }
    });
    processNode('syntra', 400);

   const initializedNodes = tree.nodes.map((treeNode) => {
  // Find the corresponding node in the current state (to preserve position)
  const existingNode = nodes.find(n => n.id === treeNode.id);
  const target = targetPositions.get(treeNode.id);
  
  // If node exists in state with a valid position, keep it
  if (existingNode && existingNode.position && existingNode.position.x !== 0 && existingNode.position.y !== 0) {
    return {
      ...treeNode,
      id: treeNode.id,
      x: existingNode.position.x,
      y: existingNode.position.y,
      vx: 0,
      vy: 0,
    };
  }
  
  // New node: start near target position with small random offset
  if (target) {
    return {
      ...treeNode,
      id: treeNode.id,
      x: target.x + (Math.random() - 0.5) * 30,
      y: target.y + (Math.random() - 0.5) * 30,
      vx: 0,
      vy: 0,
    };
  }
  
  // Fallback: center
  return {
    ...treeNode,
    id: treeNode.id,
    x: 400,
    y: 300,
    vx: 0,
    vy: 0,
  };
});

  // 👇 NOW filter d3Links using initializedNodes
  const d3Links = edges
    .filter(edge => {
      const sourceExists = initializedNodes.some((n: any) => n.id === edge.source);
      const targetExists = initializedNodes.some((n: any) => n.id === edge.target);
      
      if (!sourceExists || !targetExists) {
        console.warn(`⚠️  Skipping edge ${edge.id}: source=${sourceExists}, target=${targetExists}`);
      }
      
      return sourceExists && targetExists;
    })
    .map(edge => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
    }));

  console.log(`  🔗 Created ${d3Links.length} valid links from ${edges.length} edges`);

    const simulation = forceSimulation(initializedNodes as any) // 👈 Use initializedNodes
      .alphaDecay(0.05)
      .velocityDecay(0.6)
      .force('charge', forceManyBody().strength(-120))
      .force('collision', forceCollide().radius(95))
      
      // Pull toward calculated hierarchical positions
      .force('position', () => {
        initializedNodes.forEach((node: any) => { // 👈 Use initializedNodes
          const target = targetPositions.get(node.id);
          if (!target) return;
          
          const strength = node.id === 'syntra' ? 0.8 : 
                          node.id.includes('-root') ? 0.3 : 
                          0.2;
          
          node.vx += (target.x - node.x) * strength;
          node.vy += (target.y - node.y) * strength;
        });
      })
      
      // Vertical force to respect depth
      .force('y', forceY((d: any) => {
        const depth = nodeDepths.get(d.id) || 0;
        return 80 + depth * 110;
      }).strength((d: any) => {
        return d.id === 'syntra' ? 1.0 : 0.4;
      }))
      
      .force(
        'link',
        forceLink(d3Links)
          .id((d: any) => d.id)
          .distance((link: any) => {
            if (link.type === 'prereq') {
              return 90;
            }
            return 130;
          })
          .strength((link: any) => {
            if (link.type === 'prereq') {
              return 0.9;
            }
            return 0.4;
          })
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
      })
      .on('end', () => {
        console.log('✅ Layout complete - positions locked');
      });

    simulation.alpha(1).restart();

    return () => {
      simulation.stop();
    };
  }, [tree.nodes.length, tree.edges, setNodes]);

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
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView={!hasInitialFitView.current}
        onInit={() => {
          hasInitialFitView.current = true;
        }}
        attributionPosition="bottom-right"
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={true}
        zoomOnScroll={true}
        preventScrolling={false}
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
