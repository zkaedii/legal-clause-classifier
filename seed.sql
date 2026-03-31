-- ZKAEDI Legal Clause Classifier — Seed Data
-- 10 example clauses across 6+ clause types with computed PRIME features
-- Run: wrangler d1 execute legal-clauses-db --file=seed.sql

-- Seed labelers
INSERT OR IGNORE INTO labelers (id, name, email, role, clauses_labeled, created_at) VALUES
  ('labeler-001', 'Sarah Chen', 'schen@example.com', 'attorney', 5, '2024-12-01T09:00:00Z'),
  ('labeler-002', 'Marcus Webb', 'mwebb@example.com', 'attorney', 3, '2024-12-01T09:00:00Z'),
  ('labeler-003', 'Priya Okonkwo', 'pokonkwo@example.com', 'paralegal', 2, '2024-12-01T09:00:00Z');

-- Seed contracts
INSERT OR IGNORE INTO contracts (id, filename, contract_type, jurisdiction, upload_date, labeled_by, label_status, clause_count) VALUES
  ('contract-001', 'acme_saas_msa_2024.pdf', 'SaaS_MSA', 'california', '2024-12-01T09:00:00Z', 'labeler-001', 'complete', 4),
  ('contract-002', 'techcorp_nda_2024.pdf', 'NDA', 'new_york', '2024-12-01T10:00:00Z', 'labeler-002', 'complete', 3),
  ('contract-003', 'staffing_employment_2024.pdf', 'employment', 'texas', '2024-12-01T11:00:00Z', 'labeler-003', 'in_progress', 3);

-- Seed clauses with computed PRIME features

-- Clause 1: Indemnification — SaaS MSA, one-sided, critical risk
INSERT OR IGNORE INTO clauses (
  id, contract_id, clause_text, clause_type, risk_severity, market_standard,
  negotiability, missing_protections, drafting_style,
  h0_base_energy, energy_amplification_factor, lyapunov_exponent, energy_at_trigger,
  jurisdiction, labeled_by, confidence, notes, created_at
) VALUES (
  'CLZ-00001', 'contract-001',
  'Customer shall indemnify, defend, and hold harmless Provider, its officers, directors, employees, agents, and successors from and against any and all claims, damages, losses, costs, and expenses (including reasonable attorneys'' fees) arising out of or related to Customer''s use of the Service, Customer''s breach of this Agreement, or any third-party claim alleging that Customer Data infringes any intellectual property right.',
  'indemnification', 'high', false,
  'medium', '["mutual_indemnification","cap_on_indemnification","insurance_requirement","ip_indemnification_by_provider"]',
  'defendant_friendly',
  0.9, 2.8, 0.5, 0.99,
  'california', 'labeler-001', 0.92,
  'One-sided indemnification flowing only from Customer to Provider. Missing mutual IP indemnification from Provider. No cap. High risk for Customer.',
  '2024-12-01T09:15:00Z'
);

-- Clause 2: Limitation of Liability — SaaS MSA, mutual, standard
INSERT OR IGNORE INTO clauses (
  id, contract_id, clause_text, clause_type, risk_severity, market_standard,
  negotiability, missing_protections, drafting_style,
  h0_base_energy, energy_amplification_factor, lyapunov_exponent, energy_at_trigger,
  jurisdiction, labeled_by, confidence, notes, created_at
) VALUES (
  'CLZ-00002', 'contract-001',
  'IN NO EVENT SHALL EITHER PARTY BE LIABLE TO THE OTHER FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, LOSS OF DATA, OR BUSINESS INTERRUPTION, HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT, EVEN IF SUCH PARTY HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. EACH PARTY''S TOTAL CUMULATIVE LIABILITY ARISING OUT OF OR RELATED TO THIS AGREEMENT SHALL NOT EXCEED THE FEES PAID BY CUSTOMER IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.',
  'limitation_of_liability', 'low', true,
  'low', '[]',
  'mutual',
  0.95, 0.56, 0.25, 0.95,
  'california', 'labeler-001', 0.97,
  'Well-drafted mutual limitation. 12-month fee cap is market standard for SaaS. Carve-outs for IP indemnification and data breaches would strengthen.',
  '2024-12-01T09:30:00Z'
);

-- Clause 3: Data Protection — SaaS MSA, missing GDPR provisions, critical
INSERT OR IGNORE INTO clauses (
  id, contract_id, clause_text, clause_type, risk_severity, market_standard,
  negotiability, missing_protections, drafting_style,
  h0_base_energy, energy_amplification_factor, lyapunov_exponent, energy_at_trigger,
  jurisdiction, labeled_by, confidence, notes, created_at
) VALUES (
  'CLZ-00003', 'contract-001',
  'Provider will maintain reasonable administrative, physical, and technical safeguards to protect Customer Data. Provider will notify Customer within a reasonable time of becoming aware of any unauthorized access to Customer Data.',
  'data_protection', 'critical', false,
  'high', '["gdpr_dpa","ccpa_compliance","breach_notification_timeline","data_deletion_rights","subprocessor_list","data_residency","penetration_testing","soc2_audit_rights"]',
  'hybrid',
  0.85, 3.5, 0.8, 0.99,
  'california', 'labeler-001', 0.95,
  'Critically deficient. "Reasonable safeguards" and "reasonable time" are dangerously vague in 2024. Missing DPA, CCPA addendum, 72-hour breach notification, deletion rights. Immediate remediation required for California-governed SaaS.',
  '2024-12-01T09:45:00Z'
);

