-- Run this only if the sportsweek database was created by an earlier version.
-- If the columns already exist, skip the corresponding statement.
ALTER TABLE users ADD COLUMN EmailVerified TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN EmailVerificationTokenHash VARCHAR(128) NULL;
ALTER TABLE users ADD COLUMN EmailVerificationExpiresAt DATETIME(6) NULL;
ALTER TABLE users ADD COLUMN EmailVerifiedAt DATETIME(6) NULL;
