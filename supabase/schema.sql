begin;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null check (
        length(email) <= 254
        and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
    role text not null check (role in ('candidate', 'recruiter')),
    full_name text not null default '' check (length(full_name) <= 120),
    phone text not null default '' check (length(phone) <= 40),
    city text not null default '' check (length(city) <= 100),
    job_title text not null default '' check (length(job_title) <= 150),
    skills text[] not null default '{}' check (
        cardinality(skills) <= 50 and length(array_to_string(skills, ',')) <= 5000
    ),
    education text not null default '' check (length(education) <= 150),
    experience text not null default '' check (length(experience) <= 100),
    bio text not null default '' check (length(bio) <= 5000),
    cv_path text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
    id uuid primary key default gen_random_uuid(),
    recruiter_id uuid not null references public.profiles(id) on delete cascade,
    title text not null check (length(trim(title)) between 3 and 150),
    company text not null check (length(trim(company)) between 2 and 150),
    city text not null check (length(trim(city)) between 2 and 100),
    quartier text not null default '' check (length(quartier) <= 120),
    category text not null check (length(trim(category)) between 2 and 120),
    contract text not null check (contract in ('CDI', 'CDD', 'Stage', 'Alternance', 'Freelance')),
    salary text not null default 'À négocier' check (length(salary) <= 200),
    experience text not null default 'Non spécifié' check (length(experience) <= 100),
    education text not null default 'Non spécifié' check (length(education) <= 150),
    description text not null check (length(trim(description)) between 20 and 10000),
    missions text[] not null default '{}' check (
        cardinality(missions) <= 50 and length(array_to_string(missions, E'\n')) <= 10000
    ),
    skills text[] not null default '{}' check (
        cardinality(skills) <= 50 and length(array_to_string(skills, ',')) <= 5000
    ),
    profile text not null default '' check (length(profile) <= 5000),
    contact_email text not null check (
        length(contact_email) <= 254
        and contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
    contact_phone text not null default '' check (length(contact_phone) <= 40),
    status text not null default 'published' check (status in ('published', 'closed')),
    created_at timestamptz not null default now()
);

create table if not exists public.applications (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references public.jobs(id) on delete cascade,
    candidate_id uuid not null references public.profiles(id) on delete cascade,
    cv_path text not null,
    message text not null default '' check (length(message) <= 3000),
    status text not null default 'received' check (status in ('received', 'reviewing', 'accepted', 'rejected')),
    created_at timestamptz not null default now(),
    unique (job_id, candidate_id)
);

create table if not exists public.contact_messages (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(trim(name)) between 2 and 120),
    email text not null check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
    subject text not null check (length(trim(subject)) between 2 and 200),
    message text not null check (length(trim(message)) between 10 and 5000),
    created_at timestamptz not null default now()
);

create index if not exists jobs_status_created_at_idx on public.jobs (status, created_at desc);
create index if not exists jobs_recruiter_id_idx on public.jobs (recruiter_id);
create index if not exists applications_candidate_created_at_idx on public.applications (candidate_id, created_at desc);
create index if not exists applications_job_created_at_idx on public.applications (job_id, created_at desc);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    requested_role text;
begin
    requested_role := new.raw_user_meta_data ->> 'role';
    if requested_role not in ('candidate', 'recruiter') then
        raise exception 'Invalid account role';
    end if;

    insert into public.profiles (id, email, role)
    values (new.id, new.email, requested_role);
    return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
    after insert on auth.users
    for each row execute procedure public.create_profile_for_new_user();

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.role <> old.role or new.id <> old.id or new.email <> old.email then
        raise exception 'Account role, email and owner cannot be changed here';
    end if;
    if new.cv_path is not null
        and split_part(new.cv_path, '/', 1) <> (select auth.uid())::text then
        raise exception 'A candidate can only use a CV stored in their own folder';
    end if;
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
    before update on public.profiles
    for each row execute procedure public.prevent_profile_role_change();

create or replace function public.prevent_application_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.id <> old.id
        or new.job_id <> old.job_id
        or new.candidate_id <> old.candidate_id
        or new.cv_path <> old.cv_path
        or new.message <> old.message
        or new.created_at <> old.created_at then
        raise exception 'Only the application status can be changed';
    end if;
    return new;
end;
$$;

drop trigger if exists protect_application_identity on public.applications;
create trigger protect_application_identity
    before update on public.applications
    for each row execute procedure public.prevent_application_identity_change();

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.contact_messages enable row level security;

