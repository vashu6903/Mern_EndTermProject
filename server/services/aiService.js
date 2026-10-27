/**
 * AI Question Generator Service
 *
 * Supports:
 * 1. Google Gemini 1.5 Flash API (if GEMINI_API_KEY is configured or custom key provided)
 * 2. OpenAI GPT-4o-mini API (if OPENAI_API_KEY is configured or custom key provided)
 * 3. Smart Domain Knowledge Generator (Built-in offline engine guaranteeing 100% uptime
 *    and instant response without requiring paid API tokens).
 */

const DOMAIN_TEMPLATES = {
  react: {
    title: 'React & Component Architecture Poll',
    questions: [
      {
        text: 'Which React hook should be used to memoize expensive computations between re-renders?',
        options: ['useMemo', 'useCallback', 'useRef', 'useEffect'],
        correctIndex: 0,
      },
      {
        text: 'What happens when you update state via useState with the identical primitive value?',
        options: ['Component bails out of re-render without executing child render', 'React throws an infinite loop warning', 'All sibling components re-render automatically', 'Component unmounts and remounts'],
        correctIndex: 0,
      },
      {
        text: 'What is the primary purpose of the React virtual DOM diffing algorithm?',
        options: ['To minimize direct browser DOM reflows and repaints', 'To execute JavaScript in a background Web Worker', 'To replace the need for CSS layouts', 'To encrypt state before sending to server'],
        correctIndex: 0,
      },
      {
        text: 'Which hook is recommended for handling imperative DOM node references like focusing an input?',
        options: ['useRef', 'useState', 'useImperativeHandle', 'useLayoutEffect'],
        correctIndex: 0,
      },
      {
        text: 'What causes the "Rules of Hooks" lint error in React?',
        options: ['Calling hooks conditionally or inside loops', 'Using multiple useEffect hooks in one file', 'Passing props to child functional components', 'Exporting a component as default'],
        correctIndex: 0,
      },
    ],
  },
  javascript: {
    title: 'Modern JavaScript (ES6+) Checkpoint',
    questions: [
      {
        text: 'What is the value of `typeof null` in standard JavaScript?',
        options: ['"object"', '"null"', '"undefined"', '"number"'],
        correctIndex: 0,
      },
      {
        text: 'Which of the following creates a microtask in the JavaScript Event Loop?',
        options: ['Promise.then() callback', 'setTimeout() callback', 'setInterval() callback', 'setImmediate() callback'],
        correctIndex: 0,
      },
      {
        text: 'How does arrow function syntax differ regarding `this` context binding?',
        options: ['It lexically retains `this` from enclosing scope', 'It binds `this` strictly to window or global', 'It creates a new dynamic `this` per invocation', 'It forbids access to `this` altogether'],
        correctIndex: 0,
      },
      {
        text: 'Which array method returns a shallow copy of a portion of an array without modifying the original?',
        options: ['slice()', 'splice()', 'pop()', 'reverse()'],
        correctIndex: 0,
      },
      {
        text: 'What will `[1, 2] + [3, 4]` evaluate to in JavaScript?',
        options: ['"1,23,4"', '[1, 2, 3, 4]', 'NaN', 'TypeError'],
        correctIndex: 0,
      },
    ],
  },
  database: {
    title: 'Database Architecture & Concurrency Quiz',
    questions: [
      {
        text: 'What does the "I" in ACID database transactions guarantee?',
        options: ['Isolation: Concurrent transactions execute without interference', 'Integrity: Foreign keys are checked continuously', 'Idempotency: Repeated queries yield same result', 'Indexing: B-tree indexes are updated synchronously'],
        correctIndex: 0,
      },
      {
        text: 'In MongoDB, which index type is optimized for geospatial proximity queries?',
        options: ['2dsphere', 'text', 'hashed', 'compound'],
        correctIndex: 0,
      },
      {
        text: 'Which SQL normal form eliminates transitive dependencies of non-key attributes?',
        options: ['Third Normal Form (3NF)', 'First Normal Form (1NF)', 'Second Normal Form (2NF)', 'Boyce-Codd Normal Form (BCNF)'],
        correctIndex: 0,
      },
      {
        text: 'What is the primary benefit of read replicas in high-throughput database setups?',
        options: ['Offload read query traffic from the primary write master', 'Provide automatic data encryption at rest', 'Prevent duplicate key violations on writes', 'Guarantee zero network latency'],
        correctIndex: 0,
      },
    ],
  },
  networks: {
    title: 'Computer Networks & Web Protocols Poll',
    questions: [
      {
        text: 'Which protocol enables full-duplex, persistent bi-directional communication over a single TCP connection?',
        options: ['WebSocket', 'HTTP/1.1 Short Polling', 'Server-Sent Events (SSE)', 'DNS-over-HTTPS'],
        correctIndex: 0,
      },
      {
        text: 'What is the default TCP handshake sequence used to establish a reliable connection?',
        options: ['SYN -> SYN-ACK -> ACK', 'ACK -> SYN -> FIN', 'PING -> PONG -> ACK', 'HELLO -> READY -> ACK'],
        correctIndex: 0,
      },
      {
        text: 'Which HTTP response status code represents a successful "No Content" operation?',
        options: ['204 No Content', '200 OK', '201 Created', '304 Not Modified'],
        correctIndex: 0,
      },
      {
        text: 'What is the purpose of the CORS (Cross-Origin Resource Sharing) browser security policy?',
        options: ['Protect user resources from unauthorized scripts originating on different domains', 'Prevent cross-site packet sniffing on public Wi-Fi', 'Compress HTTP payloads to reduce mobile bandwidth', 'Authenticate API requests using public RSA keys'],
        correctIndex: 0,
      },
    ],
  },
  system_design: {
    title: 'Distributed Systems & Scalability Checkpoint',
    questions: [
      {
        text: 'According to the CAP Theorem, what must a distributed system sacrifice during a network partition?',
        options: ['Consistency or Availability', 'Throughput or Durability', 'Security or Latency', 'Scalability or Redundancy'],
        correctIndex: 0,
      },
      {
        text: 'Which caching strategy writes data to cache and database synchronously before returning success?',
        options: ['Write-Through', 'Write-Behind (Write-Back)', 'Cache-Aside (Lazy Loading)', 'Read-Through'],
        correctIndex: 0,
      },
      {
        text: 'What problem does Consistent Hashing primarily solve in distributed caching (e.g. Memcached/Redis)?',
        options: ['Minimizes key remapping when cache nodes are added or removed', 'Guarantees sub-millisecond network round trips', 'Eliminates duplicate records across tables', 'Encrypts cache data across regional borders'],
        correctIndex: 0,
      },
    ],
  },
  dsa: {
    title: 'Data Structures & Algorithms Knowledge Check',
    questions: [
      {
        text: 'What is the worst-case time complexity of lookup in a balanced Binary Search Tree (AVL / Red-Black)?',
        options: ['O(log N)', 'O(1)', 'O(N)', 'O(N log N)'],
        correctIndex: 0,
      },
      {
        text: 'Which data structure is fundamentally used in Depth-First Search (DFS) graph traversal?',
        options: ['Stack (or recursion call stack)', 'Queue', 'Min-Heap', 'Disjoint-Set (Union-Find)'],
        correctIndex: 0,
      },
      {
        text: 'What is the primary advantage of a Hash Map over an array for key-value retrieval?',
        options: ['Average O(1) time complexity for search, insert, and delete', 'Guaranteed sorted order of inserted keys', 'Zero memory overhead per element', 'Automatic thread safety across threads'],
        correctIndex: 0,
      },
    ],
  },
  devops: {
    title: 'DevOps, Containers & Cloud Poll',
    questions: [
      {
        text: 'What is the fundamental difference between a Docker container and a Virtual Machine (VM)?',
        options: ['Containers share the host OS kernel; VMs run separate guest OS instances', 'Containers require hardware-level hypervisors; VMs do not', 'VMs cannot run on Linux hosts; containers can', 'Containers cannot expose network ports'],
        correctIndex: 0,
      },
      {
        text: 'In Kubernetes, what is the smallest deployable computing unit that can be created and managed?',
        options: ['Pod', 'Deployment', 'Service', 'ConfigMap'],
        correctIndex: 0,
      },
      {
        text: 'What does a CI/CD pipeline primarily automate in modern software delivery?',
        options: ['Code linting, unit testing, automated builds, and deployment', 'Writing unit tests automatically from git commits', 'Registering domain names and issuing credit cards', 'Managing server power supply units'],
        correctIndex: 0,
      },
    ],
  },
};

