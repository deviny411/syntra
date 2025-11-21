#Syntra
AI-powered learning companion that transforms any subject into an interactive knowledge map. Visualize, connect, and master topics with personalized AI recommendations, mastery tracking, and seamless integration of real-world learning resources.

#**CHECK OUT OUR DEMO HERE**
https://youtu.be/65d3eaMDW3M 

##📚 Inspiration
Learning complex topics often feels like navigating a maze: disconnected concepts, no clear path forward, and no feedback on what’s mastered. Syntra was inspired by the need for a tool that not only aggregates the world’s learning resources but actively helps users see and build their understanding—concept by concept, connection by connection.

##🚀 What it does
Interactive Knowledge Graph: Visualize your knowledge as a dynamic, AI-structured map.

Automatic Connections: Gemini AI links new topics to related nodes and finds subtopics within each concept.

Resource Aggregation: Instantly pulls Wikipedia summaries, YouTube tutorials, and arXiv papers as you explore.

Mastery Tracking: Update your understanding with a single click—your progress is visualized and analyzed.

AI Recommendations: Snowflake logs every interaction; Mistral and Cortex AI analyze your patterns, recommending what to learn next and where to bridge knowledge gaps.

Subtopic Generation & Bridge Topics: Intra-Explore unveils granular subtopics, and AI builds bridges between seemingly distant areas—no more blind spots in your learning.

##🛠️ How we built it
Frontend: React + Vite for a fast, interactive UI; D3 and XYFlow for force-directed graph visualization.

Backend: Node.js + Express/TypeScript APIs for graph/knowledge management and resource aggregation.

AI & Data Layer:

Gemini AI for semantic node linking, bridge topics, and subtopic generation.

Python microservice (FastAPI/Flask) for analytics, mastery calculation, and integrating with...

Snowflake (data warehouse): Logging user activity and learning paths at scale.

Mistral & Cortex AI: Analyze data for mastery score, pattern recognition, and real-time topic recommendations.

APIs: Real-time scraping/fetching from Wikipedia, YouTube Data API, arXiv, with future plans for Khan Academy and news.

DevOps: Modular microservice structure, code-splitting, RESTful interfaces, and local-remote mode support.

##🧱 Challenges we ran into
AI Integration: prompt engineering for Gemini to give robust, controlled chains/subtopics and minimize hallucinations.

Analytics Pipelining: Designing the interaction log/mastery calculation flows to work smoothly across REST (Node) and analytics (Python/Snowflake).

Graph Visualization: Efficiently rendering large, growing graphs with force-directed layouts and real-time edge/node styling.

Domain Scaling: Creating subject-agnostic routines for node-linking, subtopic extraction, and mastery analytics.

##✨ Accomplishments that we're proud of
Reliable multi-level mastery tracking, supporting both manual and data-driven updates.

Seamless AI-driven graph linking and subtopic/bridge node generation.

Real-time integration of learning resources—articles, videos, papers—without page reloads or blocking.

Robust logging and analysis pipeline for personalized mastery and recommendation.

##🧠 What we learned
The value of decoupling slow content (arXiv) from instant knowledge (Wikipedia/YouTube/IQ).

How to tune AI prompts for "just right" knowledge chaining, not overshooting generic or overconnected topics.

How mastery is best represented not as a static value but as a dynamic function of actual user behaviors.

How enterprise-grade analytics (Snowflake) can power personalized learning at any scale.

##⏭️ What's next for Syntra
Integrations: Add Khan Academy, news article APIs, and other educational resources.

Collaborative Analytics: Use Cortex to analyze aggregate user paths and success, feeding those insights back into recommendations for all users.

Deeper Semantic Search: Vertex AI/embedding-based search for resources and graph linking.

Mobile App & Offline Support: For universal, accessible, and context-aware learning.

Public API and Plugins: Help third parties extend Syntra’s brain into their platforms.