-- Clause 4: Force Majeure — SaaS MSA, balanced
INSERT OR IGNORE INTO clauses (
  id, contract_id, clause_text, clause_type, risk_severity, market_standard,
  negotiability, missing_protections, drafting_style,
  h0_base_energy, energy_amplification_factor, lyapunov_exponent, energy_at_trigger,
  jurisdiction, labeled_by, confidence, notes, created_at
) VALUES (
  'CLZ-00004', 'contract-001',
  'Neither party shall be liable for any failure or delay in performance to the extent caused by circumstances beyond its reasonable control, including acts of God, war, terrorism, riots, embargoes, acts of civil or military authority, fires, floods, accidents, pandemics, or strikes. The affected party shall provide prompt written notice and use commercially reasonable efforts to mitigate the impact. If the force majeure event continues for more than sixty (60) days, either party may terminate this Agreement upon written notice.',
  'force_majeure', 'standard', true,
  'low', '[]',
  'mutual',
  0.6, 0.35, 0.25, 0.6,
  'california', 'labeler-001', 0.94,
  'Well-structured mutual force majeure. 60-day termination trigger is market standard. Explicit mitigation obligation is good practice.',
  '2024-12-01T10:00:00Z'
);

-- Clause 5: Confidentiality — NDA, mutual, standard
INSERT OR IGNORE INTO clauses (
  id, contract_id, clause_text, clause_type, risk_severity, market_standard,
  negotiability, missing_protections, drafting_style,
  h0_base_energy, energy_amplification_factor, lyapunov_exponent, energy_at_trigger,
  jurisdiction, labeled_by, confidence, notes, created_at
) VALUES (
  'CLZ-00005', 'contract-002',
  'Each party (as "Receiving Party") agrees to hold in strict confidence all Confidential Information of the other party (the "Disclosing Party") and not to disclose such Confidential Information to any third party without the prior written consent of the Disclosing Party. Each party shall use the Confidential Information solely for the Purpose and shall protect it with at least the same degree of care it uses for its own confidential information, but no less than reasonable care. This obligation shall survive termination of this Agreement for a period of five (5) years.',
  'confidentiality', 'standard', true,
  'low', '[]',
  'mutual',
  0.6, 0.35, 0.25, 0.6,
  'new_york', 'labeler-002', 0.96,
  'Standard mutual NDA confidentiality clause. 5-year survival is market standard. No issues.',
  '2024-12-01T10:15:00Z'
);

-- Clause 6: IP Ownership — NDA, company-favorable, high risk
INSERT OR IGNORE INTO clauses (
  id, contract_id, clause_text, clause_type, risk_severity, market_standard,
  negotiability, missing_protections, drafting_style,
  h0_base_energy, energy_amplification_factor, lyapunov_exponent, energy_at_trigger,
  jurisdiction, labeled_by, confidence, notes, created_at
) VALUES (
  'CLZ-00006', 'contract-002',
  'Any and all inventions, discoveries, developments, innovations, ideas, improvements, works of authorship, and other intellectual property conceived, created, developed, or reduced to practice by Employee, alone or with others, during the term of employment and for a period of one (1) year thereafter, whether or not during working hours, whether or not using Company equipment or resources, and whether or not related to Company''s current or anticipated business, shall be the sole and exclusive property of Company.',
  'ip_ownership', 'high', false,
  'high', '["personal_ip_carve_out","prior_inventions_schedule","moonlighting_rights","state_law_compliance"]',
  'defendant_friendly',
  0.85, 2.8, 0.8, 0.99,
  'new_york', 'labeler-002', 0.89,
  'Dangerously overbroad. Captures personal projects, prior inventions, and non-work-related IP. Missing required carve-outs under NY Labor Law 203-f and similar state statutes. One-year post-employment tail is unusually aggressive.',
  '2024-12-01T10:30:00Z'
);

