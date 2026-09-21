-- Tanzania primary-law retrieval benchmark.
-- Retrieval/grounding checks against official OAG titles; not a substitute for lawyer review.
-- A failure means a common legal issue does not surface its expected primary authority in the first 12 passages.

with cases(case_key,query,expected_title,citation_prefix) as (
  values
  ('tz-employment-termination','"employment" "termination"','The Employment and Labour Relations Act','Cap. 366'),
  ('tz-company-directors','"company" "director"','The Companies Act','Cap. 212'),
  ('tz-land-rights','"land" "occupancy"','The Land Act','Cap. 113'),
  ('tz-land-registration','"land" "registration"','The Land Registration Act','Cap. 334'),
  ('tz-contract-breach','"contract" "breach"','The Law of Contract Act','Cap. 345'),
  ('tz-evidence-admissibility','"evidence" "admissibility"','The Evidence Act','Cap. 6'),
  ('tz-arbitration','"arbitration" "award"','The Arbitration Act','Cap. 15'),
  ('tz-civil-procedure','"civil" "procedure"','The Civil Procedure Code','Cap. 33'),
  ('tz-criminal-procedure','"criminal" "procedure"','The Criminal Procedure Act','Cap. 20'),
  ('tz-penal-code','"penal" "code"','THE PENAL CODE','Cap. 16'),
  ('tz-data-protection','"personal" "data"','The Personal Data Protection Act, 2022','Cap. 44'),
  ('tz-marriage','"marriage" "divorce"','The Law of Marriage Act','Cap. 29'),
  ('tz-income-tax','"income" "tax"','The Income Tax Act','Cap. 332'),
  ('tz-banking','"banking" "financial"','The Banking and Financial Institutions Act','Cap. 342'),
  ('tz-competition','"competition" "consumer"','The Fair Competition Act','Cap. 285')
), scored as (
  select c.case_key,
    bool_or(
      lower(s.title)=lower(c.expected_title)
      and coalesce(s.citation,'') ilike c.citation_prefix || '%'
    ) passed
  from cases c
  left join lateral public.search_legal_evidence(c.query,array['TZ']::text[],12) s on true
  group by c.case_key
)
select * from scored order by case_key;
