import { KnowledgeTree, ConceptNode, ConceptEdge } from "../models/concept";
import { initialTree } from "../data/initialTree";

let currentTree: KnowledgeTree = JSON.parse(JSON.stringify(initialTree));

// Auto-generate edges from parent relationships
function generateEdgesFromParents(nodes: ConceptNode[]): ConceptEdge[] {
  const generatedEdges: ConceptEdge[] = [];
  
  nodes.forEach(node => {
    if (node.parents && node.parents.length > 0) {
      node.parents.forEach(parentId => {
        generatedEdges.push({
          id: `${parentId}-${node.id}`,
          from: parentId,
          to: node.id,
          type: "prereq"
        });
      });
    }
  });
  
  return generatedEdges;
}

export const treeService = {
  getTree: (): KnowledgeTree => {
    // Combine auto-generated edges with manual edges
    const autoEdges = generateEdgesFromParents(currentTree.nodes);
    const allEdges = [...autoEdges, ...currentTree.edges];
    
    return {
      nodes: currentTree.nodes,
      edges: allEdges
    };
  },

  addNode: (node: Omit<ConceptNode, "id">): ConceptNode => {
    const newNode: ConceptNode = {
      ...node,
      id: node.label.toLowerCase().replace(/\s+/g, "-"),
      masteryLevel: node.masteryLevel || "none",
    };

    currentTree.nodes.push(newNode);
    return newNode;
  },

  addEdge: (edge: Omit<ConceptEdge, "id">): ConceptEdge => {
    const newEdge: ConceptEdge = {
      ...edge,
      id: `${edge.from}-${edge.to}`,
    };

    currentTree.edges.push(newEdge);
    return newEdge;
  },

  updateNode: (id: string, updates: Partial<ConceptNode>): ConceptNode | null => {
    const nodeIndex = currentTree.nodes.findIndex((n) => n.id === id);
    if (nodeIndex === -1) return null;

    currentTree.nodes[nodeIndex] = {
      ...currentTree.nodes[nodeIndex],
      ...updates,
    };

    return currentTree.nodes[nodeIndex];
  },
};
