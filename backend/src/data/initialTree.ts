export const initialTree: KnowledgeTree = {
  nodes: [
    {
      id: "syntra",
      label: "Syntra",
      subject: "Other",
      masteryLevel: "none",
    },
    {
      id: "math-root",
      label: "Mathematics",
      subject: "Math",
      masteryLevel: "none",
      parents: ["syntra"],
    },
    {
      id: "cs-root",
      label: "Computer Science",
      subject: "CS",
      masteryLevel: "none",
      parents: ["syntra"],
    },
    {
      id: "hist-root",
      label: "History",
      subject: "History",
      masteryLevel: "none",
      parents: ["syntra"],
    },
    {
      id: "chem-root",  // 👈 Add this
      label: "Chemistry",
      subject: "Chemistry",
      masteryLevel: "none",
      parents: ["syntra"],
    },
    {
      id: "phys-root",  // 👈 Add this
      label: "Physics",
      subject: "Physics",
      masteryLevel: "none",
      parents: ["syntra"],
    },
    {
      id: "calc",
      label: "Calculus",
      subject: "Math",
      masteryLevel: "none",
      parents: ["math-root"],
      tags: ["derivatives", "integrals"],
    },
    {
      id: "lin-alg",
      label: "Linear Algebra",
      subject: "Math",
      masteryLevel: "none",
      parents: ["math-root"],
      tags: ["vectors", "matrices"],
    },
    {
      id: "nn",
      label: "Neural Networks",
      subject: "CS",
      masteryLevel: "none",
      parents: ["cs-root"],
      tags: ["machine learning", "deep learning"],
    },
    {
      id: "cold-war",
      label: "Cold War",
      subject: "History",
      masteryLevel: "none",
      parents: ["hist-root"],
      tags: ["20th century", "politics"],
    },
  ],
  edges: [
    { id: "lin-alg-nn", from: "lin-alg", to: "nn", type: "related" },
  ],
};
