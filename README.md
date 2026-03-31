# ZKAEDI Legal Clause Classifier

Production-ready legal contract clause labeling interface and dataset pipeline for training legal AI models.
Built on the same architecture as the ZKAEDI Solidity vulnerability classifier: Cloudflare Workers, Hono, D1, R2, KV.

---

## Architecture

| Component     | Technology                        |
|---------------|-----------------------------------|
| Runtime       | Cloudflare Workers (Hono)         |
| Database      | D1 (SQLite)                       |
| Storage       | R2 (exports, PDFs)                |
| Cache/Limits  | KV (rate limiting)                |
| Auth          | X-API-Key header                  |
| Frontend      | Single-file HTML, inline in Worker|

---

## Quick Start

### 1. Prerequisites

- Node.js 18+
- Cloudflare account with Workers, D1, KV, R2 enabled
- Wrangler CLI (`npm install -g wrangler`)

### 2. Install dependencies

```bash
npm install
```

### 3. Create Cloudflare resources

```bash
# Create D1 database
wrangler d1 create legal-clauses-db
# Copy the database_id from output → paste into wrangler.toml

# Create KV namespace
wrangler kv:namespace create RATE_LIMIT
# Copy the id from output → paste into wrangler.toml

# Create R2 bucket
wrangler r2 bucket create legal-clause-storage
```

### 4. Update wrangler.toml

Replace the placeholder IDs with the real ones from step 3:

```toml
[[d1_databases]]
binding = "DB"
database_name = "legal-clauses-db"
database_id = "YOUR-ACTUAL-D1-ID"

[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "YOUR-ACTUAL-KV-ID"
```

### 5. Initialize the database

```bash
# Run schema migration
wrangler d1 execute legal-clauses-db --file=schema.sql

# Load seed data (10 example clauses for demo)
wrangler d1 execute legal-clauses-db --file=seed.sql
```

### 6. Set secrets

```bash
# Set API key for authenticated access (unlimited rate limit)
wrangler secret put API_KEY
# Enter a strong random key when prompted
```

### 7. Deploy

```bash
wrangler deploy
```

### 8. Local development

```bash
npm run dev
# Visit http://localhost:8787
```

---

## Routes

| Route                   | Method | Auth     | Description                          |
|-------------------------|--------|----------|--------------------------------------|
| `/`                     | GET    | Public   | Dashboard — stats, leaderboard       |
| `/label`                | GET    | Public   | Labeling interface                   |
| `/health`               | GET    | Public   | Health check                         |
| `/api/contracts`        | POST   | API Key  | Create contract record               |
| `/api/clauses`          | POST   | API Key  | Submit labeled clause                |
| `/api/clauses/:id`      | GET    | API Key  | Get clause by ID                     |
| `/api/clauses/:id`      | PUT    | API Key  | Update clause labels                 |
| `/api/stats`            | GET    | API Key  | Dataset statistics                   |
| `/api/export/json`      | GET    | API Key  | Export dataset as JSON (HuggingFace) |
| `/api/export/csv`       | GET    | API Key  | Export dataset as CSV                |
| `/api/compute-prime`    | POST   | API Key  | Recompute PRIME energy features      |

---

## 19 Clause Classes

```
indemnification          limitation_of_liability    warranty_disclaimer
force_majeure            termination_for_convenience termination_for_cause
survival_clauses         transition_assistance      ip_ownership
ip_license_grant         data_protection            confidentiality
payment_terms            price_escalation           audit_rights
sla_performance          change_control             assignment_transfer
dispute_resolution
```

## Risk Severity Levels

| Level    | Meaning                                     |
|----------|---------------------------------------------|
| critical | Clause missing entirely or actively harmful |
| high     | Significantly below market standard         |
| medium   | Negotiable, minor gaps                      |
| low      | At or above market standard                 |
| standard | Boilerplate, no action needed               |

---

## PRIME Energy Features

Each labeled clause gets 4 computed energy features matching the ZKAEDI PRIME architecture:

| Feature                    | Legal Mapping                                                      |
|----------------------------|--------------------------------------------------------------------|
| `h0_base_energy`           | Inherent risk weight of clause type (indemnification = 0.9)        |
| `energy_amplification_factor` | Deviation from market standard (one-sided amplifies)           |
| `lyapunov_exponent`        | Sensitivity to interpretation (ambiguous language = high)          |
| `energy_at_trigger`        | Risk magnitude when clause fires (missing protections increase it) |

---

## Export Format (HuggingFace Compatible)

```json
[
  {
    "clause_id": "CLZ-00147",
    "source_contract_type": "SaaS_MSA",
    "clause_text": "Provider shall indemnify...",
    "clause_type": "indemnification",
    "risk_severity": "medium",
    "market_standard": true,
    "negotiability": "high",
    "missing_protections": ["cap_on_liability", "insurance_requirement"],
    "h0_base_energy": 0.9,
    "energy_amplification_factor": 1.82,
    "lyapunov_exponent": 0.8,
    "energy_at_trigger": 0.99,
    "jurisdiction": "california",
    "labeled_by": "attorney_003",
    "confidence": 0.85,
    "drafting_style": "defendant_friendly",
    "notes": "One-sided indemnification...",
    "created_at": "2024-12-01T09:15:00Z"
  }
]
```

---

## Rate Limiting

- **Unauthenticated:** 20 requests/hour per IP (KV-backed counter with 1-hour TTL)
- **Authenticated (`X-API-Key` header):** Unlimited
- Returns `429 Too Many Requests` with JSON error when exceeded

---

## Attorney Onboarding Guide

### What You're Doing

You're labeling contract clauses to build a training dataset for a legal AI classifier. Each clause you label teaches the model what "normal" looks like vs. what requires negotiation.

### How to Label

1. Open `/label` in your browser
2. **Paste a clause** into the text field
3. **Select contract metadata** (contract type, jurisdiction)
4. **Click the clause type** that best describes the clause (see 19 classes above)
5. **Select risk severity**:
   - CRITICAL — missing or actively harmful
   - HIGH — significantly below market standard
   - MEDIUM — negotiable, minor issues
   - LOW — at or above market standard
   - STANDARD — boilerplate, no concerns
6. **Set metadata toggles**:
   - Market standard: Is this clause typical for this contract type?
   - Negotiability: How much room is there to negotiate?
   - Drafting style: Who does the language favor?
7. **Check missing protections** that should be in this clause but aren't
8. **Add notes** for anything important to flag
9. Click **SUBMIT + NEXT** (or press Enter)

### Keyboard Shortcuts

| Key   | Action              |
|-------|---------------------|
| 1     | Severity: Critical  |
| 2     | Severity: High      |
| 3     | Severity: Medium    |
| 4     | Severity: Low       |
| 5     | Severity: Standard  |
| Enter | Submit clause       |
| Esc   | Clear form          |

### Quality Guidelines

- Label what the clause **actually says**, not what it should say
- If a clause covers multiple types, pick the **primary type**
- "Market standard" means: is this typical language for this contract type in this jurisdiction?
- Flag ambiguous language in **Notes** — that's signal, not noise
- Your labeler ID will track your contributions. Use a consistent identifier.

### Target: 2,000–2,500 high-quality labeled clauses across all 19 types

---

## Database Schema

See `schema.sql` for the full D1 schema. Tables:
- `contracts` — contract metadata
- `clauses` — labeled training data (the core table)
- `labelers` — attorney/paralegal accounts
- `exports` — export history

---

## TypeScript Check

```bash
npm run typecheck
```

---

## License

Internal tool. Not for distribution.