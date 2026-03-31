import { Hono } from 'hono';
import { cors } from 'hono/cors';

// ─── Environment Bindings ──────────────────────────────────────────────────────

export interface Env {
  DB: D1Database;
  RATE_LIMIT: KVNamespace;
  STORAGE: R2Bucket;
  API_KEY: string;
  CORS_ORIGINS: string;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Clause {
  id: string;
  contract_id: string;
  clause_text: string;
  clause_type: string;
  risk_severity: string;
  market_standard: boolean | number;
  negotiability: string;
  missing_protections: string | null;
  drafting_style: string | null;
  h0_base_energy: number | null;
  energy_amplification_factor: number | null;
  lyapunov_exponent: number | null;
  energy_at_trigger: number | null;
  jurisdiction: string | null;
  labeled_by: string;
  confidence: number | null;
  notes: string | null;
  created_at: string;
}

interface PrimeFeatures {
  h0: number;
  amplification: number;
  lyapunov: number;
  triggerEnergy: number;
}

// ─── PRIME Energy Computation ──────────────────────────────────────────────────

function computePrimeFeatures(clause: {
  clause_type: string;
  risk_severity: string;
  market_standard: boolean | number;
  negotiability: string;
  missing_protections: string | null;
}): PrimeFeatures {
  const baseEnergyMap: Record<string, number> = {
    indemnification: 0.9,
    limitation_of_liability: 0.95,
    warranty_disclaimer: 0.7,
    force_majeure: 0.6,
    termination_for_convenience: 0.75,
    termination_for_cause: 0.7,
    survival_clauses: 0.4,
    transition_assistance: 0.5,
    ip_ownership: 0.85,
    ip_license_grant: 0.8,
    data_protection: 0.85,
    confidentiality: 0.6,
    payment_terms: 0.5,
    price_escalation: 0.65,
    audit_rights: 0.55,
    sla_performance: 0.7,
    change_control: 0.45,
    assignment_transfer: 0.6,
    dispute_resolution: 0.65,
  };

  const h0 = baseEnergyMap[clause.clause_type] ?? 0.5;

  const severityMult: Record<string, number> = {
    critical: 2.5,
    high: 2.0,
    medium: 1.3,
    low: 0.8,
    standard: 0.5,
  };
  const isMarketStandard =
    clause.market_standard === true || clause.market_standard === 1;
  const amplification =
    (severityMult[clause.risk_severity] ?? 1.3) * (isMarketStandard ? 0.7 : 1.4);

  const lyapunovMap: Record<string, number> = {
    high: 0.8,
    medium: 0.5,
    low: 0.25,
    none: 0.1,
  };
  const lyapunov = lyapunovMap[clause.negotiability] ?? 0.5;

  let missingCount = 0;
  if (clause.missing_protections) {
    try {
      const parsed = JSON.parse(clause.missing_protections);
      missingCount = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      missingCount = 0;
    }
  }
  const triggerEnergy = Math.min(1.0, h0 * (1 + missingCount * 0.15));

  return { h0, amplification, lyapunov, triggerEnergy };
}

// ─── Rate Limiting ─────────────────────────────────────────────────────────────

async function checkRateLimit(
  kv: KVNamespace,
  ip: string
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:${ip}`;
  const limit = 20;
  const windowSeconds = 3600;

  const existing = await kv.get(key);
  if (!existing) {
    await kv.put(key, '1', { expirationTtl: windowSeconds });
    return { allowed: true, remaining: limit - 1 };
  }

  const count = parseInt(existing, 10);
  if (count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  await kv.put(key, String(count + 1), { expirationTtl: windowSeconds });
  return { allowed: true, remaining: limit - count - 1 };
}

// ─── Auth Middleware Helper ─────────────────────────────────────────────────────

function isAuthenticated(apiKey: string | undefined, envKey: string | undefined): boolean {
  if (!envKey) return false;
  return apiKey === envKey;
}

// ─── HTML Templates ────────────────────────────────────────────────────────────

function htmlShell(title: string, body: string, extraHead = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${title} — ZKAEDI Legal Classifier</title>
${extraHead}
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0a0f;
  --surface:rgba(0,255,213,0.04);
  --border:rgba(0,255,213,0.18);
  --cyan:#00ffd5;
  --magenta:#ff00ff;
  --text:#e0e0e0;
  --muted:#888;
  --red:#ff3b3b;
  --orange:#ff8800;
  --yellow:#ffd600;
  --green:#00ff88;
  --radius:6px;
}
html{height:100%}
body{
  background:var(--bg);
  color:var(--text);
  font-family:'Courier New',Courier,monospace;
  min-height:100vh;
  line-height:1.6;
}
a{color:var(--cyan);text-decoration:none}
a:hover{text-decoration:underline}
.topbar{
  display:flex;align-items:center;gap:16px;
  padding:12px 24px;
  border-bottom:1px solid var(--border);
  background:rgba(0,0,0,0.6);
  position:sticky;top:0;z-index:100;
}
.topbar .logo{
  font-size:1.1rem;font-weight:700;
  color:var(--cyan);letter-spacing:0.08em;
  text-shadow:0 0 12px var(--cyan);
}
.topbar nav{display:flex;gap:20px;margin-left:auto}
.topbar nav a{color:var(--muted);font-size:.85rem;letter-spacing:.05em}
.topbar nav a:hover,.topbar nav a.active{color:var(--cyan)}
.container{max-width:1280px;margin:0 auto;padding:24px}
.card{
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:var(--radius);
  padding:20px;
  margin-bottom:16px;
}
.card h2{
  color:var(--cyan);font-size:.95rem;letter-spacing:.1em;
  text-transform:uppercase;margin-bottom:14px;
  border-bottom:1px solid var(--border);padding-bottom:8px;
}
.btn{
  display:inline-flex;align-items:center;gap:6px;
  padding:8px 18px;border-radius:var(--radius);
  font-family:inherit;font-size:.85rem;font-weight:600;
  cursor:pointer;border:1px solid var(--cyan);
  background:transparent;color:var(--cyan);
  transition:all .2s;letter-spacing:.05em;
}
.btn:hover{background:rgba(0,255,213,.12);box-shadow:0 0 16px rgba(0,255,213,.3)}
.btn.primary{background:rgba(0,255,213,.15);border-color:var(--cyan)}
.btn.magenta{border-color:var(--magenta);color:var(--magenta)}
.btn.magenta:hover{background:rgba(255,0,255,.12);box-shadow:0 0 16px rgba(255,0,255,.3)}
.btn.danger{border-color:var(--red);color:var(--red)}
.btn.sm{padding:4px 10px;font-size:.78rem}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.stat-box{
  background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius);padding:16px;text-align:center;
}
.stat-num{font-size:2rem;font-weight:700;color:var(--cyan);text-shadow:0 0 12px var(--cyan)}
.stat-label{font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-top:4px}
label{display:block;font-size:.78rem;color:var(--muted);margin-bottom:4px;letter-spacing:.05em}
input,textarea,select{
  width:100%;background:rgba(0,0,0,.5);
  border:1px solid var(--border);border-radius:var(--radius);
  color:var(--text);font-family:inherit;font-size:.9rem;padding:8px 12px;
  transition:border-color .2s;outline:none;
}
input:focus,textarea:focus,select:focus{border-color:var(--cyan);box-shadow:0 0 8px rgba(0,255,213,.2)}
textarea{resize:vertical;min-height:120px}
.badge{
  display:inline-block;padding:2px 8px;border-radius:3px;
  font-size:.72rem;font-weight:600;letter-spacing:.05em;
}
.badge.critical{background:rgba(255,59,59,.2);color:var(--red);border:1px solid rgba(255,59,59,.4)}
.badge.high{background:rgba(255,136,0,.2);color:var(--orange);border:1px solid rgba(255,136,0,.4)}
.badge.medium{background:rgba(255,214,0,.2);color:var(--yellow);border:1px solid rgba(255,214,0,.4)}
.badge.low{background:rgba(0,255,136,.2);color:var(--green);border:1px solid rgba(0,255,136,.4)}
.badge.standard{background:rgba(0,255,213,.1);color:var(--cyan);border:1px solid rgba(0,255,213,.3)}
.bar-wrap{background:rgba(255,255,255,.05);border-radius:3px;overflow:hidden;height:8px;margin-top:4px}
.bar{height:100%;background:linear-gradient(90deg,var(--cyan),var(--magenta));border-radius:3px;transition:width .4s}
.flash{
  position:fixed;top:70px;right:20px;z-index:999;
  padding:12px 20px;border-radius:var(--radius);
  font-size:.85rem;font-weight:600;letter-spacing:.05em;
  transition:opacity .4s;
}
.flash.success{background:rgba(0,255,136,.2);border:1px solid var(--green);color:var(--green)}
.flash.error{background:rgba(255,59,59,.2);border:1px solid var(--red);color:var(--red)}
@media(max-width:768px){
  .grid2,.grid3{grid-template-columns:1fr}
  .container{padding:12px}
}
</style>
</head>
<body>
<div class="topbar">
  <span class="logo">⚖ ZKAEDI LEGAL CLASSIFIER</span>
  <nav>
    <a href="/" id="nav-dash">DASHBOARD</a>
    <a href="/label" id="nav-label">LABEL</a>
  </nav>
</div>
<div class="container">
${body}
</div>
</body>
</html>`;
}

function dashboardPage(stats: {
  totalClauses: number;
  totalContracts: number;
  totalLabelers: number;
  byType: Array<{ clause_type: string; count: number }>;
  bySeverity: Array<{ risk_severity: string; count: number }>;
  topLabelers: Array<{ name: string; clauses_labeled: number; role: string }>;
  recent: Array<{ id: string; clause_type: string; risk_severity: string; labeled_by: string; created_at: string }>;
}): string {
  const maxTypeCount = Math.max(...stats.byType.map((b) => b.count), 1);

  const typeRows = stats.byType
    .map(
      (b) =>
        `<div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:.8rem">
            <span>${b.clause_type}</span><span style="color:var(--cyan)">${b.count}</span>
          </div>
          <div class="bar-wrap"><div class="bar" style="width:${Math.round((b.count / maxTypeCount) * 100)}%"></div></div>
        </div>`
    )
    .join('');

  const severityColors: Record<string, string> = {
    critical: '#ff3b3b',
    high: '#ff8800',
    medium: '#ffd600',
    low: '#00ff88',
    standard: '#00ffd5',
  };

  const severityBadges = stats.bySeverity
    .map(
      (s) =>
        `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span class="badge ${s.risk_severity}">${s.risk_severity.toUpperCase()}</span>
          <span style="color:${severityColors[s.risk_severity] ?? '#e0e0e0'};font-weight:700">${s.count}</span>
        </div>`
    )
    .join('');

  const labelerRows = stats.topLabelers
    .map(
      (l) =>
        `<tr>
          <td style="padding:6px 8px">${l.name}</td>
          <td style="padding:6px 8px;color:var(--muted);font-size:.78rem">${l.role}</td>
          <td style="padding:6px 8px;color:var(--cyan);text-align:right">${l.clauses_labeled}</td>
        </tr>`
    )
    .join('');

  const recentRows = stats.recent
    .map(
      (r) =>
        `<tr>
          <td style="padding:6px 8px;font-family:monospace;font-size:.78rem;color:var(--muted)">${r.id}</td>
          <td style="padding:6px 8px;font-size:.8rem">${r.clause_type}</td>
          <td style="padding:6px 8px"><span class="badge ${r.risk_severity}">${r.risk_severity}</span></td>
          <td style="padding:6px 8px;color:var(--muted);font-size:.78rem">${r.labeled_by}</td>
          <td style="padding:6px 8px;color:var(--muted);font-size:.72rem">${r.created_at.slice(0, 10)}</td>
        </tr>`
    )
    .join('');

  return htmlShell(
    'Dashboard',
    `
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
  <h1 style="color:var(--cyan);font-size:1.4rem;letter-spacing:.12em;text-shadow:0 0 16px var(--cyan)">DATASET PIPELINE — LEGAL CLAUSES</h1>
  <div style="display:flex;gap:10px">
    <a class="btn sm" href="/api/export/json">↓ JSON</a>
    <a class="btn sm magenta" href="/api/export/csv">↓ CSV</a>
    <a class="btn sm primary" href="/label">+ LABEL</a>
  </div>
</div>

<div class="grid3" style="margin-bottom:16px">
  <div class="stat-box"><div class="stat-num">${stats.totalClauses}</div><div class="stat-label">Clauses Labeled</div></div>
  <div class="stat-box"><div class="stat-num">${stats.totalContracts}</div><div class="stat-label">Contracts</div></div>
  <div class="stat-box"><div class="stat-num">${stats.totalLabelers}</div><div class="stat-label">Active Labelers</div></div>
</div>

<div class="grid2">
  <div class="card">
    <h2>Class Distribution</h2>
    ${typeRows || '<p style="color:var(--muted);font-size:.85rem">No data yet. Start labeling!</p>'}
  </div>
  <div>
    <div class="card" style="margin-bottom:16px">
      <h2>Risk Severity</h2>
      ${severityBadges || '<p style="color:var(--muted);font-size:.85rem">No data yet.</p>'}
    </div>
    <div class="card">
      <h2>Labeler Leaderboard</h2>
      ${stats.topLabelers.length > 0
        ? `<table style="width:100%;border-collapse:collapse">
            <thead><tr style="border-bottom:1px solid var(--border)">
              <th style="padding:4px 8px;text-align:left;font-size:.75rem;color:var(--muted)">NAME</th>
              <th style="padding:4px 8px;text-align:left;font-size:.75rem;color:var(--muted)">ROLE</th>
              <th style="padding:4px 8px;text-align:right;font-size:.75rem;color:var(--muted)">LABELED</th>
            </tr></thead>
            <tbody>${labelerRows}</tbody>
          </table>`
        : '<p style="color:var(--muted);font-size:.85rem">No labelers yet.</p>'
      }
    </div>
  </div>
</div>

<div class="card">
  <h2>Recent Activity</h2>
  ${stats.recent.length > 0
    ? `<table style="width:100%;border-collapse:collapse">
        <thead><tr style="border-bottom:1px solid var(--border)">
          <th style="padding:4px 8px;text-align:left;font-size:.75rem;color:var(--muted)">ID</th>
          <th style="padding:4px 8px;text-align:left;font-size:.75rem;color:var(--muted)">TYPE</th>
          <th style="padding:4px 8px;text-align:left;font-size:.75rem;color:var(--muted)">SEVERITY</th>
          <th style="padding:4px 8px;text-align:left;font-size:.75rem;color:var(--muted)">LABELED BY</th>
          <th style="padding:4px 8px;text-align:left;font-size:.75rem;color:var(--muted)">DATE</th>
        </tr></thead>
        <tbody>${recentRows}</tbody>
      </table>`
    : '<p style="color:var(--muted);font-size:.85rem">No clauses labeled yet. <a href="/label">Start labeling →</a></p>'
  }
</div>

<script>
document.getElementById('nav-dash').classList.add('active');
</script>
`,
    ''
  );
}

function labelPage(): string {
  const clauseTypes = [
    'indemnification', 'limitation_of_liability', 'warranty_disclaimer',
    'force_majeure', 'termination_for_convenience', 'termination_for_cause',
    'survival_clauses', 'transition_assistance', 'ip_ownership',
    'ip_license_grant', 'data_protection', 'confidentiality',
    'payment_terms', 'price_escalation', 'audit_rights',
    'sla_performance', 'change_control', 'assignment_transfer',
    'dispute_resolution',
  ];

  const severities = [
    { key: 'critical', label: 'CRITICAL', color: '#ff3b3b', key1: '1' },
    { key: 'high', label: 'HIGH', color: '#ff8800', key1: '2' },
    { key: 'medium', label: 'MEDIUM', color: '#ffd600', key1: '3' },
    { key: 'low', label: 'LOW', color: '#00ff88', key1: '4' },
    { key: 'standard', label: 'STANDARD', color: '#00ffd5', key1: '5' },
  ];

  const contractTypes = [
    'SaaS_MSA', 'NDA', 'employment', 'lease', 'partnership',
    'licensing', 'supply_chain', 'construction', 'consulting',
    'franchise', 'joint_venture', 'distribution', 'loan',
    'merger_acquisition', 'services_agreement',
  ];

  const jurisdictions = [
    'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
    'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
    'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
    'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
    'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
    'new_hampshire', 'new_jersey', 'new_mexico', 'new_york',
    'north_carolina', 'north_dakota', 'ohio', 'oklahoma', 'oregon',
    'pennsylvania', 'rhode_island', 'south_carolina', 'south_dakota',
    'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington',
    'west_virginia', 'wisconsin', 'wyoming', 'federal', 'international',
  ];

  const draftingStyles = ['plaintiff_friendly', 'defendant_friendly', 'mutual', 'hybrid'];

  const typeButtons = clauseTypes
    .map(
      (t) =>
        `<button type="button" class="clause-type-btn" data-type="${t}"
          style="padding:7px 10px;background:transparent;border:1px solid var(--border);
                 border-radius:4px;color:var(--muted);font-family:inherit;font-size:.72rem;
                 cursor:pointer;transition:all .15s;text-align:left;letter-spacing:.03em">
          ${t.replace(/_/g, ' ')}
        </button>`
    )
    .join('');

  const severityButtons = severities
    .map(
      (s) =>
        `<button type="button" class="severity-btn" data-severity="${s.key}"
          style="flex:1;padding:10px 6px;background:transparent;
                 border:2px solid ${s.color}33;border-radius:4px;
                 color:${s.color};font-family:inherit;font-size:.78rem;
                 font-weight:700;cursor:pointer;transition:all .15s;letter-spacing:.05em">
          [${s.key1}] ${s.label}
        </button>`
    )
    .join('');

  const contractTypeOpts = contractTypes
    .map((t) => `<option value="${t}">${t.replace(/_/g, ' ')}</option>`)
    .join('');

  const jurisdictionOpts = jurisdictions
    .map((j) => `<option value="${j}">${j.replace(/_/g, ' ')}</option>`)
    .join('');

  const missingProtectionsMap: Record<string, string[]> = {
    indemnification: ['mutual_indemnification', 'cap_on_indemnification', 'insurance_requirement', 'ip_indemnification_by_provider', 'third_party_claim_carve_out'],
    limitation_of_liability: ['mutual_cap', 'carve_out_for_ip', 'carve_out_for_data_breach', 'carve_out_for_fraud', 'gross_negligence_carve_out'],
    warranty_disclaimer: ['fitness_for_purpose', 'non_infringement_warranty', 'uptime_warranty', 'data_accuracy_warranty'],
    force_majeure: ['definition_of_events', 'mitigation_obligation', 'termination_right', 'notice_requirement', 'payment_obligations_during'],
    termination_for_convenience: ['notice_period', 'wind_down_period', 'transition_assistance', 'data_return', 'pro_rata_refund'],
    termination_for_cause: ['cure_period', 'notice_requirement', 'definition_of_cause', 'remedy_for_wrongful_termination'],
    survival_clauses: ['ip_survival', 'confidentiality_survival', 'indemnification_survival', 'payment_survival'],
    transition_assistance: ['duration', 'cost_allocation', 'data_migration', 'knowledge_transfer', 'staffing_obligations'],
    ip_ownership: ['work_for_hire', 'assignment_of_rights', 'moral_rights_waiver', 'prior_inventions_carve_out', 'state_law_compliance'],
    ip_license_grant: ['scope_of_license', 'sublicense_rights', 'revocability', 'field_of_use', 'exclusivity'],
    data_protection: ['gdpr_dpa', 'ccpa_compliance', 'breach_notification_timeline', 'data_deletion_rights', 'subprocessor_list', 'data_residency', 'soc2_audit_rights'],
    confidentiality: ['definition_of_confidential', 'return_or_destroy', 'compelled_disclosure_procedure', 'residuals_clause'],
    payment_terms: ['late_payment_interest', 'invoice_dispute_procedure', 'expense_reimbursement', 'currency', 'tax_allocation'],
    price_escalation: ['cap_on_increases', 'cpi_index_reference', 'notice_period', 'opt_out_right', 'frequency_limit'],
    audit_rights: ['frequency_limit', 'audit_cost_allocation', 'notice_period', 'scope_limitation', 'confidentiality_of_results'],
    sla_performance: ['service_credits', 'measurement_methodology', 'exclusion_definitions', 'uptime_reporting', 'termination_right_for_repeated_failure'],
    change_control: ['approval_authority', 'timeline_for_quotes', 'written_requirement', 'scope_change_pricing'],
    assignment_transfer: ['consent_requirement', 'change_of_control_trigger', 'affiliate_carve_out', 'anti_assignment_remedy'],
    dispute_resolution: ['governing_law', 'injunctive_relief_carve_out', 'class_action_waiver', 'cost_allocation', 'escalation_procedure'],
  };

  return htmlShell(
    'Label Clauses',
    `
<div style="display:flex;gap:20px">

<!-- Main labeling area -->
<div style="flex:1;min-width:0">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
    <h1 style="color:var(--cyan);font-size:1.2rem;letter-spacing:.1em;text-shadow:0 0 12px var(--cyan)">CLAUSE LABELING INTERFACE</h1>
    <span id="session-counter" style="color:var(--muted);font-size:.8rem">Session: <span id="sess-count" style="color:var(--cyan)">0</span> labeled</span>
  </div>

  <form id="label-form">

    <!-- Clause Text -->
    <div class="card">
      <h2>Clause Text</h2>
      <textarea id="clause_text" name="clause_text" rows="8"
        placeholder="Paste or type the contract clause here..." required
        style="min-height:160px;font-size:.88rem;line-height:1.7"></textarea>
    </div>

    <!-- Contract Metadata -->
    <div class="card">
      <h2>Contract Metadata</h2>
      <div class="grid3">
        <div>
          <label for="contract_type">Contract Type</label>
          <select id="contract_type" name="contract_type">
            ${contractTypeOpts}
          </select>
        </div>
        <div>
          <label for="jurisdiction">Jurisdiction</label>
          <select id="jurisdiction" name="jurisdiction">
            ${jurisdictionOpts}
          </select>
        </div>
        <div>
          <label for="contract_id">Contract ID (optional)</label>
          <input type="text" id="contract_id" name="contract_id" placeholder="e.g. contract-001"/>
        </div>
      </div>
    </div>

    <!-- Clause Classification -->
    <div class="card">
      <h2>Clause Classification <span id="selected-type-display" style="color:var(--cyan);font-weight:700"></span></h2>
      <input type="hidden" id="clause_type" name="clause_type" required/>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">
        ${typeButtons}
      </div>
    </div>

    <!-- Risk Assessment -->
    <div class="card">
      <h2>Risk Severity <span id="selected-sev-display" style="color:var(--cyan)"></span></h2>
      <input type="hidden" id="risk_severity" name="risk_severity" required/>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${severityButtons}
      </div>
    </div>

    <!-- Metadata Toggles -->
    <div class="card">
      <h2>Metadata</h2>
      <div class="grid3">
        <div>
          <label>Market Standard</label>
          <div style="display:flex;gap:8px;margin-top:4px">
            <button type="button" class="market-btn" data-val="true"
              style="flex:1;padding:8px;background:transparent;border:1px solid var(--border);
                     border-radius:4px;color:var(--muted);font-family:inherit;font-size:.82rem;cursor:pointer;transition:all .15s">
              YES
            </button>
            <button type="button" class="market-btn" data-val="false"
              style="flex:1;padding:8px;background:transparent;border:1px solid var(--border);
                     border-radius:4px;color:var(--muted);font-family:inherit;font-size:.82rem;cursor:pointer;transition:all .15s">
              NO
            </button>
          </div>
          <input type="hidden" id="market_standard" name="market_standard" value="true"/>
        </div>
        <div>
          <label>Negotiability</label>
          <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
            ${['high', 'medium', 'low', 'none'].map((n) => `
              <button type="button" class="neg-btn" data-val="${n}"
                style="flex:1;min-width:50px;padding:8px 4px;background:transparent;border:1px solid var(--border);
                       border-radius:4px;color:var(--muted);font-family:inherit;font-size:.78rem;cursor:pointer;transition:all .15s;text-transform:uppercase">
                ${n}
              </button>`).join('')}
          </div>
          <input type="hidden" id="negotiability" name="negotiability" value="medium"/>
        </div>
        <div>
          <label>Drafting Style</label>
          <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
            ${draftingStyles.map((d) => `
              <button type="button" class="draft-btn" data-val="${d}"
                style="flex:1;min-width:80px;padding:7px 4px;background:transparent;border:1px solid var(--border);
                       border-radius:4px;color:var(--muted);font-family:inherit;font-size:.72rem;cursor:pointer;transition:all .15s;text-align:center">
                ${d.replace(/_/g, ' ')}
              </button>`).join('')}
          </div>
          <input type="hidden" id="drafting_style" name="drafting_style" value=""/>
        </div>
      </div>
      <div style="margin-top:14px;display:flex;align-items:center;gap:16px">
        <div style="flex:1">
          <label for="confidence">Confidence: <span id="conf-val">0.85</span></label>
          <input type="range" id="confidence" name="confidence" min="0" max="1" step="0.05" value="0.85"
            style="width:100%;accent-color:var(--cyan)"/>
        </div>
        <div style="flex:1">
          <label for="labeled_by">Labeled By *</label>
          <input type="text" id="labeled_by" name="labeled_by" placeholder="attorney_001" required/>
        </div>
      </div>
    </div>

    <!-- Missing Protections -->
    <div class="card" id="missing-card">
      <h2>Missing Protections</h2>
      <div id="missing-checklist" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:6px">
        <p style="color:var(--muted);font-size:.85rem">Select a clause type to see relevant protections.</p>
      </div>
      <input type="hidden" id="missing_protections" name="missing_protections" value="[]"/>
    </div>

    <!-- Notes -->
    <div class="card">
      <h2>Attorney Notes</h2>
      <textarea id="notes" name="notes" rows="3"
        placeholder="Add any commentary, negotiation notes, or flags..."></textarea>
    </div>

    <!-- Submit -->
    <div style="display:flex;gap:12px;margin-top:4px">
      <button type="submit" class="btn primary" style="flex:1;padding:14px;font-size:1rem">
        ↵ SUBMIT + NEXT  <span style="opacity:.6;font-size:.8rem">[Enter]</span>
      </button>
      <button type="button" class="btn" id="clear-btn" style="padding:14px 24px">CLEAR</button>
    </div>
  </form>
</div>

<!-- Progress Sidebar -->
<div style="width:260px;flex-shrink:0">
  <div class="card" style="position:sticky;top:70px">
    <h2>Session Progress</h2>
    <div style="text-align:center;margin-bottom:16px">
      <div class="stat-num" id="sidebar-count">0</div>
      <div class="stat-label">Labeled This Session</div>
    </div>
    <div id="sidebar-dist" style="font-size:.78rem;color:var(--muted)">
      <p>No clauses labeled yet.</p>
    </div>
    <hr style="border-color:var(--border);margin:14px 0"/>
    <div style="font-size:.75rem;color:var(--muted);line-height:2">
      <strong style="color:var(--cyan);display:block;margin-bottom:4px">KEYBOARD SHORTCUTS</strong>
      1–5 → Risk severity<br/>
      Enter → Submit<br/>
      Esc → Clear form
    </div>
  </div>
</div>

</div>

<div id="flash" class="flash" style="display:none"></div>

<script>
(function() {
  const missingMap = ${JSON.stringify(missingProtectionsMap)};
  const sevColors = {critical:'#ff3b3b',high:'#ff8800',medium:'#ffd600',low:'#00ff88',standard:'#00ffd5'};
  let sessionCount = 0;
  let sessionDist = {};

  // --- Clause type buttons ---
  document.querySelectorAll('.clause-type-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.clause-type-btn').forEach(b => {
        b.style.background = 'transparent';
        b.style.borderColor = 'rgba(0,255,213,0.18)';
        b.style.color = '#888';
      });
      this.style.background = 'rgba(0,255,213,0.12)';
      this.style.borderColor = 'var(--cyan)';
      this.style.color = 'var(--cyan)';
      const t = this.dataset.type;
      document.getElementById('clause_type').value = t;
      document.getElementById('selected-type-display').textContent = '— ' + t.replace(/_/g,' ');
      buildMissingChecklist(t);
    });
  });

  // --- Severity buttons ---
  document.querySelectorAll('.severity-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const sev = this.dataset.severity;
      selectSeverity(sev);
    });
  });

  function selectSeverity(sev) {
    document.querySelectorAll('.severity-btn').forEach(b => {
      b.style.background = 'transparent';
      b.style.opacity = '0.6';
    });
    const active = document.querySelector('.severity-btn[data-severity="' + sev + '"]');
    if (active) {
      active.style.background = 'rgba(255,255,255,0.08)';
      active.style.opacity = '1';
      active.style.boxShadow = '0 0 12px ' + (sevColors[sev]||'#00ffd5') + '55';
    }
    document.getElementById('risk_severity').value = sev;
    document.getElementById('selected-sev-display').textContent = '— ' + sev.toUpperCase();
  }

  // --- Market standard buttons ---
  document.querySelectorAll('.market-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.market-btn').forEach(b => {
        b.style.background = 'transparent'; b.style.color = '#888'; b.style.borderColor = 'rgba(0,255,213,0.18)';
      });
      this.style.background = 'rgba(0,255,213,0.12)';
      this.style.color = 'var(--cyan)';
      this.style.borderColor = 'var(--cyan)';
      document.getElementById('market_standard').value = this.dataset.val;
    });
  });

  // --- Negotiability buttons ---
  document.querySelectorAll('.neg-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.neg-btn').forEach(b => {
        b.style.background = 'transparent'; b.style.color = '#888'; b.style.borderColor = 'rgba(0,255,213,0.18)';
      });
      this.style.background = 'rgba(0,255,213,0.12)';
      this.style.color = 'var(--cyan)';
      this.style.borderColor = 'var(--cyan)';
      document.getElementById('negotiability').value = this.dataset.val;
    });
  });

  // --- Drafting style buttons ---
  document.querySelectorAll('.draft-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.draft-btn').forEach(b => {
        b.style.background = 'transparent'; b.style.color = '#888'; b.style.borderColor = 'rgba(0,255,213,0.18)';
      });
      this.style.background = 'rgba(0,255,213,0.12)';
      this.style.color = 'var(--cyan)';
      this.style.borderColor = 'var(--cyan)';
      document.getElementById('drafting_style').value = this.dataset.val;
    });
  });

  // --- Confidence slider ---
  document.getElementById('confidence').addEventListener('input', function() {
    document.getElementById('conf-val').textContent = parseFloat(this.value).toFixed(2);
  });

  // --- Missing protections checklist ---
  function buildMissingChecklist(clauseType) {
    const items = missingMap[clauseType] || [];
    const container = document.getElementById('missing-checklist');
    if (items.length === 0) {
      container.innerHTML = '<p style="color:var(--muted);font-size:.85rem">No standard protections defined for this type.</p>';
      document.getElementById('missing_protections').value = '[]';
      return;
    }
    container.innerHTML = items.map(item => \`
      <label style="display:flex;align-items:center;gap:8px;padding:6px 10px;
                    background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);
                    border-radius:4px;cursor:pointer;font-size:.8rem;color:var(--muted);
                    transition:all .15s;user-select:none">
        <input type="checkbox" class="missing-check" data-item="\${item}" style="width:auto;accent-color:var(--cyan)"/>
        \${item.replace(/_/g,' ')}
      </label>\`).join('');
    document.querySelectorAll('.missing-check').forEach(cb => {
      cb.addEventListener('change', updateMissingProtections);
    });
    document.getElementById('missing_protections').value = '[]';
  }

  function updateMissingProtections() {
    const checked = Array.from(document.querySelectorAll('.missing-check:checked'))
      .map(cb => cb.dataset.item);
    document.getElementById('missing_protections').value = JSON.stringify(checked);
  }

  // --- Form submission ---
  document.getElementById('label-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const clauseType = document.getElementById('clause_type').value;
    const riskSeverity = document.getElementById('risk_severity').value;
    if (!clauseType) { showFlash('Select a clause type', 'error'); return; }
    if (!riskSeverity) { showFlash('Select a risk severity', 'error'); return; }

    const contractId = document.getElementById('contract_id').value.trim() || '';
    const payload = {
      clause_text: document.getElementById('clause_text').value,
      contract_id: contractId,
      clause_type: clauseType,
      contract_type: document.getElementById('contract_type').value,
      risk_severity: riskSeverity,
      market_standard: document.getElementById('market_standard').value === 'true',
      negotiability: document.getElementById('negotiability').value,
      drafting_style: document.getElementById('drafting_style').value || null,
      missing_protections: document.getElementById('missing_protections').value,
      jurisdiction: document.getElementById('jurisdiction').value,
      labeled_by: document.getElementById('labeled_by').value,
      confidence: parseFloat(document.getElementById('confidence').value),
      notes: document.getElementById('notes').value || null,
    };

    try {
      const res = await fetch('/api/clauses', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        sessionCount++;
        sessionDist[clauseType] = (sessionDist[clauseType] || 0) + 1;
        document.getElementById('sess-count').textContent = sessionCount;
        document.getElementById('sidebar-count').textContent = sessionCount;
        updateSidebarDist();
        showFlash('Clause saved: ' + data.id, 'success');
        clearForm();
      } else {
        showFlash(data.error || 'Submit failed', 'error');
      }
    } catch(err) {
      showFlash('Network error: ' + err.message, 'error');
    }
  });

  function clearForm() {
    document.getElementById('clause_text').value = '';
    document.getElementById('notes').value = '';
    document.getElementById('clause_type').value = '';
    document.getElementById('risk_severity').value = '';
    document.getElementById('missing_protections').value = '[]';
    document.querySelectorAll('.clause-type-btn').forEach(b => {
      b.style.background='transparent';b.style.borderColor='rgba(0,255,213,0.18)';b.style.color='#888';
    });
    document.querySelectorAll('.severity-btn').forEach(b => {
      b.style.background='transparent';b.style.opacity='0.6';b.style.boxShadow='none';
    });
    document.getElementById('selected-type-display').textContent = '';
    document.getElementById('selected-sev-display').textContent = '';
    document.getElementById('missing-checklist').innerHTML = '<p style="color:var(--muted);font-size:.85rem">Select a clause type to see relevant protections.</p>';
    document.getElementById('clause_text').focus();
  }

  document.getElementById('clear-btn').addEventListener('click', clearForm);

  function updateSidebarDist() {
    const entries = Object.entries(sessionDist).sort((a,b) => b[1]-a[1]);
    if (entries.length === 0) { document.getElementById('sidebar-dist').innerHTML = '<p>No clauses labeled yet.</p>'; return; }
    const max = Math.max(...entries.map(e => e[1]));
    document.getElementById('sidebar-dist').innerHTML = entries.map(([t, c]) =>
      \`<div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;margin-bottom:2px">
          <span style="font-size:.72rem">\${t.replace(/_/g,' ')}</span>
          <span style="color:var(--cyan)">\${c}</span>
        </div>
        <div class="bar-wrap"><div class="bar" style="width:\${Math.round(c/max*100)}%"></div></div>
      </div>\`
    ).join('');
  }

  // --- Flash messages ---
  function showFlash(msg, type) {
    const el = document.getElementById('flash');
    el.textContent = msg;
    el.className = 'flash ' + type;
    el.style.display = 'block';
    el.style.opacity = '1';
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => { el.style.display = 'none'; }, 400);
    }, 3000);
  }

  // --- Keyboard shortcuts ---
  document.addEventListener('keydown', function(e) {
    if (['1','2','3','4','5'].includes(e.key) && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
      const sevMap = {'1':'critical','2':'high','3':'medium','4':'low','5':'standard'};
      selectSeverity(sevMap[e.key]);
    }
    if (e.key === 'Escape') clearForm();
  });
})();
document.getElementById('nav-label').classList.add('active');
</script>
`,
    ''
  );
}

// ─── App ────────────────────────────────────────────────────────────────────────

function isoDate(): string {
  return isoDate();
}

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('*', async (c, next) => {
  const origins = c.env.CORS_ORIGINS || '*';
  const origin = c.req.header('Origin') || '';
  const allowed =
    origins === '*' ||
    origins
      .split(',')
      .map((o) => o.trim())
      .includes(origin);

  if (allowed || origins === '*') {
    c.header('Access-Control-Allow-Origin', origins === '*' ? '*' : origin);
  }
  c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type,X-API-Key,Authorization');

  if (c.req.method === 'OPTIONS') return new Response(null, { status: 204 });
  await next();
});

// Rate limit + auth middleware for /api routes
app.use('/api/*', async (c, next) => {
  const apiKey = c.req.header('X-API-Key');
  if (isAuthenticated(apiKey, c.env.API_KEY)) {
    await next();
    return;
  }

  const ip =
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For') ||
    'unknown';

  const { allowed, remaining } = await checkRateLimit(c.env.RATE_LIMIT, ip);
  if (!allowed) {
    return c.json(
      { error: 'Rate limit exceeded. 20 requests/hour for unauthenticated access.' },
      429
    );
  }
  c.header('X-RateLimit-Remaining', String(remaining));
  await next();
});

// Rate limit for public UI routes
app.use('/', async (c, next) => {
  const apiKey = c.req.header('X-API-Key');
  if (isAuthenticated(apiKey, c.env.API_KEY)) {
    await next();
    return;
  }
  const ip =
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For') ||
    'unknown';
  const { allowed } = await checkRateLimit(c.env.RATE_LIMIT, ip);
  if (!allowed) {
    return c.json(
      { error: 'Rate limit exceeded. 20 requests/hour.' },
      429
    );
  }
  await next();
});

app.use('/label', async (c, next) => {
  const apiKey = c.req.header('X-API-Key');
  if (isAuthenticated(apiKey, c.env.API_KEY)) {
    await next();
    return;
  }
  const ip =
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For') ||
    'unknown';
  const { allowed } = await checkRateLimit(c.env.RATE_LIMIT, ip);
  if (!allowed) {
    return c.json(
      { error: 'Rate limit exceeded. 20 requests/hour.' },
      429
    );
  }
  await next();
});

// ─── Health ─────────────────────────────────────────────────────────────────────

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'legal-clause-classifier' });
});

