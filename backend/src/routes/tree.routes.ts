import express from "express";
import { treeService } from "../services/treeService";

const router = express.Router();

router.get("/", (req, res) => {
  const tree = treeService.getTree();
  res.json(tree);
});

router.post("/nodes", (req, res) => {
  const { label, subject, parents } = req.body;

  if (!label || !subject) {
    return res.status(400).json({ error: "Label and subject are required" });
  }

  // If no parents specified, default to syntra root
  const nodeParents = parents && parents.length > 0 ? parents : ["syntra"];

  const newNode = treeService.addNode({
    label,
    subject,
    parents: nodeParents,
    masteryLevel: "none",
  });

  res.status(201).json(newNode);
});

router.post("/edges", (req, res) => {
  const { from, to, type } = req.body;

  if (!from || !to || !type) {
    return res.status(400).json({ error: "from, to, and type are required" });
  }

  const newEdge = treeService.addEdge({ from, to, type });
  res.status(201).json(newEdge);
});

router.patch("/nodes/:id", (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const updatedNode = treeService.updateNode(id, updates);

  if (!updatedNode) {
    return res.status(404).json({ error: "Node not found" });
  }

  res.json(updatedNode);
});

export default router;