drop policy if exists "Users read their own profile and recruiting applicants" on public.profiles;
create policy "Users read their own profile and recruiting applicants"
    on public.profiles for select to authenticated
    using (
        id = (select auth.uid())
        or (
            role = 'candidate'
            and exists (
                select 1
                from public.applications a
                join public.jobs j on j.id = a.job_id
                where a.candidate_id = profiles.id
                  and j.recruiter_id = (select auth.uid())
            )
        )
    );

drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile"
    on public.profiles for update to authenticated
    using (id = (select auth.uid()))
    with check (id = (select auth.uid()));

drop policy if exists "Published jobs are public and owners can read all their jobs" on public.jobs;
create policy "Published jobs are public and owners can read all their jobs"
    on public.jobs for select
    using (status = 'published' or recruiter_id = (select auth.uid()));

drop policy if exists "Recruiters create jobs for themselves" on public.jobs;
create policy "Recruiters create jobs for themselves"
    on public.jobs for insert to authenticated
    with check (
        recruiter_id = (select auth.uid())
        and exists (
            select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.role = 'recruiter'
        )
    );

drop policy if exists "Recruiters update their own jobs" on public.jobs;
create policy "Recruiters update their own jobs"
    on public.jobs for update to authenticated
    using (recruiter_id = (select auth.uid()))
    with check (recruiter_id = (select auth.uid()));

drop policy if exists "Candidates submit one application to published jobs" on public.applications;
create policy "Candidates submit one application to published jobs"
    on public.applications for insert to authenticated
    with check (
        candidate_id = (select auth.uid())
        and cv_path like ((select auth.uid())::text || '/%')
        and exists (
            select 1
            from public.profiles p
            join public.jobs j on j.status = 'published' and j.id = applications.job_id
            where p.id = (select auth.uid())
              and p.role = 'candidate'
              and p.cv_path = applications.cv_path
              and length(trim(p.full_name)) > 0
              and length(trim(p.phone)) > 0
              and length(trim(p.job_title)) > 0
        )
    );

drop policy if exists "Candidates and job owners read applications" on public.applications;
create policy "Candidates and job owners read applications"
    on public.applications for select to authenticated
    using (
        candidate_id = (select auth.uid())
        or exists (
            select 1 from public.jobs j
            where j.id = applications.job_id and j.recruiter_id = (select auth.uid())
        )
    );

drop policy if exists "Recruiters update application status for their jobs" on public.applications;
create policy "Recruiters update application status for their jobs"
    on public.applications for update to authenticated
    using (
        exists (
            select 1 from public.jobs j
            where j.id = applications.job_id and j.recruiter_id = (select auth.uid())
        )
    )
    with check (
        exists (
            select 1 from public.jobs j
            where j.id = applications.job_id and j.recruiter_id = (select auth.uid())
        )
    );

drop policy if exists "Visitors send contact messages" on public.contact_messages;
create policy "Visitors send contact messages"
    on public.contact_messages for insert to anon, authenticated
    with check (
        length(trim(name)) between 2 and 120
        and length(trim(subject)) between 2 and 200
        and length(trim(message)) between 10 and 5000
        and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    );

grant select, update on public.profiles to authenticated;
revoke select on public.jobs from public, anon, authenticated;
grant select (
    id, title, company, city, quartier, category, contract, salary, experience,
    education, description, missions, skills, profile, contact_email,
    contact_phone, status, created_at
) on public.jobs to anon;
grant select (
    id, recruiter_id, title, company, city, quartier, category, contract,
    salary, experience, education, description, missions, skills, profile,
    contact_email, contact_phone, status, created_at
) on public.jobs to authenticated;
grant insert, update on public.jobs to authenticated;
grant select, insert, update on public.applications to authenticated;
grant insert on public.contact_messages to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('candidate-cvs', 'candidate-cvs', false, 5242880, array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Candidates upload CVs to their own folder" on storage.objects;
create policy "Candidates upload CVs to their own folder"
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'candidate-cvs'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and exists (
            select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.role = 'candidate'
        )
    );

drop policy if exists "Candidates and their recruiters read CVs" on storage.objects;
create policy "Candidates and their recruiters read CVs"
    on storage.objects for select to authenticated
    using (
        bucket_id = 'candidate-cvs'
        and (
            (storage.foldername(name))[1] = (select auth.uid())::text
            or exists (
                select 1
                from public.applications a
                join public.jobs j on j.id = a.job_id
                where a.cv_path = storage.objects.name
                  and j.recruiter_id = (select auth.uid())
            )
        )
    );

drop policy if exists "Candidates remove their own CVs" on storage.objects;

commit;
