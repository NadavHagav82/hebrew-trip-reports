-- Add payment_method column to expenses table
-- 'company_card' = paid by company credit card (no reimbursement needed)
-- 'out_of_pocket' = paid by employee (reimbursement required)

CREATE TYPE public.payment_method AS ENUM ('company_card', 'out_of_pocket');

ALTER TABLE public.expenses
ADD COLUMN payment_method public.payment_method NOT NULL DEFAULT 'out_of_pocket';