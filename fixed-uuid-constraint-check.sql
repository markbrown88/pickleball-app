-- Fixed query to check for ANY remaining UUID constraints in the entire database
-- Run this in Supabase SQL Editor

-- Check all constraints that might be enforcing UUID format
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    pg_get_constraintdef(c.oid) as definition
FROM information_schema.table_constraints tc
JOIN pg_constraint c ON tc.constraint_name = c.conname
WHERE tc.table_schema = 'public'
AND (
    pg_get_constraintdef(c.oid) LIKE '%uuid%' 
    OR pg_get_constraintdef(c.oid) LIKE '%UUID%'
    OR tc.constraint_name LIKE '%uuid%'
    OR tc.constraint_name LIKE '%UUID%'
);

-- Check all indexes that might be enforcing UUID format
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
AND (
    indexdef LIKE '%uuid%' 
    OR indexdef LIKE '%UUID%'
    OR indexname LIKE '%uuid%'
    OR indexname LIKE '%UUID%'
);

-- Check if there are any custom types that might be causing issues
SELECT 
    typname,
    typtype,
    typinput::regproc as input_function
FROM pg_type 
WHERE typname LIKE '%uuid%' 
OR typname LIKE '%UUID%';

-- Check if there are any functions that might be validating UUID format
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition LIKE '%uuid%' 
OR routine_definition LIKE '%UUID%';
