-- Counts are derived only from approved, publicly displayable source documents. No firm tables are read.
alter function public.legal_corpus_overview() security definer;
revoke all on function public.legal_corpus_overview() from public;
grant execute on function public.legal_corpus_overview() to anon,authenticated;
