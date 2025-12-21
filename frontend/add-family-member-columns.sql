-- Add missing family_members columns if they don't exist
-- Run this directly on your production database (Neon)

DO $$
BEGIN
    -- Add encrypted_private_key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'family_members' 
        AND column_name = 'encrypted_private_key'
    ) THEN
        ALTER TABLE "family_members" ADD COLUMN "encrypted_private_key" TEXT;
        RAISE NOTICE 'Added column encrypted_private_key';
    ELSE
        RAISE NOTICE 'Column encrypted_private_key already exists';
    END IF;

    -- Add encrypted_private_key_temp
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'family_members' 
        AND column_name = 'encrypted_private_key_temp'
    ) THEN
        ALTER TABLE "family_members" ADD COLUMN "encrypted_private_key_temp" TEXT;
        RAISE NOTICE 'Added column encrypted_private_key_temp';
    ELSE
        RAISE NOTICE 'Column encrypted_private_key_temp already exists';
    END IF;

    -- Add recovery_key_encrypted_smk
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'family_members' 
        AND column_name = 'recovery_key_encrypted_smk'
    ) THEN
        ALTER TABLE "family_members" ADD COLUMN "recovery_key_encrypted_smk" TEXT;
        RAISE NOTICE 'Added column recovery_key_encrypted_smk';
    ELSE
        RAISE NOTICE 'Column recovery_key_encrypted_smk already exists';
    END IF;

    -- Add recovery_key_generated_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'family_members' 
        AND column_name = 'recovery_key_generated_at'
    ) THEN
        ALTER TABLE "family_members" ADD COLUMN "recovery_key_generated_at" TIMESTAMPTZ(6);
        RAISE NOTICE 'Added column recovery_key_generated_at';
    ELSE
        RAISE NOTICE 'Column recovery_key_generated_at already exists';
    END IF;
END $$;
