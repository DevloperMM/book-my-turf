/*
  Warnings:

  - A unique constraint covering the columns `[gatewayPaymentId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Booking_turfId_date_startTime_key";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "gatewayPaymentId" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "name" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_gatewayPaymentId_key" ON "Payment"("gatewayPaymentId");

-- Create Partial Index
CREATE UNIQUE INDEX "booking_active_slot_key" 
ON "Booking" ("turfId", "date", "startTime") 
WHERE "status" IN ('HELD', 'PAID', 'CONFIRMED');