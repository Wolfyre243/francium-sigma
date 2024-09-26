# Welcome!

This is francium-Σ, a dockerised server that holds together an Ollama server instance and a Postgres Vector Database, both of which are also dockerised images.
francium-Σ serves as the Main Server of the entire Francium ecosystem, housing both the LLMs (Ollama) and the core knowledge base (pgvector) for their RAG systems.

The server works by creating API endpoints for the other interfaces to interact with the LLMs, instead of repeating myself over and over inside the many applications.

I will be documenting most, if not all (hopefully), of these many endpoints.

### Interface support

This is quite irrelevant to whoever is reading this since the project isn't really production ready, but here it is anyway:

- francium-chat: ⛔
- francium-discord: ❓(should probably work ✅)
- francium-curl: ❓

*Note that the interfaces listed are not necessarily implemented yet; It's a one man project you know!

More stuff to come!

### Learn More
Project Francium is a project I started in order to create an omnipotent virtual assistant/friend.
This chat interface will be one of the many interfaces I will create to interact with the chatbot.
I also aspire to create my own model, though that will be in the backlog for a while.
