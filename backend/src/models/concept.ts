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
  parents?: string[];  // 👈 NEW: Auto-generates prereq edges
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
  edges: ConceptEdge[];  // Manual edges for related/merge
}
