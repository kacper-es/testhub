-- CreateEnum
CREATE TYPE "Palette" AS ENUM ('LIME', 'CYAN', 'COBALT', 'MINT', 'MONO');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "palette" "Palette" NOT NULL DEFAULT 'LIME';

