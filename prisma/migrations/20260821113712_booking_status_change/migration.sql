/*
  Warnings:

  - A unique constraint covering the columns `[turfId,date,startTime]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "booking_active_slot_key";

-- CreateIndex
CREATE UNIQUE INDEX "booking_active_slot_key" ON "Booking"("turfId", "date", "startTime") WHERE (status = ANY (ARRAY['HELD'::"BookingStatus", 'CONFIRMED'::"BookingStatus"]));
