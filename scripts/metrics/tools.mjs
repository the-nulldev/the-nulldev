const fallback = (monogram, color) => ({ monogram, color });

export const TOOL_CATEGORIES = [
  {
    title: 'AI & agents',
    tools: [
      { slug: 'python', name: 'Python', icon: 'python' },
      { slug: 'langgraph', name: 'LangGraph', icon: 'langgraph' },
      { slug: 'llamaindex', name: 'LlamaIndex', ...fallback('LI', '#7c3aed') },
      { slug: 'mcp', name: 'MCP', icon: 'modelcontextprotocol' },
      { slug: 'a2a', name: 'A2A', ...fallback('A2A', '#4285f4') },
      { slug: 'agent-skills', name: 'Agent Skills', ...fallback('AS', '#58a6ff') },
      { slug: 'pydantic', name: 'Pydantic', icon: 'pydantic' },
      { slug: 'nemo-guardrails', name: 'NeMo Guardrails', icon: 'nvidia' },
    ],
  },
  {
    title: 'Data & evaluation',
    tools: [
      { slug: 'postgresql', name: 'PostgreSQL', icon: 'postgresql' },
      { slug: 'pgvector', name: 'pgvector', ...fallback('pg', '#336791') },
      { slug: 'qdrant', name: 'Qdrant', icon: 'qdrant' },
      { slug: 'pinecone', name: 'Pinecone', ...fallback('P', '#22a884') },
      { slug: 'langfuse', name: 'Langfuse', ...fallback('Lf', '#e879f9') },
      { slug: 'langsmith', name: 'LangSmith', icon: 'langchain' },
      { slug: 'deepeval', name: 'DeepEval', ...fallback('DE', '#5b8def') },
      { slug: 'ragas', name: 'Ragas', ...fallback('Rg', '#f59e0b') },
      { slug: 'weights-and-biases', name: 'Weights & Biases', icon: 'weightsandbiases' },
    ],
  },
  {
    title: 'Cloud & platform',
    tools: [
      { slug: 'kubernetes', name: 'Kubernetes', icon: 'kubernetes' },
      { slug: 'docker', name: 'Docker', icon: 'docker' },
      { slug: 'aws', name: 'AWS', ...fallback('AWS', '#ff9900') },
      { slug: 'google-cloud', name: 'Google Cloud', icon: 'googlecloud' },
      { slug: 'azure', name: 'Azure', ...fallback('AZ', '#0078d4') },
      { slug: 'terraform', name: 'Terraform', icon: 'terraform' },
      { slug: 'github-actions', name: 'GitHub Actions', icon: 'githubactions' },
      { slug: 'linux', name: 'Linux', icon: 'linux' },
      { slug: 'cloudflare', name: 'Cloudflare', icon: 'cloudflare' },
    ],
  },
  {
    title: 'Workspace',
    tools: [
      { slug: 'junie', name: 'Junie', icon: 'jetbrains' },
      { slug: 'claude-code', name: 'Claude Code', icon: 'claude' },
      { slug: 'cursor', name: 'Cursor', icon: 'cursor' },
      { slug: 'youtrack', name: 'YouTrack', ...fallback('YT', '#ff318c') },
      { slug: 'trello', name: 'Trello', icon: 'trello' },
      { slug: 'obsidian', name: 'Obsidian', icon: 'obsidian' },
      { slug: 'bash', name: 'Bash', icon: 'gnubash' },
    ],
  },
];

export const TOOLS = TOOL_CATEGORIES.flatMap(({ title, tools }) => tools.map((tool) => ({ ...tool, category: title })));
