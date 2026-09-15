alter function public.search_legal_evidence(text,text[],integer) set statement_timeout='30s';
alter function public.legal_corpus_overview() set statement_timeout='8s';
notify pgrst, 'reload schema';