-- Clause 7: Dispute Resolution — NDA, arbitration, medium risk
INSERT OR IGNORE INTO clauses (
  id, contract_id, clause_text, clause_type, risk_severity, market_standard,
  negotiability, missing_protections, drafting_style,
  h0_base_energy, energy_amplification_factor, lyapunov_exponent, energy_at_trigger,
  jurisdiction, labeled_by, confidence, notes, created_at
) VALUES (
  'CLZ-00007', 'contract-002',
  'Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration administered by JAMS pursuant to its Comprehensive Arbitration Rules and Procedures, before a single arbitrator. The arbitration shall be conducted in New York, New York. The arbitrator may award any remedy available at law or in equity. Judgment on the award rendered by the arbitrator may be entered in any court having jurisdiction.',
  'dispute_resolution', 'medium', true,
  'medium', '["class_action_waiver","governing_law","injunctive_relief_carve_out","cost_allocation"]',
  'mutual',
  0.65, 0.91, 0.5, 0.78,
  'new_york', 'labeler-002', 0.87,
  'Standard JAMS arbitration. Missing explicit class action waiver (increasingly important), governing law clause, and carve-out for injunctive relief (critical for trade secret and IP matters).',
  '2024-12-01T10:45:00Z'
);

-- Clause 8: Payment Terms — Employment, standard
INSERT OR IGNORE INTO clauses (
  id, contract_id, clause_text, clause_type, risk_severity, market_standard,
  negotiability, missing_protections, drafting_style,
  h0_base_energy, energy_amplification_factor, lyapunov_exponent, energy_at_trigger,
  jurisdiction, labeled_by, confidence, notes, created_at
) VALUES (
  'CLZ-00008', 'contract-003',
  'Employee shall be compensated at an annual base salary of [AMOUNT], payable in equal bi-weekly installments in accordance with Company''s standard payroll practices, less applicable taxes and withholdings. Salary shall be subject to annual review but shall not be decreased without Employee''s written consent. Employee shall be eligible to participate in Company''s annual bonus program, with a target bonus of [PERCENTAGE]% of base salary, subject to Company and individual performance objectives.',
  'payment_terms', 'medium', true,
  'medium', '["overtime_provisions","expense_reimbursement_policy","equity_compensation","benefits_summary"]',
  'mutual',
  0.5, 0.91, 0.5, 0.65,
  'texas', 'labeler-003', 0.83,
  'Standard employment compensation clause. Salary protection from decrease is good. Missing expense reimbursement, overtime classification confirmation, and equity terms if applicable. Bonus target without floor creates ambiguity.',
  '2024-12-01T11:00:00Z'
);

-- Clause 9: Termination for Convenience — Employment, employer-favorable, high risk
INSERT OR IGNORE INTO clauses (
  id, contract_id, clause_text, clause_type, risk_severity, market_standard,
  negotiability, missing_protections, drafting_style,
  h0_base_energy, energy_amplification_factor, lyapunov_exponent, energy_at_trigger,
  jurisdiction, labeled_by, confidence, notes, created_at
) VALUES (
  'CLZ-00009', 'contract-003',
  'Employment under this Agreement is at-will and may be terminated by Company at any time, with or without cause, and with or without notice. Upon termination, Employee shall be entitled only to compensation earned through the date of termination. No severance pay, benefits continuation, or other post-termination compensation shall be owed to Employee except as required by applicable law.',
  'termination_for_convenience', 'high', false,
  'medium', '["severance_formula","cobra_continuation","accelerated_vesting","non_disparagement","reference_letter","garden_leave"]',
  'defendant_friendly',
  0.75, 2.8, 0.5, 0.99,
  'texas', 'labeler-003', 0.91,
  'Maximum employer-favorable at-will clause with explicit no-severance provision. Legal in Texas but below market for professional/senior roles. Missing any transition support. Would negotiate for 2-week minimum + COBRA + equity acceleration on change of control.',
  '2024-12-01T11:15:00Z'
);

-- Clause 10: SLA Performance — SaaS MSA, missing remedies, critical
INSERT OR IGNORE INTO clauses (
  id, contract_id, clause_text, clause_type, risk_severity, market_standard,
  negotiability, missing_protections, drafting_style,
  h0_base_energy, energy_amplification_factor, lyapunov_exponent, energy_at_trigger,
  jurisdiction, labeled_by, confidence, notes, created_at
) VALUES (
  'CLZ-00010', 'contract-003',
  'Provider shall use commercially reasonable efforts to ensure the Service is available 99% of the time, measured monthly, excluding scheduled maintenance windows. Provider will provide advance notice of scheduled maintenance where practicable.',
  'sla_performance', 'critical', false,
  'high', '["service_credits","measurement_methodology","exclusion_definitions","uptime_reporting","escalation_procedure","termination_right_for_repeated_failure","financial_remedy_for_downtime"]',
  'defendant_friendly',
  0.7, 3.5, 0.8, 0.99,
  'california', 'labeler-001', 0.94,
  'SLA without teeth. "Commercially reasonable efforts" is not an SLA. 99% = 7.3 hours downtime/month with no financial remedy. Missing service credits, measurement methodology, exclusion carve-outs, and any termination right. Functionally worthless as written.',
  '2024-12-01T11:30:00Z'
);
