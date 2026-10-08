-- Run this after the existing email migration when upgrading an existing SportsWeek database.
-- Skip the statement if the column already exists.
ALTER TABLE teams ADD COLUMN ReviewReason VARCHAR(500) NULL;
