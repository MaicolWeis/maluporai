/*
  Warnings:

  - Changed the type of `forma` on the `pagamentos` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "pagamentos" DROP COLUMN "forma",
ADD COLUMN     "forma" TEXT NOT NULL;

-- DropEnum
DROP TYPE "pagamento_forma";
