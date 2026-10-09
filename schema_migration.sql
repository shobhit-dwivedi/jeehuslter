 
-- Private Error Book attachments. The first path segment is always auth.uid().
insert into storage.buckets (id, name, public)
values ('error-book', 'error-book', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists error_book_storage_read on storage.objects;
create policy error_book_storage_read
on storage.objects for select to authenticated
using (
  bucket_id = 'error-book'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists error_book_storage_insert on storage.objects;
create policy error_book_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'error-book'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists error_book_storage_update on storage.objects;
create policy error_book_storage_update
on storage.objects for update to authenticated
using (
  bucket_id = 'error-book'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'error-book'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists error_book_storage_delete on storage.objects;
create policy error_book_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'error-book'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Infinite Practice is a lifetime library. It is intentionally separate from
-- the official live-test catalog and never contributes to leaderboards.
create or replace function public.get_student_practice_catalog()
returns table (
  id uuid,
  title text,
  description text,
  instructions text,
  created_by uuid,
  duration_minutes integer,
  available_from timestamptz,
  available_until timestamptz,
  is_published boolean,
  created_at timestamptz,
  category text,
  result_release_at timestamptz,
  lifecycle text,
  attempt_id uuid,
  attempt_status text,
  attempt_score numeric,
  attempt_submitted_at timestamptz,
  is_practice boolean,
  practice_available boolean,
  total_marks numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id, t.title, t.description, t.instructions, t.created_by,
    t.duration_minutes, t.available_from, t.available_until,
    t.is_published, t.created_at, t.category, t.result_release_at,
    case
      when t.is_published and t.available_from <= now()
        and (t.available_until is null or t.available_until >= now())
        then 'live'
      when t.is_published and t.available_from > now() then 'locked'
      else 'past'
    end as lifecycle,
    null::uuid as attempt_id,
    null::text as attempt_status,
    null::numeric as attempt_score,
    null::timestamptz as attempt_submitted_at,
    true as is_practice,
    true as practice_available,
    coalesce((select sum(q.positive_marks) from public.questions q where q.test_id = t.id), 0) as total_marks
  from public.tests t
  where auth.uid() is not null
    and t.is_published = true
    and t.practice_enabled = true;
$$;

revoke all on function public.get_student_practice_catalog() from public, anon;
grant execute on function public.get_student_practice_catalog() to authenticated;

-- Lifetime practice starts are allowed at any time. Official test-start
-- functions are unchanged.
create or replace function public.start_practice_attempt(p_test_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test public.tests%rowtype;
  v_attempt public.test_attempts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select * into v_test from public.tests where id = p_test_id;
  if not found then raise exception 'Test not found.'; end if;
  if not v_test.is_published then raise exception 'This test is not published.'; end if;
  if not v_test.practice_enabled then
    raise exception 'Practice mode is not available for this test.';
  end if;

  select * into v_attempt
  from public.test_attempts
  where test_id = p_test_id and user_id = auth.uid() and is_practice = true
  order by started_at desc
  limit 1;

  if found and v_attempt.status = 'in_progress' then
    null;
  elsif found then
    delete from public.attempt_answers where attempt_id = v_attempt.id;
    update public.test_attempts
    set started_at = now(), submitted_at = null, status = 'in_progress',
        warning_count = 0, total_score = 0, disqualified_at = null,
        disqualified_by = null, disqualification_reason = null
    where id = v_attempt.id
    returning * into v_attempt;
  else
    insert into public.test_attempts (test_id, user_id, started_at, status, is_practice)
    values (p_test_id, auth.uid(), now(), 'in_progress', true)
    returning * into v_attempt;
  end if;

  return jsonb_build_object(
    'expired', false,
    'attempt_id', v_attempt.id,
    'test_id', v_attempt.test_id
  );
end;
$$;

revoke all on function public.start_practice_attempt(uuid) from public, anon;
grant execute on function public.start_practice_attempt(uuid) to authenticated;