from pathlib import Path

path = Path('services/docling/worker.py')
text = path.read_text()
old = '''    processed = 0
    try:
        for job in api.claim(worker_id, job_types, limit):
            job_id = str(job["id"])
            lease_token = str(job["lease_token"])
            try:
                with LeaseHeartbeat(api, job_id, lease_token) as heartbeat:
                    chunk_count = process_job(api, job)
                    if heartbeat.lost.is_set() or not api.complete(job_id, lease_token):
                        raise PipelineError("lease_lost", "Worker lease was lost before completion")
                    LOGGER.info("job completed", extra={"job_id": job_id, "chunks": chunk_count})
                    processed += 1
            except PipelineError as error:
                try:
                    state = api.fail(job_id, lease_token, error)
                    LOGGER.warning("job failed", extra={"job_id": job_id, "error_code": error.code, "state": state})
                except PipelineError:
                    LOGGER.exception("could not persist job failure; lease will expire", extra={"job_id": job_id})
            except Exception as error:
                LOGGER.exception("unexpected job failure", extra={"job_id": job_id})
                try:
                    api.fail(job_id, lease_token, PipelineError("unexpected_worker_error", str(error)))
                except PipelineError:
                    LOGGER.exception("could not persist unexpected job failure; lease will expire", extra={"job_id": job_id})
    finally:
        api.close()
    return processed
'''
new = '''    processed = 0
    handled = 0
    try:
        while handled < limit:
            claimed = api.claim(worker_id, job_types, 1)
            if not claimed:
                break
            job = claimed[0]
            handled += 1
            job_id = str(job["id"])
            lease_token = str(job["lease_token"])
            try:
                with LeaseHeartbeat(api, job_id, lease_token) as heartbeat:
                    chunk_count = process_job(api, job)
                    if heartbeat.lost.is_set() or not api.complete(job_id, lease_token):
                        raise PipelineError("lease_lost", "Worker lease was lost before completion")
                    LOGGER.info("job completed", extra={"job_id": job_id, "chunks": chunk_count})
                    processed += 1
            except PipelineError as error:
                try:
                    state = api.fail(job_id, lease_token, error)
                    LOGGER.warning("job failed", extra={"job_id": job_id, "error_code": error.code, "state": state})
                except PipelineError:
                    LOGGER.exception("could not persist job failure; lease will expire", extra={"job_id": job_id})
            except Exception as error:
                LOGGER.exception("unexpected job failure", extra={"job_id": job_id})
                try:
                    api.fail(job_id, lease_token, PipelineError("unexpected_worker_error", str(error)))
                except PipelineError:
                    LOGGER.exception("could not persist unexpected job failure; lease will expire", extra={"job_id": job_id})
    finally:
        api.close()
    return processed
'''
if old not in text:
    raise SystemExit('run loop target not found')
text = text.replace(old, new, 1)
text = text.replace('count = run(max(1, min(args.limit, 10)),', 'count = run(max(1, min(args.limit, 25)),', 1)
path.write_text(text)
print('worker now claims one job at a time and handles up to 25 per cycle')
