BEGIN TRY

BEGIN TRAN;

-- Idempotency keys for safe create retries (double-click, refresh during a slow
-- request, retry after timeout). The key is optional; nullable columns require
-- FILTERED unique indexes because an ordinary SQL Server unique constraint/index
-- permits only one NULL. Dynamic SQL (EXEC) avoids the outer batch resolving the
-- newly added column names at compile time.

IF COL_LENGTH(N'dbo.Transaction', N'idempotencyKey') IS NULL
  ALTER TABLE [dbo].[Transaction] ADD [idempotencyKey] NVARCHAR(255) NULL;

IF COL_LENGTH(N'dbo.Account', N'idempotencyKey') IS NULL
  ALTER TABLE [dbo].[Account] ADD [idempotencyKey] NVARCHAR(255) NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE [name] = N'Transaction_userId_idempotencyKey_unique_not_null'
    AND [object_id] = OBJECT_ID(N'[dbo].[Transaction]')
)
  EXEC(N'CREATE UNIQUE NONCLUSTERED INDEX [Transaction_userId_idempotencyKey_unique_not_null]
    ON [dbo].[Transaction]([userId], [idempotencyKey]) WHERE [idempotencyKey] IS NOT NULL');

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE [name] = N'Account_userId_idempotencyKey_unique_not_null'
    AND [object_id] = OBJECT_ID(N'[dbo].[Account]')
)
  EXEC(N'CREATE UNIQUE NONCLUSTERED INDEX [Account_userId_idempotencyKey_unique_not_null]
    ON [dbo].[Account]([userId], [idempotencyKey]) WHERE [idempotencyKey] IS NOT NULL');

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
  ROLLBACK TRAN;
END;
THROW

END CATCH
