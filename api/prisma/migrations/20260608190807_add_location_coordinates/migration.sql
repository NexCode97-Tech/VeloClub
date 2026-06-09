-- AlterTable: Add latitude and longitude to Location
ALTER TABLE "Location" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Location" ADD COLUMN "longitude" DOUBLE PRECISION;
