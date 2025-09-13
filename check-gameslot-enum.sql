-- Check what the current slot column uses
SELECT DISTINCT slot FROM "Match" WHERE slot IS NOT NULL LIMIT 10;