// ─── Dashboard ──────────────────────────────────────────────────────────────────

app.get('/', async (c) => {
  try {
    const [totalRow, contractRow, labelerRow, byType, bySeverity, topLabelers, recent] =
      await Promise.all([
        c.env.DB.prepare('SELECT COUNT(*) as cnt FROM clauses').first<{ cnt: number }>(),
        c.env.DB.prepare('SELECT COUNT(*) as cnt FROM contracts').first<{ cnt: number }>(),
        c.env.DB.prepare('SELECT COUNT(*) as cnt FROM labelers').first<{ cnt: number }>(),
        c.env.DB.prepare(
          'SELECT clause_type, COUNT(*) as count FROM clauses GROUP BY clause_type ORDER BY count DESC'
        ).all<{ clause_type: string; count: number }>(),
        c.env.DB.prepare(
          'SELECT risk_severity, COUNT(*) as count FROM clauses GROUP BY risk_severity ORDER BY count DESC'
        ).all<{ risk_severity: string; count: number }>(),
        c.env.DB.prepare(
          'SELECT name, role, clauses_labeled FROM labelers ORDER BY clauses_labeled DESC LIMIT 10'
        ).all<{ name: string; role: string; clauses_labeled: number }>(),
        c.env.DB.prepare(
          'SELECT id, clause_type, risk_severity, labeled_by, created_at FROM clauses ORDER BY created_at DESC LIMIT 20'
        ).all<{
          id: string;
          clause_type: string;
          risk_severity: string;
          labeled_by: string;
          created_at: string;
        }>(),
      ]);

    const html = dashboardPage({
      totalClauses: totalRow?.cnt ?? 0,
      totalContracts: contractRow?.cnt ?? 0,
      totalLabelers: labelerRow?.cnt ?? 0,
      byType: byType.results,
      bySeverity: bySeverity.results,
      topLabelers: topLabelers.results,
      recent: recent.results,
    });

    return c.html(html);
  } catch (err) {
    return c.html(
      htmlShell(
        'Error',
        `<div class="card"><h2 style="color:var(--red)">Database Error</h2>
          <p style="color:var(--muted)">${String(err)}</p>
          <p style="margin-top:10px;font-size:.85rem">Run <code style="color:var(--cyan)">wrangler d1 execute legal-clauses-db --file=schema.sql</code> to initialize the database.</p>
        </div>`
      ),
      500
    );
  }
});

