/*
# Add deposit pricing fields to bookings

## Overview
Adds total cost and deposit fields to the bookings table to support the 40% upfront deposit system.

## Changes
- Adds `total_amount` (numeric) — the full booking cost (100%)
- Adds `deposit_amount` (numeric) — the upfront deposit (40% of total)
- Adds `deposit_paid` (boolean, default false) — whether the deposit has been paid
- Both default to null since they are set at booking creation time

## Security
- No RLS changes needed — existing policies cover the new columns.
*/

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS total_amount numeric,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric,
  ADD COLUMN IF NOT EXISTS deposit_paid boolean NOT NULL DEFAULT false;
