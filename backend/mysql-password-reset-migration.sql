-- Run this on an existing SportsWeek database created before the password-reset hardening pass.
-- Skip any statement whose column already exists.
ALTER TABLE users ADD COLUMN PasswordResetTokenHash VARCHAR(128) NULL;
ALTER TABLE users ADD COLUMN PasswordResetExpiresAt DATETIME(6) NULL;
