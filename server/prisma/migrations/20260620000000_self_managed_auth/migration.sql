BEGIN TRY

BEGIN TRAN;

-- This migration is intentionally recovery-safe because its first deployment
-- may have failed while SQL Server compiled indexes before the new columns.
IF EXISTS (
  SELECT 1 FROM sys.key_constraints
  WHERE [name] = N'User_clerkUserId_key'
    AND [parent_object_id] = OBJECT_ID(N'[dbo].[User]')
)
  ALTER TABLE [dbo].[User] DROP CONSTRAINT [User_clerkUserId_key];

IF COL_LENGTH(N'dbo.User', N'clerkUserId') IS NOT NULL
  ALTER TABLE [dbo].[User] DROP COLUMN [clerkUserId];

IF COL_LENGTH(N'dbo.User', N'passwordHash') IS NULL
  ALTER TABLE [dbo].[User] ADD [passwordHash] NVARCHAR(1000) NULL;

IF COL_LENGTH(N'dbo.User', N'googleId') IS NULL
  ALTER TABLE [dbo].[User] ADD [googleId] NVARCHAR(255) NULL;

IF COL_LENGTH(N'dbo.User', N'facebookId') IS NULL
  ALTER TABLE [dbo].[User] ADD [facebookId] NVARCHAR(255) NULL;

IF COL_LENGTH(N'dbo.User', N'emailVerifiedAt') IS NULL
  ALTER TABLE [dbo].[User] ADD [emailVerifiedAt] DATETIME2 NULL;

IF COL_LENGTH(N'dbo.User', N'sessionVersion') IS NULL
  ALTER TABLE [dbo].[User] ADD [sessionVersion] INT NOT NULL
    CONSTRAINT [User_sessionVersion_df] DEFAULT 0;

-- Dynamic SQL avoids SQL Server resolving newly added column names when it
-- compiles the outer migration batch. Nullable provider ids require filtered
-- unique indexes because an ordinary SQL Server unique constraint permits only
-- one NULL.
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE [name] = N'User_googleId_unique_not_null'
    AND [object_id] = OBJECT_ID(N'[dbo].[User]')
)
  EXEC(N'CREATE UNIQUE NONCLUSTERED INDEX [User_googleId_unique_not_null]
    ON [dbo].[User]([googleId]) WHERE [googleId] IS NOT NULL');

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE [name] = N'User_facebookId_unique_not_null'
    AND [object_id] = OBJECT_ID(N'[dbo].[User]')
)
  EXEC(N'CREATE UNIQUE NONCLUSTERED INDEX [User_facebookId_unique_not_null]
    ON [dbo].[User]([facebookId]) WHERE [facebookId] IS NOT NULL');

-- Email already has the unique User_email_key index from the initial migration.
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE [name] = N'User_googleId_idx'
    AND [object_id] = OBJECT_ID(N'[dbo].[User]')
)
  EXEC(N'CREATE NONCLUSTERED INDEX [User_googleId_idx]
    ON [dbo].[User]([googleId])');

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE [name] = N'User_facebookId_idx'
    AND [object_id] = OBJECT_ID(N'[dbo].[User]')
)
  EXEC(N'CREATE NONCLUSTERED INDEX [User_facebookId_idx]
    ON [dbo].[User]([facebookId])');

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
  ROLLBACK TRAN;
END;
THROW

END CATCH
