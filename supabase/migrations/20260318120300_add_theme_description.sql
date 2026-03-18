-- Add description column to themes table
-- Stores a one-sentence explanation of why something was identified as a theme
-- Returned by the AI service's /themes/extract endpoint

alter table themes add column description text;
