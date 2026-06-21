BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Account] DROP CONSTRAINT [Account_currency_df];
ALTER TABLE [dbo].[Account] ADD CONSTRAINT [Account_currency_df] DEFAULT 'AUD' FOR [currency];

-- AlterTable
ALTER TABLE [dbo].[Category] ADD [position] INT NOT NULL CONSTRAINT [Category_position_df] DEFAULT 0;

-- AlterTable
ALTER TABLE [dbo].[Transaction] DROP CONSTRAINT [Transaction_currency_df];
ALTER TABLE [dbo].[Transaction] ADD CONSTRAINT [Transaction_currency_df] DEFAULT 'AUD' FOR [currency];

-- AlterTable
ALTER TABLE [dbo].[User] DROP CONSTRAINT [User_baseCurrency_df];
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_baseCurrency_df] DEFAULT 'AUD' FOR [baseCurrency];

-- CreateIndex
CREATE NONCLUSTERED INDEX [Category_userId_position_idx] ON [dbo].[Category]([userId], [position]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
