-- Parser output stays in the existing private vault under organization-scoped paths.
update storage.buckets set allowed_mime_types=array_append(allowed_mime_types,'application/json') where id='firm-vault' and allowed_mime_types is not null and not ('application/json'=any(allowed_mime_types));
