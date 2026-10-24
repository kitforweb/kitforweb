export const mermaidTemplates = {
  flowchart: `flowchart LR
  A[Paste anything] --> B{Detector}
  B -->|JSON| C[JSON Formatter]
  B -->|JWT| D[JWT Decoder]
  B -->|Mermaid| E[Mermaid Editor]
  C --> F((Done))
  D --> F
  E --> F`,
  sequence: `sequenceDiagram
  autonumber
  participant B as Browser
  participant A as API
  participant D as Database
  B->>A: POST /login
  A->>D: SELECT user
  D-->>A: user row
  A-->>B: 200 OK + JWT
  Note over B,A: The token is stored in memory`,
  class: `classDiagram
  class Tool {
    +string id
    +boolean sensitive
    +load() Component
  }
  class Detector {
    +detect(input) Detection
  }
  Tool <|-- JsonFormatter
  Tool <|-- JwtDecoder
  Detector ..> Tool : opens`,
  state: `stateDiagram-v2
  [*] --> Idle
  Idle --> Typing : keypress
  Typing --> Processing : debounce
  Processing --> Valid
  Processing --> Error
  Error --> Typing : fix
  Valid --> [*]`,
  er: `erDiagram
  USER ||--o{ ORDER : places
  ORDER ||--|{ ORDER_ITEM : contains
  PRODUCT ||--o{ ORDER_ITEM : "is in"
  USER {
    int id PK
    string email
  }
  ORDER {
    int id PK
    int user_id FK
    date created_at
  }`,
  gantt: `gantt
  title Release plan
  dateFormat YYYY-MM-DD
  section Base
  Layout and i18n     :done, a1, 2026-01-05, 10d
  Shared components   :active, a2, after a1, 7d
  section Tools
  Reference tools     :a3, after a2, 10d
  Remaining tools     :a4, after a3, 30d`,
  pie: `pie title Bytes sent to our servers
  "Your data" : 0
  "Static assets" : 100`,
  mindmap: `mindmap
  root((kitforweb))
    JSON
      Formatter
      Diff
    Tokens
      JWT
      Base64
    CSS
      clamp
      Colors`,
} as const;

export type MermaidTemplate = keyof typeof mermaidTemplates;
