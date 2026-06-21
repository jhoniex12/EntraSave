BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[MonthlyBalance] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [year] INT NOT NULL,
    [month] INT NOT NULL,
    [startingBalance] DECIMAL(19,4) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MonthlyBalance_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [MonthlyBalance_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MonthlyBalance_userId_year_month_key] UNIQUE NONCLUSTERED ([userId],[year],[month])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MonthlyBalance_userId_idx] ON [dbo].[MonthlyBalance]([userId]);

-- AddForeignKey
ALTER TABLE [dbo].[MonthlyBalance] ADD CONSTRAINT [MonthlyBalance_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
