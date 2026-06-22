BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Account] ADD [position] INT NOT NULL CONSTRAINT [Account_position_df] DEFAULT 0;

-- CreateIndex
CREATE NONCLUSTERED INDEX [Account_userId_position_idx] ON [dbo].[Account]([userId], [position]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
