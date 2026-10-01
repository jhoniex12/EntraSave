BEGIN TRY

BEGIN TRAN;

-- PIN unlock with server-side attempt lockout. Existing rows keep the legacy
-- PASSWORD scheme (via the column default) until converted on next unlock.
ALTER TABLE [dbo].[VaultKey] ALTER COLUMN [verifierIv] NVARCHAR(32) NULL;
ALTER TABLE [dbo].[VaultKey] ALTER COLUMN [verifier] NVARCHAR(256) NULL;
ALTER TABLE [dbo].[VaultKey] ADD [failedAttempts] INT NOT NULL CONSTRAINT [VaultKey_failedAttempts_df] DEFAULT 0,
[lockedUntil] DATETIME2,
[pinVerifier] NVARCHAR(64),
[scheme] NVARCHAR(16) NOT NULL CONSTRAINT [VaultKey_scheme_df] DEFAULT 'PASSWORD',
[wrappedSecret] NVARCHAR(256);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

