CREATE DATABASE IF NOT EXISTS sportsweek CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Recommended: use a dedicated application account instead of root.
CREATE USER IF NOT EXISTS 'sportsweek_app'@'localhost' IDENTIFIED BY 'CHANGE_THIS_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON sportsweek.* TO 'sportsweek_app'@'localhost';
FLUSH PRIVILEGES;
