BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[VaultKey] (
    [userId] NVARCHAR(1000) NOT NULL,
    [kdfSalt] NVARCHAR(64) NOT NULL,
    [kdfIterations] INT NOT NULL,
    [verifierIv] NVARCHAR(32) NOT NULL,
    [verifier] NVARCHAR(256) NOT NULL,
    [keyVersion] INT NOT NULL CONSTRAINT [VaultKey_keyVersion_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VaultKey_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [VaultKey_pkey] PRIMARY KEY CLUSTERED ([userId])
);

-- CreateTable
CREATE TABLE [dbo].[VaultItem] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [iv] NVARCHAR(32) NOT NULL,
    [ciphertext] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VaultItem_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [VaultItem_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VaultItem_userId_createdAt_idx] ON [dbo].[VaultItem]([userId], [createdAt]);

-- AddForeignKey
ALTER TABLE [dbo].[VaultKey] ADD CONSTRAINT [VaultKey_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[VaultItem] ADD CONSTRAINT [VaultItem_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- RBAC data: grant the vault permissions to the existing USER and SUPERADMIN
-- roles so deployed databases work without re-running the seed. Idempotent, and
-- a no-op on a fresh database where the seed creates roles afterwards.
INSERT INTO [dbo].[Permission] ([id], [key], [name])
SELECT CONVERT(NVARCHAR(1000), NEWID()), p.[key], p.[key]
FROM (VALUES (N'vault.read'), (N'vault.write')) AS p([key])
WHERE NOT EXISTS (SELECT 1 FROM [dbo].[Permission] x WHERE x.[key] = p.[key]);

INSERT INTO [dbo].[RolePermission] ([roleId], [permissionId])
SELECT r.[id], p.[id]
FROM [dbo].[Role] r
CROSS JOIN [dbo].[Permission] p
WHERE r.[key] IN (N'USER', N'SUPERADMIN')
  AND p.[key] IN (N'vault.read', N'vault.write')
  AND NOT EXISTS (
    SELECT 1 FROM [dbo].[RolePermission] rp
    WHERE rp.[roleId] = r.[id] AND rp.[permissionId] = p.[id]
  );

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
