
DO $$
DECLARE
  canonical uuid := 'e728ce16-ccdb-437e-ab2a-0810312e189d';
  duplicate uuid := '7af929a0-e652-4fd4-a1b1-a67c0f05e0e1';
  jobs_deleted int;
BEGIN
  -- ============================================================
  -- Part 1a: Merge duplicate Jared profile into canonical
  -- ============================================================
  UPDATE public.leads SET created_by = canonical WHERE created_by = duplicate;
  UPDATE public.leads SET assigned_to = canonical WHERE assigned_to = duplicate;
  UPDATE public.jobs SET created_by = canonical WHERE created_by = duplicate;
  UPDATE public.jobs SET assigned_to = canonical WHERE assigned_to = duplicate;
  UPDATE public.lead_activities SET user_id = canonical WHERE user_id = duplicate;
  UPDATE public.lead_notes SET user_id = canonical WHERE user_id = duplicate;
  UPDATE public.lead_documents SET uploaded_by = canonical WHERE uploaded_by = duplicate;
  UPDATE public.lead_reports SET created_by = canonical WHERE created_by = duplicate;
  UPDATE public.job_photos SET uploaded_by = canonical WHERE uploaded_by = duplicate;
  UPDATE public.job_property_analyses SET created_by = canonical WHERE created_by = duplicate;
  UPDATE public.generated_reports SET created_by = canonical WHERE created_by = duplicate;
  UPDATE public.contracts SET rep_user_id = canonical WHERE rep_user_id = duplicate;
  UPDATE public.job_order_snapshots SET created_by = canonical WHERE created_by = duplicate;
  UPDATE public.job_order_snapshots SET approved_by = canonical WHERE approved_by = duplicate;
  UPDATE public.job_order_history SET actor = canonical WHERE actor = duplicate;
  UPDATE public.audit_log SET actor_user_id = canonical WHERE actor_user_id = duplicate;
  UPDATE public.company_invites SET invited_by = canonical WHERE invited_by = duplicate;
  UPDATE public.company_join_requests SET user_id = canonical WHERE user_id = duplicate;
  UPDATE public.company_join_requests SET decided_by = canonical WHERE decided_by = duplicate;
  UPDATE public.ai_measurement_runs SET reviewed_by = canonical WHERE reviewed_by = duplicate;
  UPDATE public.ai_measurement_runs SET user_id = canonical WHERE user_id = duplicate;

  DELETE FROM public.profiles WHERE id = duplicate;
  DELETE FROM auth.users WHERE id = duplicate;

  INSERT INTO public.audit_log (actor_user_id, action, target_type, target_id, metadata)
  VALUES (canonical, 'merge_profile', 'profile', duplicate::text,
          jsonb_build_object('canonical_id', canonical, 'duplicate_id', duplicate, 'duplicate_email', 'jared@globalcontractor.network'));

  -- ============================================================
  -- Part 1b: Wipe ALL jobs and dependent data
  -- ============================================================
  DELETE FROM public.estimate_line_items
    WHERE estimate_id IN (SELECT id FROM public.estimates);
  DELETE FROM public.estimates;
  DELETE FROM public.job_order_history;
  DELETE FROM public.job_order_snapshots;
  DELETE FROM public.job_order_drafts;
  DELETE FROM public.job_property_analyses;
  DELETE FROM public.job_photos;
  DELETE FROM public.contracts WHERE job_id IS NOT NULL;
  DELETE FROM public.generated_reports;
  DELETE FROM public.ai_measurement_runs WHERE job_id IS NOT NULL;

  SELECT count(*) INTO jobs_deleted FROM public.jobs;
  DELETE FROM public.jobs;

  INSERT INTO public.audit_log (actor_user_id, action, target_type, target_id, metadata)
  VALUES (canonical, 'wipe_all_jobs', 'jobs', NULL,
          jsonb_build_object('jobs_deleted', jobs_deleted));
END $$;