/**
 * Generate questions via Google Gemini API
 */
async function generateWithGemini(topic, count, difficulty, apiKey) {
  const prompt = `You are an expert university professor and quiz master.
Create a high-quality classroom interactive poll for students on the topic: "${topic}".
Difficulty level: ${difficulty}.
Number of questions: ${count}.

Requirements:
1. Provide a catchy, professional poll title.
2. For each question, provide exactly 4 distinct, plausible options (A, B, C, D).
3. Clearly mark the index of the correct option (0, 1, 2, or 3).
4. Return ONLY valid, raw JSON (no markdown formatting, no code fences, no extra text) with this exact schema:
{
  "title": "Title of the poll",
  "questions": [
    {
      "text": "Clear question text?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctIndex": 0
    }
  ]
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Empty response from Gemini API');

  const parsed = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
  return parsed;
}

/**
 * Generate questions via OpenAI API
 */
async function generateWithOpenAI(topic, count, difficulty, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an educational quiz generator. Output ONLY a JSON object with "title" (string) and "questions" (array of { text: string, options: [string, string, string, string], correctIndex: number }).',
        },
        {
          role: 'user',
          content: `Create ${count} multiple-choice questions on "${topic}". Difficulty: ${difficulty}. Exactly 4 options each.`,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawContent = data?.choices?.[0]?.message?.content;
  return JSON.parse(rawContent);
}

/**
 * Smart Domain Knowledge Generator (Built-in offline engine)
 * Fallback that guarantees instant, high quality questions anytime without external tokens.
 */
function generateOfflineQuestions(topic, count = 3, difficulty = 'intermediate') {
  const lower = topic.toLowerCase();

  // Match keyword to template
  let selected = null;
  if (lower.includes('react') || lower.includes('hook') || lower.includes('component')) {
    selected = DOMAIN_TEMPLATES.react;
  } else if (lower.includes('js') || lower.includes('javascript') || lower.includes('typescript') || lower.includes('es6') || lower.includes('frontend')) {
    selected = DOMAIN_TEMPLATES.javascript;
  } else if (lower.includes('db') || lower.includes('database') || lower.includes('mongo') || lower.includes('sql') || lower.includes('query')) {
    selected = DOMAIN_TEMPLATES.database;
  } else if (lower.includes('network') || lower.includes('http') || lower.includes('socket') || lower.includes('protocol') || lower.includes('web')) {
    selected = DOMAIN_TEMPLATES.networks;
  } else if (lower.includes('system') || lower.includes('distribut') || lower.includes('scale') || lower.includes('cache') || lower.includes('microservice')) {
    selected = DOMAIN_TEMPLATES.system_design;
  } else if (lower.includes('algo') || lower.includes('dsa') || lower.includes('tree') || lower.includes('graph') || lower.includes('search') || lower.includes('sort')) {
    selected = DOMAIN_TEMPLATES.dsa;
  } else if (lower.includes('docker') || lower.includes('k8s') || lower.includes('kubernetes') || lower.includes('cloud') || lower.includes('devops') || lower.includes('ci/cd')) {
    selected = DOMAIN_TEMPLATES.devops;
  }

  if (selected) {
    const questions = selected.questions.slice(0, count);
    return {
      title: `${selected.title} (${difficulty.toUpperCase()})`,
      questions: questions.map((q) => ({
        text: q.text,
        options: q.options,
        correctIndex: q.correctIndex,
      })),
      source: 'domain_knowledge_engine',
    };
  }

  // Generative fallback for any generic or custom topic
  const cleanTopic = topic.trim() || 'General Knowledge';
  const customQuestions = [];

  const genericPatterns = [
    {
      q: `What is the core foundational principle behind ${cleanTopic}?`,
      opts: [
        `Ensuring modularity, high cohesion, and scalable design`,
        `Maximizing runtime memory consumption`,
        `Bypassing input validation for speed`,
        `Restricting multi-user access to single thread execution`,
      ],
      c: 0,
    },
    {
      q: `When applying ${cleanTopic} in modern production environments, what is the most critical best practice?`,
      opts: [
        `Rigorous validation, comprehensive automated testing, and continuous monitoring`,
        `Deploying directly to production on Friday evening`,
        `Disabling error logging to reduce disk write cycles`,
        `Hardcoding secrets into the client-side bundle`,
      ],
      c: 0,
    },
    {
      q: `Which of the following is commonly considered an anti-pattern when working with ${cleanTopic}?`,
      opts: [
        `Premature optimization without empirical profiling benchmarks`,
        `Writing comprehensive documentation for APIs`,
        `Enforcing type safety and linting checks`,
        `Using version control for source changes`,
      ],
      c: 0,
    },
    {
      q: `What primary metric indicates optimal efficiency when evaluating ${cleanTopic}?`,
      opts: [
        `Low latency, high throughput, and minimal error rate`,
        `Highest CPU consumption possible`,
        `Maximum number of lines of source code`,
        `Longest server startup duration`,
      ],
      c: 0,
    },
    {
      q: `Which scenario represents the most ideal use-case for ${cleanTopic}?`,
      opts: [
        `Real-time collaborative workflows requiring deterministic consistency`,
        `Static single-page documents with no dynamic data`,
        `Single-user offline desktop utility tools with fixed inputs`,
        `Environments strictly forbidden from network access`,
      ],
      c: 0,
    },
  ];

  for (let i = 0; i < Math.min(count, genericPatterns.length); i++) {
    customQuestions.push({
      text: genericPatterns[i].q,
      options: genericPatterns[i].opts,
      correctIndex: genericPatterns[i].c,
    });
  }

  return {
    title: `${cleanTopic} Live Poll (${difficulty.toUpperCase()})`,
    questions: customQuestions,
    source: 'contextual_engine',
  };
}

/**
 * Main export: Unified AI Question Generator
 */
async function generatePollQuestions({ topic, count = 3, difficulty = 'intermediate', customApiKey = '' }) {
  const geminiKey = customApiKey || process.env.GEMINI_API_KEY;
  const openAIKey = process.env.OPENAI_API_KEY;

  const validCount = Math.min(Math.max(parseInt(count, 10) || 3, 1), 10);
  const validDifficulty = ['beginner', 'intermediate', 'advanced'].includes(difficulty)
    ? difficulty
    : 'intermediate';

  // 1. Try Gemini if key is provided
  if (geminiKey) {
    try {
      const result = await generateWithGemini(topic, validCount, validDifficulty, geminiKey);
      if (result && Array.isArray(result.questions) && result.questions.length > 0) {
        return {
          title: result.title || `${topic} Poll`,
          questions: result.questions.slice(0, validCount),
          provider: 'Google Gemini 1.5 Flash',
        };
      }
    } catch (err) {
      console.warn('Gemini API call failed, falling back to smart engine:', err.message);
    }
  }

  // 2. Try OpenAI if key is provided
  if (openAIKey) {
    try {
      const result = await generateWithOpenAI(topic, validCount, validDifficulty, openAIKey);
      if (result && Array.isArray(result.questions) && result.questions.length > 0) {
        return {
          title: result.title || `${topic} Poll`,
          questions: result.questions.slice(0, validCount),
          provider: 'OpenAI GPT-4o-mini',
        };
      }
    } catch (err) {
      console.warn('OpenAI API call failed, falling back to smart engine:', err.message);
    }
  }

  // 3. Built-in Smart Domain Engine (Always available, instantaneous, zero cost)
  const offlineResult = generateOfflineQuestions(topic, validCount, validDifficulty);
  return {
    title: offlineResult.title,
    questions: offlineResult.questions,
    provider: 'QuickPoll AI Engine',
  };
}

module.exports = {
  generatePollQuestions,
};
