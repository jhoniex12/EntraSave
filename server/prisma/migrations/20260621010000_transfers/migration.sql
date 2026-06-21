BEGIN TRY

BEGIN TRAN;

-- Transfers are two linked Transaction legs (TRANSFER_OUT on the source account,
-- TRANSFER_IN on the destination) sharing a transferId. The pair is created and
-- deleted atomically; per-account balances include the legs while income/expense
-- totals exclude them (a transfer moves money, it is not earning or spending).

IF COL_LENGTH(N'dbo.Transaction', N'transferId') IS NULL
  ALTER TABLE [dbo].[Transaction] ADD [transferId] NVARCHAR(255) NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE [name] = N'Transaction_userId_transferId_idx'
    AND [object_id] = OBJECT_ID(N'[dbo].[Transaction]')
)
  EXEC(N'CREATE NONCLUSTERED INDEX [Transaction_userId_transferId_idx]
    ON [dbo].[Transaction]([userId], [transferId])');

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
  ROLLBACK TRAN;
END;
THROW

END CATCH
