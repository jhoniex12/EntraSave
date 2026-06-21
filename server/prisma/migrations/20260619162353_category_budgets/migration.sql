BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Budget] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [categoryId] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [amount] DECIMAL(19,4) NOT NULL,
    [period] NVARCHAR(1000) NOT NULL CONSTRAINT [Budget_period_df] DEFAULT 'MONTHLY',
    [startsAt] DATETIME2 NOT NULL CONSTRAINT [Budget_startsAt_df] DEFAULT CURRENT_TIMESTAMP,
    [endsAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Budget_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [Budget_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Budget_userId_categoryId_period_key] UNIQUE NONCLUSTERED ([userId],[categoryId],[period])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Budget_userId_idx] ON [dbo].[Budget]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Budget_userId_period_idx] ON [dbo].[Budget]([userId], [period]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Budget_userId_deletedAt_idx] ON [dbo].[Budget]([userId], [deletedAt]);

-- AddForeignKey
ALTER TABLE [dbo].[Budget] ADD CONSTRAINT [Budget_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Budget] ADD CONSTRAINT [Budget_categoryId_fkey] FOREIGN KEY ([categoryId]) REFERENCES [dbo].[Category]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