// ─── Label UI ───────────────────────────────────────────────────────────────────

app.get('/label', (c) => {
  return c.html(labelPage());
});

// ─── API: Contracts ─────────────────────────────────────────────────────────────

app.post('/api/contracts', async (c) => {
  try {
    const body = await c.req.json<{
      filename: string;
      contract_type: string;
      jurisdiction: string;
      labeled_by?: string;
    }>();

    if (!body.filename || !body.contract_type || !body.jurisdiction) {
      return c.json({ error: 'filename, contract_type, and jurisdiction are required' }, 400);
    }

    const id = `contract-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO contracts (id, filename, contract_type, jurisdiction, upload_date, labeled_by, label_status, clause_count)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 0)`
    )
      .bind(id, body.filename, body.contract_type, body.jurisdiction, now, body.labeled_by ?? null)
      .run();

    return c.json({ id, filename: body.filename, contract_type: body.contract_type, jurisdiction: body.jurisdiction, upload_date: now }, 201);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// ─── API: Clauses — POST ────────────────────────────────────────────────────────

app.post('/api/clauses', async (c) => {
  try {
    const body = await c.req.json<{
      clause_text: string;
      clause_type: string;
      risk_severity: string;
      contract_id?: string;
      contract_type?: string;
      market_standard?: boolean;
      negotiability?: string;
      missing_protections?: string;
      drafting_style?: string | null;
      jurisdiction?: string | null;
      labeled_by: string;
      confidence?: number;
      notes?: string | null;
    }>();

    if (!body.clause_text || !body.clause_type || !body.risk_severity || !body.labeled_by) {
      return c.json(
        { error: 'clause_text, clause_type, risk_severity, and labeled_by are required' },
        400
      );
    }

    const validTypes = [
      'indemnification', 'limitation_of_liability', 'warranty_disclaimer',
      'force_majeure', 'termination_for_convenience', 'termination_for_cause',
      'survival_clauses', 'transition_assistance', 'ip_ownership',
      'ip_license_grant', 'data_protection', 'confidentiality',
      'payment_terms', 'price_escalation', 'audit_rights',
      'sla_performance', 'change_control', 'assignment_transfer',
      'dispute_resolution',
    ];
    if (!validTypes.includes(body.clause_type)) {
      return c.json({ error: `Invalid clause_type. Must be one of: ${validTypes.join(', ')}` }, 400);
    }

    const validSeverities = ['critical', 'high', 'medium', 'low', 'standard'];
    if (!validSeverities.includes(body.risk_severity)) {
      return c.json({ error: `Invalid risk_severity. Must be one of: ${validSeverities.join(', ')}` }, 400);
    }

    // Resolve or create contract
    let contractId = body.contract_id?.trim() || '';
    if (!contractId) {
      const contractType = body.contract_type || 'unknown';
      const jurisdiction = body.jurisdiction || 'unknown';
      contractId = `contract-${crypto.randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();
      await c.env.DB.prepare(
        `INSERT INTO contracts (id, filename, contract_type, jurisdiction, upload_date, labeled_by, label_status, clause_count)
         VALUES (?, ?, ?, ?, ?, ?, 'in_progress', 0)`
      )
        .bind(contractId, `inline-${contractId}`, contractType, jurisdiction, now, body.labeled_by)
        .run();
    }

    const id = `CLZ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();
    const missingProtections = body.missing_protections ?? '[]';
    const isMarketStandard = body.market_standard ?? true;

    // Compute PRIME features
    const prime = computePrimeFeatures({
      clause_type: body.clause_type,
      risk_severity: body.risk_severity,
      market_standard: isMarketStandard,
      negotiability: body.negotiability ?? 'medium',
      missing_protections: missingProtections,
    });

    await c.env.DB.prepare(
      `INSERT INTO clauses (
        id, contract_id, clause_text, clause_type, risk_severity, market_standard,
        negotiability, missing_protections, drafting_style,
        h0_base_energy, energy_amplification_factor, lyapunov_exponent, energy_at_trigger,
        jurisdiction, labeled_by, confidence, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id, contractId, body.clause_text, body.clause_type, body.risk_severity,
        isMarketStandard ? 1 : 0,
        body.negotiability ?? 'medium',
        missingProtections,
        body.drafting_style ?? null,
        prime.h0, prime.amplification, prime.lyapunov, prime.triggerEnergy,
        body.jurisdiction ?? null,
        body.labeled_by,
        body.confidence ?? null,
        body.notes ?? null,
        now
      )
      .run();

    // Update contract clause count
    await c.env.DB.prepare(
      'UPDATE contracts SET clause_count = clause_count + 1 WHERE id = ?'
    )
      .bind(contractId)
      .run();

    // Update or insert labeler count
    await c.env.DB.prepare(
      `INSERT INTO labelers (id, name, email, role, clauses_labeled, created_at)
       VALUES (?, ?, NULL, 'attorney', 1, ?)
       ON CONFLICT(id) DO UPDATE SET clauses_labeled = clauses_labeled + 1`
    )
      .bind(body.labeled_by, body.labeled_by, now)
      .run();

    return c.json(
      {
        id,
        contract_id: contractId,
        clause_type: body.clause_type,
        risk_severity: body.risk_severity,
        prime_features: {
          h0_base_energy: prime.h0,
          energy_amplification_factor: prime.amplification,
          lyapunov_exponent: prime.lyapunov,
          energy_at_trigger: prime.triggerEnergy,
        },
      },
      201
    );
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// ─── API: Clauses — GET single ──────────────────────────────────────────────────

app.get('/api/clauses/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const clause = await c.env.DB.prepare('SELECT * FROM clauses WHERE id = ?')
      .bind(id)
      .first<Clause>();

    if (!clause) return c.json({ error: 'Clause not found' }, 404);

    const result = {
      ...clause,
      market_standard: clause.market_standard === 1 || clause.market_standard === true,
      missing_protections: clause.missing_protections
        ? (() => { try { return JSON.parse(clause.missing_protections as string); } catch { return []; } })()
        : [],
    };

    return c.json(result);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// ─── API: Clauses — PUT update ──────────────────────────────────────────────────

app.put('/api/clauses/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const existing = await c.env.DB.prepare('SELECT * FROM clauses WHERE id = ?')
      .bind(id)
      .first<Clause>();

    if (!existing) return c.json({ error: 'Clause not found' }, 404);

    const body = await c.req.json<Partial<{
      clause_text: string;
      clause_type: string;
      risk_severity: string;
      market_standard: boolean;
      negotiability: string;
      missing_protections: string;
      drafting_style: string | null;
      jurisdiction: string | null;
      confidence: number;
      notes: string | null;
    }>>();

    const clauseType = body.clause_type ?? existing.clause_type;
    const riskSeverity = body.risk_severity ?? existing.risk_severity;
    const isMarketStandard =
      body.market_standard !== undefined
        ? body.market_standard
        : existing.market_standard === 1 || existing.market_standard === true;
    const negotiability = body.negotiability ?? existing.negotiability;
    const missingProtections = body.missing_protections ?? existing.missing_protections ?? '[]';

    const prime = computePrimeFeatures({
      clause_type: clauseType,
      risk_severity: riskSeverity,
      market_standard: isMarketStandard,
      negotiability,
      missing_protections: missingProtections,
    });

    await c.env.DB.prepare(
      `UPDATE clauses SET
        clause_text = ?,
        clause_type = ?,
        risk_severity = ?,
        market_standard = ?,
        negotiability = ?,
        missing_protections = ?,
        drafting_style = ?,
        h0_base_energy = ?,
        energy_amplification_factor = ?,
        lyapunov_exponent = ?,
        energy_at_trigger = ?,
        jurisdiction = ?,
        confidence = ?,
        notes = ?
      WHERE id = ?`
    )
      .bind(
        body.clause_text ?? existing.clause_text,
        clauseType,
        riskSeverity,
        isMarketStandard ? 1 : 0,
        negotiability,
        missingProtections,
        body.drafting_style !== undefined ? body.drafting_style : existing.drafting_style,
        prime.h0,
        prime.amplification,
        prime.lyapunov,
        prime.triggerEnergy,
        body.jurisdiction !== undefined ? body.jurisdiction : existing.jurisdiction,
        body.confidence !== undefined ? body.confidence : existing.confidence,
        body.notes !== undefined ? body.notes : existing.notes,
        id
      )
      .run();

    const updated = await c.env.DB.prepare('SELECT * FROM clauses WHERE id = ?')
      .bind(id)
      .first<Clause>();

    return c.json({
      ...updated,
      market_standard: updated?.market_standard === 1 || updated?.market_standard === true,
      missing_protections: updated?.missing_protections
        ? (() => { try { return JSON.parse(updated.missing_protections as string); } catch { return []; } })()
        : [],
    });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// ─── API: Stats ─────────────────────────────────────────────────────────────────

app.get('/api/stats', async (c) => {
  try {
    const [total, byType, bySeverity, byNeg, labelers, primeStats] = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as total FROM clauses').first<{ total: number }>(),
      c.env.DB.prepare('SELECT clause_type, COUNT(*) as count FROM clauses GROUP BY clause_type ORDER BY count DESC').all<{ clause_type: string; count: number }>(),
      c.env.DB.prepare('SELECT risk_severity, COUNT(*) as count FROM clauses GROUP BY risk_severity').all<{ risk_severity: string; count: number }>(),
      c.env.DB.prepare('SELECT negotiability, COUNT(*) as count FROM clauses GROUP BY negotiability').all<{ negotiability: string; count: number }>(),
      c.env.DB.prepare('SELECT name, role, clauses_labeled FROM labelers ORDER BY clauses_labeled DESC').all<{ name: string; role: string; clauses_labeled: number }>(),
      c.env.DB.prepare(
        'SELECT AVG(h0_base_energy) as avg_h0, AVG(energy_amplification_factor) as avg_amp, AVG(lyapunov_exponent) as avg_lyapunov, AVG(energy_at_trigger) as avg_trigger FROM clauses'
      ).first<{ avg_h0: number; avg_amp: number; avg_lyapunov: number; avg_trigger: number }>(),
    ]);

    return c.json({
      total_clauses: total?.total ?? 0,
      by_clause_type: byType.results,
      by_risk_severity: bySeverity.results,
      by_negotiability: byNeg.results,
      labelers: labelers.results,
      prime_averages: {
        h0_base_energy: primeStats?.avg_h0 ?? null,
        energy_amplification_factor: primeStats?.avg_amp ?? null,
        lyapunov_exponent: primeStats?.avg_lyapunov ?? null,
        energy_at_trigger: primeStats?.avg_trigger ?? null,
      },
    });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// ─── API: Export JSON (HuggingFace compatible) ──────────────────────────────────

app.get('/api/export/json', async (c) => {
  try {
    const clauses = await c.env.DB.prepare(
      `SELECT c.id, cn.contract_type as source_contract_type,
              c.clause_text, c.clause_type, c.risk_severity,
              c.market_standard, c.negotiability, c.missing_protections,
              c.h0_base_energy, c.energy_amplification_factor,
              c.lyapunov_exponent, c.energy_at_trigger,
              c.jurisdiction, c.labeled_by, c.confidence,
              c.notes, c.drafting_style, c.created_at
       FROM clauses c
       LEFT JOIN contracts cn ON c.contract_id = cn.id
       ORDER BY c.created_at ASC`
    ).all<{
      id: string;
      source_contract_type: string | null;
      clause_text: string;
      clause_type: string;
      risk_severity: string;
      market_standard: number | boolean;
      negotiability: string;
      missing_protections: string | null;
      h0_base_energy: number | null;
      energy_amplification_factor: number | null;
      lyapunov_exponent: number | null;
      energy_at_trigger: number | null;
      jurisdiction: string | null;
      labeled_by: string;
      confidence: number | null;
      notes: string | null;
      drafting_style: string | null;
      created_at: string;
    }>();

    const dataset = clauses.results.map((row) => ({
      clause_id: row.id,
      source_contract_type: row.source_contract_type ?? 'unknown',
      clause_text: row.clause_text,
      clause_type: row.clause_type,
      risk_severity: row.risk_severity,
      market_standard: row.market_standard === 1 || row.market_standard === true,
      negotiability: row.negotiability,
      missing_protections: (() => {
        try { return JSON.parse(row.missing_protections ?? '[]'); } catch { return []; }
      })(),
      h0_base_energy: row.h0_base_energy,
      energy_amplification_factor: row.energy_amplification_factor,
      lyapunov_exponent: row.lyapunov_exponent,
      energy_at_trigger: row.energy_at_trigger,
      jurisdiction: row.jurisdiction,
      labeled_by: row.labeled_by,
      confidence: row.confidence,
      drafting_style: row.drafting_style,
      notes: row.notes,
      created_at: row.created_at,
    }));

    // Log export
    const exportId = `exp-${crypto.randomUUID().slice(0, 8)}`;
    await c.env.DB.prepare(
      'INSERT INTO exports (id, format, row_count, created_at) VALUES (?, ?, ?, ?)'
    )
      .bind(exportId, 'json', dataset.length, new Date().toISOString())
      .run();

    // Optionally store in R2
    try {
      const key = `exports/clauses-${isoDate()}-${exportId}.json`;
      await c.env.STORAGE.put(key, JSON.stringify(dataset, null, 2), {
        httpMetadata: { contentType: 'application/json' },
      });
    } catch {
      // R2 storage failure is non-fatal — return data anyway
    }

    c.header('Content-Disposition', `attachment; filename="legal-clauses-${isoDate()}.json"`);
    return c.json(dataset);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// ─── API: Export CSV ────────────────────────────────────────────────────────────

app.get('/api/export/csv', async (c) => {
  try {
    const clauses = await c.env.DB.prepare(
      `SELECT c.id, cn.contract_type as source_contract_type,
              c.clause_text, c.clause_type, c.risk_severity,
              c.market_standard, c.negotiability, c.missing_protections,
              c.h0_base_energy, c.energy_amplification_factor,
              c.lyapunov_exponent, c.energy_at_trigger,
              c.jurisdiction, c.labeled_by, c.confidence,
              c.notes, c.drafting_style, c.created_at
       FROM clauses c
       LEFT JOIN contracts cn ON c.contract_id = cn.id
       ORDER BY c.created_at ASC`
    ).all<{
      id: string;
      source_contract_type: string | null;
      clause_text: string;
      clause_type: string;
      risk_severity: string;
      market_standard: number | boolean;
      negotiability: string;
      missing_protections: string | null;
      h0_base_energy: number | null;
      energy_amplification_factor: number | null;
      lyapunov_exponent: number | null;
      energy_at_trigger: number | null;
      jurisdiction: string | null;
      labeled_by: string;
      confidence: number | null;
      notes: string | null;
      drafting_style: string | null;
      created_at: string;
    }>();

    const headers = [
      'clause_id', 'source_contract_type', 'clause_text', 'clause_type',
      'risk_severity', 'market_standard', 'negotiability', 'missing_protections',
      'h0_base_energy', 'energy_amplification_factor', 'lyapunov_exponent',
      'energy_at_trigger', 'jurisdiction', 'labeled_by', 'confidence',
      'drafting_style', 'notes', 'created_at',
    ];

    function csvEscape(val: unknown): string {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    const rows = clauses.results.map((row) => {
      const missing = (() => {
        try { return JSON.parse(row.missing_protections ?? '[]'); } catch { return []; }
      })();
      return [
        row.id,
        row.source_contract_type ?? '',
        row.clause_text,
        row.clause_type,
        row.risk_severity,
        row.market_standard === 1 || row.market_standard === true ? 'true' : 'false',
        row.negotiability,
        JSON.stringify(missing),
        row.h0_base_energy ?? '',
        row.energy_amplification_factor ?? '',
        row.lyapunov_exponent ?? '',
        row.energy_at_trigger ?? '',
        row.jurisdiction ?? '',
        row.labeled_by,
        row.confidence ?? '',
        row.drafting_style ?? '',
        row.notes ?? '',
        row.created_at,
      ].map(csvEscape).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    // Log export
    const exportId = `exp-${crypto.randomUUID().slice(0, 8)}`;
    await c.env.DB.prepare(
      'INSERT INTO exports (id, format, row_count, created_at) VALUES (?, ?, ?, ?)'
    )
      .bind(exportId, 'csv', clauses.results.length, new Date().toISOString())
      .run();

    // Optionally store in R2
    try {
      const key = `exports/clauses-${isoDate()}-${exportId}.csv`;
      await c.env.STORAGE.put(key, csv, {
        httpMetadata: { contentType: 'text/csv' },
      });
    } catch {
      // R2 storage failure is non-fatal
    }

    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', `attachment; filename="legal-clauses-${isoDate()}.csv"`);
    return c.text(csv);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// ─── API: Compute PRIME ─────────────────────────────────────────────────────────

app.post('/api/compute-prime', async (c) => {
  try {
    const body = await c.req.json<{ clause_ids?: string[] }>();

    let query: string;
    let params: string[];

    if (body.clause_ids && body.clause_ids.length > 0) {
      const placeholders = body.clause_ids.map(() => '?').join(',');
      query = `SELECT * FROM clauses WHERE id IN (${placeholders})`;
      params = body.clause_ids;
    } else {
      query = 'SELECT * FROM clauses';
      params = [];
    }

    const result = await c.env.DB.prepare(query).bind(...params).all<Clause>();

    let updated = 0;
    for (const clause of result.results) {
      const prime = computePrimeFeatures({
        clause_type: clause.clause_type,
        risk_severity: clause.risk_severity,
        market_standard: clause.market_standard,
        negotiability: clause.negotiability,
        missing_protections: clause.missing_protections,
      });

      await c.env.DB.prepare(
        `UPDATE clauses SET
          h0_base_energy = ?,
          energy_amplification_factor = ?,
          lyapunov_exponent = ?,
          energy_at_trigger = ?
        WHERE id = ?`
      )
        .bind(prime.h0, prime.amplification, prime.lyapunov, prime.triggerEnergy, clause.id)
        .run();
      updated++;
    }

    return c.json({ updated, message: `PRIME features recomputed for ${updated} clauses` });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

export default app;
